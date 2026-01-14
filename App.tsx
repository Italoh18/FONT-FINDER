import React, { useState, useEffect, useCallback } from 'react';
import { ImageUpload } from './components/ImageUpload';
import { FontResult } from './components/FontResult';
import { HistoryList } from './components/HistoryList';
import { identifyFontFromImage } from './services/geminiService';
import { FontAnalysis, HistoryItem } from './types';
import { Sparkles, Github } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'fontfinder_history';

export default function App() {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FontAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  
  // Estado para armazenar dados de download quando uma fonte do histórico é selecionada
  const [currentDownloadData, setCurrentDownloadData] = useState<{fileName: string, fileContent: string} | undefined>(undefined);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Extrai nomes das fontes que foram uploadadas pelo usuário para contexto da IA
  const getKnownUserFonts = useCallback(() => {
    return history
      .filter(item => item.isUploaded)
      .map(item => item.fontName);
  }, [history]);

  const handleImageSelected = useCallback(async (base64: string) => {
    setCurrentImage(base64);
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setIsSaved(false);
    setCurrentDownloadData(undefined); 

    try {
      const knownFonts = getKnownUserFonts();
      const result = await identifyFontFromImage(base64, knownFonts);
      
      // Inteligência de Associação:
      // Verifica se o nome retornado pela IA (mesmo que a IA diga source='Web') 
      // bate com algum arquivo que já temos na biblioteca local.
      const localMatch = history.find(item => 
        item.isUploaded && 
        item.fontName.toLowerCase().trim() === result.fontName.toLowerCase().trim()
      );

      if (localMatch && localMatch.fileName && localMatch.fileContent) {
        // Se encontrou localmente, forçamos o source para Local e preparamos o download
        result.source = 'Local';
        result.matchConfidence = 'Alta'; // Aumenta confiança pois temos o arquivo
        setCurrentDownloadData({
          fileName: localMatch.fileName,
          fileContent: localMatch.fileContent
        });
      }

      setAnalysis(result);
    } catch (err: any) {
      console.error("Erro na análise:", err);
      setError(err.message || "Ocorreu um erro ao analisar a imagem. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [getKnownUserFonts, history]);

  // Handle Ctrl+V (Paste) globally
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (loading) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                handleImageSelected(event.target.result as string);
              }
            };
            reader.readAsDataURL(file);
            e.preventDefault(); // Prevent default paste behavior
            break; // Process only the first image found
          }
        }
      }
    };

    // Cast to any to avoid strict EventListener types issues with ClipboardEvent
    document.addEventListener('paste', handlePaste as any);
    return () => document.removeEventListener('paste', handlePaste as any);
  }, [loading, handleImageSelected]);

  const handleSave = () => {
    if (analysis && currentImage) {
      const newItem: HistoryItem = {
        ...analysis,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        thumbnailUrl: currentImage,
      };

      saveToHistory(newItem);
    }
  };

  const saveToHistory = (newItem: HistoryItem) => {
    try {
      const newHistory = [newItem, ...history];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
      setIsSaved(true);
    } catch (e) {
      console.error("Storage limit reached", e);
      setError("Espaço de armazenamento cheio! Tente remover fontes antigas para salvar novas.");
    }
  };

  const handleDelete = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
  };

  const handleUpdateHistory = (id: string, newName: string) => {
    const newHistory = history.map(item => {
      if (item.id === id) {
        return { ...item, fontName: newName };
      }
      return item;
    });
    setHistory(newHistory);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
  };

  const handleSelectHistory = (item: HistoryItem) => {
    if (!item.isUploaded) {
        setCurrentImage(item.thumbnailUrl);
        setCurrentDownloadData(undefined);
    } else {
        setCurrentImage(null); 
        if (item.fileName && item.fileContent) {
            setCurrentDownloadData({
                fileName: item.fileName,
                fileContent: item.fileContent
            });
        }
    }

    setAnalysis({
      fontName: item.fontName,
      category: item.category,
      visualStyle: item.visualStyle,
      matchConfidence: item.matchConfidence,
      description: item.description,
      similarFonts: item.similarFonts,
      detectedText: item.detectedText,
      source: item.isUploaded ? 'Local' : 'Web'
    });
    setIsSaved(true); 
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadFonts = async (files: FileList) => {
    setLoading(true);
    setError(null);

    const newItems: HistoryItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > 2 * 1024 * 1024) {
            errors.push(`${file.name} é muito grande (max 2MB).`);
            continue;
        }

        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const fontName = file.name.replace(/\.[^/.]+$/, "");

            newItems.push({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                fontName: fontName,
                category: "Fonte Uploadada",
                visualStyle: "Arquivo de fonte local importado pelo usuário.",
                matchConfidence: 'Alta',
                description: "Fonte importada manualmente para a biblioteca.",
                similarFonts: [],
                detectedText: "Aa",
                thumbnailUrl: "",
                isUploaded: true,
                fileName: file.name,
                fileContent: base64,
                source: 'Local'
            });

        } catch (e) {
            errors.push(`Erro ao ler ${file.name}`);
        }
    }

    if (newItems.length > 0) {
        try {
            const newHistory = [...newItems, ...history];
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
            setHistory(newHistory);
        } catch (e) {
            setError("Espaço de armazenamento local cheio. Não foi possível salvar todas as fontes.");
        }
    }

    if (errors.length > 0) {
        setError(`Alguns arquivos não foram salvos: ${errors.join(", ")}`);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-blue-600 to-purple-600 p-2 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              FontFinder AI
            </h1>
          </div>
          <a href="#" className="text-slate-400 hover:text-white transition-colors">
            <Github className="w-5 h-5" />
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
          {/* Main Area: Upload & Result */}
          <div className="lg:col-span-2 space-y-6">
              <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Identifique & Gerencie Fontes</h2>
              <p className="text-slate-400">
                  Identifique fontes por imagem ou faça upload dos seus arquivos (.ttf, .otf) para criar sua biblioteca pessoal.
              </p>
              </div>

              <ImageUpload onImageSelected={handleImageSelected} isLoading={loading} />

              {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-center animate-pulse flex flex-col gap-2 items-center">
                  <p>{error}</p>
              </div>
              )}

              {currentImage && !loading && (
              <div className="flex justify-center mb-6">
                  <img 
                      src={currentImage} 
                      alt="Preview" 
                      className="max-h-48 rounded-lg border border-slate-700 shadow-lg"
                  />
              </div>
              )}

              <FontResult 
                analysis={analysis}
                currentImage={currentImage}
                onSave={handleSave} 
                isSaved={isSaved} 
                downloadData={currentDownloadData}
              />
          </div>

          {/* Sidebar: History/Library */}
          <div className="lg:col-span-1 border-l border-slate-800 lg:pl-8">
              <div className="sticky top-28">
              <HistoryList 
                  history={history} 
                  onDelete={handleDelete}
                  onSelect={handleSelectHistory}
                  onUpdate={handleUpdateHistory}
                  onUploadFonts={handleUploadFonts}
              />
              </div>
          </div>
        </div>
      </main>
    </div>
  );
}