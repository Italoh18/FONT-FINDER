import React, { useState, useMemo, useRef, useEffect } from 'react';
import { HistoryItem, HistoryListProps } from '../types';
import { Trash2, Search, Edit2, Check, X, Upload, FileType, Database } from 'lucide-react';

// Componente para carregar e renderizar a fonte local visualmente
const LocalFontPreview: React.FC<{ fontName: string; fileContent?: string; text?: string }> = ({ fontName, fileContent, text = "Aa" }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!fileContent || !fontName) return;

    // Nome único para evitar colisão no registro do navegador
    const uniqueFontName = `preview-${fontName.replace(/\s+/g, '')}`;

    // Verifica se a fonte já está disponível
    if (document.fonts.check(`12px "${uniqueFontName}"`)) {
      setIsLoaded(true);
      return;
    }

    const loadFont = async () => {
      try {
        const fontFace = new FontFace(uniqueFontName, `url(${fileContent})`);
        const loadedFace = await fontFace.load();
        document.fonts.add(loadedFace);
        setIsLoaded(true);
      } catch (err) {
        console.error(`Erro ao renderizar preview da fonte ${fontName}:`, err);
        setHasError(true);
      }
    };

    loadFont();
  }, [fontName, fileContent]);

  if (hasError) {
     return <FileType className="w-6 h-6 text-purple-400" />;
  }

  if (!isLoaded) {
    return <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />;
  }

  return (
    <span 
      className="text-2xl text-purple-200 leading-none select-none"
      style={{ fontFamily: `preview-${fontName.replace(/\s+/g, '')}, sans-serif` }}
    >
      {text}
    </span>
  );
};

export const HistoryList: React.FC<HistoryListProps> = ({ history, onDelete, onSelect, onUpdate, onUploadFonts }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredHistory = useMemo(() => {
    if (!searchTerm) return history;
    const lowerTerm = searchTerm.toLowerCase();
    return history.filter(item => 
      item.fontName.toLowerCase().includes(lowerTerm) || 
      item.category.toLowerCase().includes(lowerTerm)
    );
  }, [history, searchTerm]);

  const handleStartEdit = (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditValue(item.fontName);
  };

  const handleSaveEdit = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editValue.trim()) {
      onUpdate(id, editValue);
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFonts(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Upload */}
      <div className="flex flex-col gap-3 mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-400" />
          Biblioteca de Fontes
        </h3>
        
        <div className="flex gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium shadow-lg shadow-blue-900/20 hover:scale-[1.02]"
          >
            <Upload className="w-4 h-4" />
            Upload Fontes
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept=".ttf,.otf,.woff,.woff2"
            onChange={handleFileChange}
          />
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Pesquisar fontes salvas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
          />
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="text-center py-12 px-4 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>{searchTerm ? "Nenhuma fonte encontrada." : "Nenhuma fonte salva ainda."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredHistory.map((item) => (
            <div 
              key={item.id} 
              className={`
                group relative flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer
                ${item.isUploaded 
                  ? 'bg-slate-800/50 border-purple-900/50 hover:border-purple-500/50 hover:bg-slate-800' 
                  : 'bg-slate-800 border-slate-700 hover:border-blue-500/50'
                }
              `}
              onClick={() => onSelect(item)}
            >
              {/* Thumbnail or Generated Preview */}
              <div className={`w-12 h-12 shrink-0 rounded-lg overflow-hidden border flex items-center justify-center
                ${item.isUploaded ? 'bg-purple-900/20 border-purple-700/30' : 'bg-slate-900 border-slate-700'}
              `}>
                {item.isUploaded ? (
                  <LocalFontPreview fontName={item.fontName} fileContent={item.fileContent} />
                ) : (
                  <img 
                    src={item.thumbnailUrl} 
                    alt="Thumb" 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                  />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                {editingId === item.id ? (
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-slate-900 border border-slate-600 text-white px-2 py-1 rounded text-sm focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <button onClick={(e) => handleSaveEdit(e, item.id)} className="text-green-400 hover:text-green-300">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={handleCancelEdit} className="text-red-400 hover:text-red-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group/title">
                    <h4 className={`font-bold truncate pr-2 transition-colors ${item.isUploaded ? 'text-purple-200 group-hover:text-purple-300' : 'text-slate-200 group-hover:text-blue-400'}`}>
                      {item.fontName}
                    </h4>
                    <button 
                      onClick={(e) => handleStartEdit(e, item)}
                      className="opacity-0 group-hover/title:opacity-100 text-slate-500 hover:text-blue-400 transition-opacity"
                      title="Corrigir nome da fonte"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  {item.isUploaded && (
                    <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded">
                      Local
                    </span>
                  )}
                  <p className="text-xs text-slate-400">{item.category}</p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};