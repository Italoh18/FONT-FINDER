import React, { useState, useEffect, useCallback } from 'react';
import { ImageUpload } from './components/ImageUpload';
import { FontResult } from './components/FontResult';
import { HistoryList } from './components/HistoryList';
import { FontCreator } from './components/FontCreator';
import { identifyFontFromImage } from './services/geminiService';
import { FontAnalysis, HistoryItem } from './types';
import { AlertCircle, Terminal, RefreshCw, PenTool, Search, Instagram, Facebook, Mail, MessageCircle } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'fontfinder_history';

export default function App() {
  const [mode, setMode] = useState<'analyze' | 'create'>('analyze');
  
  // Analyzer State
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FontAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [currentDownloadData, setCurrentDownloadData] = useState<{fileName: string, fileContent: string} | undefined>(undefined);

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
      
      const localMatch = history.find(item => 
        item.isUploaded && 
        item.fontName.toLowerCase().trim() === result.fontName.toLowerCase().trim()
      );

      if (localMatch && localMatch.fileName && localMatch.fileContent) {
        result.source = 'Local';
        result.matchConfidence = 'Alta';
        setCurrentDownloadData({
          fileName: localMatch.fileName,
          fileContent: localMatch.fileContent
        });
      }

      setAnalysis(result);
    } catch (err: any) {
      if (err.message === "API_KEY_MISSING") {
        setError("Chave de API não detectada no ambiente. Verifique as variáveis de ambiente.");
      } else {
        setError(err.message || "Erro ao analisar imagem.");
      }
    } finally {
      setLoading(false);
    }
  }, [getKnownUserFonts, history]);

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
      setError("Armazenamento cheio!");
    }
  };

  const handleDelete = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
  };

  const handleUpdateHistory = (id: string, newName: string) => {
    const newHistory = history.map(item => item.id === id ? { ...item, fontName: newName } : item);
    setHistory(newHistory);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setMode('analyze');
    if (!item.isUploaded) {
        setCurrentImage(item.thumbnailUrl);
        setCurrentDownloadData(undefined);
    } else {
        setCurrentImage(null); 
        if (item.fileName && item.fileContent) {
            setCurrentDownloadData({ fileName: item.fileName, fileContent: item.fileContent });
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
    const newItems: HistoryItem[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 2 * 1024 * 1024) continue;
        try {
            const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            newItems.push({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                fontName: file.name.replace(/\.[^/.]+$/, ""),
                category: "Fonte Uploadada",
                visualStyle: "Arquivo local.",
                matchConfidence: 'Alta',
                description: "Fonte importada manualmente.",
                similarFonts: [],
                detectedText: "Aa",
                thumbnailUrl: "",
                isUploaded: true,
                fileName: file.name,
                fileContent: base64,
                source: 'Local'
            });
        } catch (e) {}
    }
    if (newItems.length > 0) {
        const newHistory = [...newItems, ...history];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
        setHistory(newHistory);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col font-sans">
      
      {/* Header Preto - Estilo Imagem Referência */}
      <header className="bg-black border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-start gap-1">
            <h1 className="text-3xl font-times font-bold text-white tracking-wide uppercase">
              CRAZY ART
            </h1>
            <span className="text-sm text-slate-500 font-sans tracking-wide">
              Transformando ideias em realidade.
            </span>
          </div>

          <div className="flex p-1 bg-neutral-900/80 rounded-lg border border-white/5">
             <button 
               onClick={() => setMode('analyze')}
               className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-futura tracking-wide transition-all
                 ${mode === 'analyze' ? 'bg-white text-black font-medium shadow-sm' : 'text-slate-400 hover:text-white'}
               `}
             >
               <Search className="w-4 h-4" /> IDENTIFICAR
             </button>
             <button 
               onClick={() => setMode('create')}
               className={`flex items-center gap-2 px-6 py-2 rounded-md text-sm font-futura tracking-wide transition-all
                 ${mode === 'create' ? 'bg-white text-black font-medium shadow-sm' : 'text-slate-400 hover:text-white'}
               `}
             >
               <PenTool className="w-4 h-4" /> CRIAR
             </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-12">
        {mode === 'analyze' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="text-center mb-10">
                  <h2 className="text-2xl font-futura font-light text-white mb-2 uppercase tracking-widest">Identifique & Organize</h2>
                  <p className="text-slate-500 font-times italic text-lg">
                      "A tipografia é a voz da imagem."
                  </p>
                </div>

                <ImageUpload onImageSelected={handleImageSelected} isLoading={loading} />

                {error && (
                  <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-none text-red-200 space-y-4">
                      <div className="flex items-center gap-3 text-red-400 font-bold">
                        <AlertCircle className="w-6 h-6 shrink-0" />
                        <span className="text-lg font-futura uppercase">Erro na análise</span>
                      </div>
                      <p className="text-sm leading-relaxed">{error}</p>
                      
                      {error.includes("cota") && (
                        <button 
                          onClick={() => currentImage && handleImageSelected(currentImage)}
                          className="flex items-center gap-2 bg-red-900/50 hover:bg-red-800 text-white px-4 py-2 rounded transition-colors text-sm font-bold border border-red-700"
                        >
                          <RefreshCw className="w-4 h-4" /> Tentar Novamente
                        </button>
                      )}

                      {(error.includes("API_KEY") || error.includes("ambiente")) && (
                        <div className="bg-black p-4 border border-white/10 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                            <Terminal className="w-4 h-4" /> Configuração necessária
                          </div>
                          <ol className="text-xs text-slate-400 list-decimal pl-4 space-y-1">
                            <li>{"Vá em Settings > Environment variables no seu provedor (Cloudflare/Vercel)."}</li>
                            <li>{"Adicione a chave API_KEY."}</li>
                            <li><strong>Importante:</strong> Realize um novo <strong>Deploy</strong> para aplicar as mudanças.</li>
                          </ol>
                        </div>
                      )}
                  </div>
                )}

                {currentImage && !loading && !error && (
                  <div className="flex justify-center mb-6">
                      <img src={currentImage} alt="Preview" className="max-h-48 border border-white/10 shadow-2xl" />
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

            <div className="lg:col-span-1 border-l border-white/10 lg:pl-8">
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
        ) : (
          <div className="max-w-5xl mx-auto">
             <div className="text-center mb-10">
                <h2 className="text-2xl font-futura font-light text-white mb-2 uppercase tracking-widest">Estúdio de Criação</h2>
                <p className="text-slate-500 font-times italic text-lg">
                    Desenhe sua própria fonte vetorial.
                </p>
              </div>
            <FontCreator />
          </div>
        )}
      </main>

      {/* Footer Preto - Estilo Imagem Referência */}
      <footer className="bg-black border-t border-white/10 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          
          {/* Esquerda: Logo e Slogan */}
          <div className="hidden md:block w-1/3">
             <div className="flex flex-col items-start gap-1">
                <h3 className="text-xl font-times font-bold text-white tracking-wide uppercase">
                  CRAZY ART
                </h3>
                <p className="text-xs text-slate-500 font-sans tracking-wide">
                  Transformando ideias em realidade.
                </p>
             </div>
          </div>

          {/* Centro: Ícones Sociais */}
          <div className="flex items-center gap-8 text-slate-500">
            <a href="#" className="hover:text-white transition-colors transform hover:scale-110"><Instagram className="w-5 h-5" /></a>
            <a href="#" className="hover:text-white transition-colors transform hover:scale-110"><MessageCircle className="w-5 h-5" /></a>
            <a href="#" className="hover:text-white transition-colors transform hover:scale-110"><Facebook className="w-5 h-5" /></a>
            <a href="#" className="hover:text-white transition-colors transform hover:scale-110"><Mail className="w-5 h-5" /></a>
          </div>

          {/* Direita: Copyright */}
          <div className="text-xs text-slate-600 font-sans md:w-1/3 text-right">
            &copy; 2026 Crazy Art.
          </div>
        </div>
      </footer>
    </div>
  );
}