import React, { useState, useEffect, useCallback } from 'react';
import { ImageUpload } from './components/ImageUpload';
import { FontResult } from './components/FontResult';
import { HistoryList } from './components/HistoryList';
import { identifyFontFromImage } from './services/geminiService';
import { FontAnalysis, HistoryItem } from './types';
import { Sparkles, Github, AlertCircle } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'fontfinder_history';

export default function App() {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FontAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [currentDownloadData, setCurrentDownloadData] = useState<{fileName: string, fileContent: string} | undefined>(undefined);

  // Carrega histórico do localStorage
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
      setError(err.message || "Erro ao analisar imagem.");
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
    <div className="min-h-screen bg-slate-900 pb-20">
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
          <div className="flex items-center gap-4">
            <a href="https://github.com" target="_blank" className="text-slate-400 hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Identifique & Gerencie Fontes</h2>
                <p className="text-slate-400">
                    Arraste uma imagem para descobrir qual fonte está sendo usada.
                </p>
              </div>

              <ImageUpload onImageSelected={handleImageSelected} isLoading={loading} />

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <p>{error}</p>
                </div>
              )}

              {currentImage && !loading && (
                <div className="flex justify-center mb-6">
                    <img src={currentImage} alt="Preview" className="max-h-48 rounded-lg border border-slate-700 shadow-lg" />
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