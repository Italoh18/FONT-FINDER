import React, { useEffect, useState } from 'react';
import { ExternalLink, Save, CheckCircle, Type, Info, BarChart3, ArrowRight, Download, Maximize2, X, FileDown, Globe, Database } from 'lucide-react';
import { FontResultProps } from '../types';

// Componente auxiliar para carregar e exibir o preview da fonte (Google ou Local)
const FontPreviewItem: React.FC<{ 
  fontName: string; 
  previewText: string;
  selectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  customFontData?: string; // Dados Base64 da fonte local (opcional)
}> = ({ fontName, previewText, selectable, isSelected, onToggleSelect, customFontData }) => {
  const [loadError, setLoadError] = useState(false);
  const [isCustomLoaded, setIsCustomLoaded] = useState(false);
  
  const displayText = previewText.length > 15 ? previewText.substring(0, 12) + '...' : previewText;
  const safeTextForUrl = previewText.length > 20 ? 'Preview' : previewText;

  useEffect(() => {
    if (!fontName) return;

    // Se tiver dados customizados (Local), usa FontFace API
    if (customFontData) {
      if (document.fonts.check(`12px "${fontName}"`)) {
        setIsCustomLoaded(true);
        return;
      }

      const fontFace = new FontFace(fontName, `url(${customFontData})`);
      fontFace.load().then(loadedFace => {
        document.fonts.add(loadedFace);
        setIsCustomLoaded(true);
      }).catch(err => {
        console.error("Erro ao carregar fonte customizada:", err);
        setLoadError(true);
      });
      return;
    }

    // Se não, tenta Google Fonts
    const cleanName = fontName.replace(/\s+/g, '+');
    const href = `https://fonts.googleapis.com/css2?family=${cleanName}&text=${encodeURIComponent(safeTextForUrl)}&display=swap`;
    
    const link = document.createElement('link');
    link.href = href;
    link.rel = 'stylesheet';
    
    link.onerror = () => setLoadError(true);
    
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [fontName, safeTextForUrl, customFontData]);

  const getSearchUrl = (font: string, site: 'google' | 'dafont' | 'download') => {
    const query = encodeURIComponent(font);
    switch (site) {
      case 'google': return `https://fonts.google.com/?query=${query}`;
      case 'dafont': return `https://www.dafont.com/search.php?q=${query}`;
      case 'download': return `https://www.google.com/search?q=${encodeURIComponent(`download font "${font}"`)}`;
      default: return '#';
    }
  };

  const fontFamilyStyle = customFontData 
    ? (isCustomLoaded ? `"${fontName}", sans-serif` : 'sans-serif')
    : (loadError ? 'sans-serif' : `"${fontName}", sans-serif`);

  return (
    <div className={`
      relative p-3 rounded-xl border transition-all flex items-center gap-4 group
      ${isSelected 
        ? 'bg-blue-600/20 border-blue-500' 
        : 'bg-slate-700/30 border-slate-700/50 hover:bg-slate-700/50'
      }
    `}>
      {selectable && (
        <div className="absolute top-3 right-3 z-10">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-5 h-5 rounded border-slate-500 text-blue-600 focus:ring-blue-500 bg-slate-800 cursor-pointer"
          />
        </div>
      )}

      {/* Visual Preview Box */}
      <div className="w-auto min-w-[4rem] h-16 px-4 shrink-0 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-600 shadow-sm">
        <span 
          className="text-2xl text-slate-900 whitespace-nowrap"
          style={{ fontFamily: fontFamilyStyle }}
        >
          {displayText}
        </span>
      </div>

      <div className="flex-1 min-w-0 pr-6">
        <h4 className={`font-bold text-lg truncate mb-2 ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}>
          {fontName}
        </h4>
        
        {/* Links */}
        <div className="flex flex-wrap gap-2">
          {!customFontData && (
            <>
              <a 
                href={getSearchUrl(fontName, 'dafont')} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white px-2 py-1 rounded-md transition-colors flex items-center gap-1 border border-slate-600"
                title="Buscar no DaFont"
              >
                DaFont <ExternalLink className="w-3 h-3" />
              </a>
              <a 
                href={getSearchUrl(fontName, 'google')} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white px-2 py-1 rounded-md transition-colors flex items-center gap-1 border border-slate-600"
                title="Buscar no Google Fonts"
              >
                Google <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
          <a 
            href={getSearchUrl(fontName, 'download')} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs bg-slate-800 hover:bg-green-600 text-slate-400 hover:text-white px-2 py-1 rounded-md transition-colors flex items-center gap-1 border border-slate-600"
            title="Pesquisar download no Google"
          >
            Download <Download className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

// Modal de Comparação
const ComparisonModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  fonts: string[];
  previewText: string;
  originalImage: string | null;
  mainFontData?: { name: string, data: string }; // Dados da fonte principal local se existir
}> = ({ isOpen, onClose, fonts, previewText, originalImage, mainFontData }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Maximize2 className="w-5 h-5 text-blue-400" />
            Comparador de Fontes
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Imagem Original */}
          {originalImage && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Referência Original</label>
              <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 inline-block max-w-full">
                <img src={originalImage} alt="Original" className="max-h-32 object-contain rounded" />
              </div>
            </div>
          )}

          {/* Lista de Comparação */}
          <div className="grid grid-cols-1 gap-6">
            {fonts.map((font, idx) => {
              // Verifica se essa fonte da lista de comparação é a mesma da fonte principal (Local)
              const isMainLocalFont = mainFontData && mainFontData.name === font;
              const customData = isMainLocalFont ? mainFontData.data : undefined;

              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <label className="text-sm font-bold text-blue-300">{font}</label>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-slate-600 flex items-center justify-center min-h-[100px]">
                    <FontPreviewItem 
                      fontName={font} 
                      previewText={previewText} 
                      customFontData={customData}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const FontResult: React.FC<FontResultProps> = ({ analysis, currentImage, onSave, isSaved, downloadData }) => {
  const [selectedFonts, setSelectedFonts] = useState<string[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Reset selection when analysis changes
  useEffect(() => {
    setSelectedFonts([]);
  }, [analysis]);

  if (!analysis) return null;

  const confidenceColor = 
    analysis.matchConfidence === 'Alta' ? 'text-green-400' :
    analysis.matchConfidence === 'Média' ? 'text-yellow-400' : 
    'text-red-400';

  const previewText = analysis.detectedText || "Preview";

  const handleToggleFont = (fontName: string) => {
    setSelectedFonts(prev => {
      if (prev.includes(fontName)) {
        return prev.filter(f => f !== fontName);
      }
      if (prev.length >= 3) return prev; // Max 3
      return [...prev, fontName];
    });
  };

  const getSearchUrl = (fontName: string, site: 'google' | 'dafont' | 'download') => {
    const query = encodeURIComponent(fontName);
    switch (site) {
      case 'google': return `https://fonts.google.com/?query=${query}`;
      case 'dafont': return `https://www.dafont.com/search.php?q=${query}`;
      case 'download': return `https://www.google.com/search?q=${encodeURIComponent(`download font "${fontName}"`)}`;
      default: return '#';
    }
  };

  const handleDirectDownload = () => {
    if (!downloadData) return;
    const link = document.createElement('a');
    link.href = downloadData.fileContent;
    link.download = downloadData.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const MainFontLinks: React.FC<{ fontName: string }> = ({ fontName }) => (
    <div className="flex flex-wrap gap-2 mt-2">
      <a 
        href={getSearchUrl(fontName, 'dafont')} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
      >
        DaFont <ExternalLink className="w-3 h-3" />
      </a>
      <a 
        href={getSearchUrl(fontName, 'google')} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
      >
        Google Fonts <ExternalLink className="w-3 h-3" />
      </a>
       <a 
        href={getSearchUrl(fontName, 'download')} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-xs bg-slate-700 hover:bg-green-600 text-slate-300 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
      >
        Download <Download className="w-3 h-3" />
      </a>
    </div>
  );

  return (
    <>
      <div className="w-full max-w-xl mx-auto bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-xl animate-fade-in pb-16 md:pb-6 relative">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {analysis.source === 'Local' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <Database className="w-3 h-3" /> Na Biblioteca
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Globe className="w-3 h-3" /> Sugestão Web
                  </span>
                )}
                <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-slate-700 text-slate-300 rounded-full border border-slate-600">
                  {analysis.category}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                {/* Se for local, exibe um preview maior, senão ícone */}
                {downloadData ? (
                  <div className="h-10 px-3 bg-white rounded flex items-center justify-center border border-purple-500/50">
                    <span style={{ fontFamily: `"${analysis.fontName}", sans-serif` }} className="text-slate-900 text-xl whitespace-nowrap">
                       {analysis.fontName}
                    </span>
                  </div>
                ) : (
                  <>
                    <Type className="w-8 h-8 text-blue-400" />
                    {analysis.fontName}
                  </>
                )}
              </h2>
            </div>
            <button
              onClick={onSave}
              disabled={isSaved}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                ${isSaved 
                  ? 'bg-green-500/20 text-green-400 cursor-default' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                }
              `}
            >
              {isSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {isSaved ? 'Salvo' : 'Salvar'}
            </button>
          </div>

          {/* Seção Especial de Download Direto se disponível */}
          {downloadData && (
             <div className="mb-6 p-4 bg-purple-600/10 border border-purple-600/30 rounded-xl flex items-center justify-between animate-pulse-once">
                <div>
                   <h4 className="text-sm font-bold text-purple-200">Arquivo Local Disponível</h4>
                   <p className="text-xs text-purple-300/70">{downloadData.fileName}</p>
                </div>
                <button 
                  onClick={handleDirectDownload}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-colors"
                >
                  <FileDown className="w-5 h-5" />
                  Download Direto
                </button>
             </div>
          )}

          {/* Links de busca na web - Relevante mesmo se for local para comparar */}
          <div className="mb-6 p-4 bg-blue-600/10 border border-blue-600/20 rounded-xl">
               <h4 className="text-sm font-semibold text-blue-200 mb-2">
                 {analysis.source === 'Local' ? `Comparar "${analysis.fontName}" na Web:` : `Buscar "${analysis.fontName}" na Web:`}
               </h4>
               <MainFontLinks fontName={analysis.fontName} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm">
                <Info className="w-4 h-4" /> Estilo Visual
              </div>
              <p className="text-slate-200 font-medium">{analysis.visualStyle}</p>
            </div>
            
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm">
                <BarChart3 className="w-4 h-4" /> Confiança
              </div>
              <p className={`font-bold ${confidenceColor}`}>{analysis.matchConfidence}</p>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Análise da IA</h3>
            <p className="text-slate-300 leading-relaxed text-sm">
              {analysis.description}
            </p>
          </div>

          {/* Seção de Fontes Similares com Seleção */}
          {analysis.similarFonts && analysis.similarFonts.length > 0 && (
              <div className="border-t border-slate-700 pt-6 mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <ArrowRight className="w-5 h-5 text-purple-400" />
                        Alternativas Similares
                    </h3>
                    <span className="text-xs text-slate-500">
                      Selecione até 3 para comparar
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                      {/* Se a fonte principal (local) for adicionada à lista de comparação, ela deve usar o customFontData */}
                      {/* Caso contrário, renderiza as similares do Google Fonts */}
                      {analysis.similarFonts.map((font, idx) => (
                          <FontPreviewItem 
                            key={idx} 
                            fontName={font} 
                            previewText={previewText}
                            selectable={true}
                            isSelected={selectedFonts.includes(font)}
                            onToggleSelect={() => handleToggleFont(font)}
                          />
                      ))}
                  </div>
              </div>
          )}
        </div>

        {/* Floating Action Button para Comparar */}
        {selectedFonts.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:absolute md:bottom-6 md:left-1/2 md:-translate-x-1/2 z-50 animate-bounce-in">
            <button 
              onClick={() => setIsComparisonOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-blue-900/50 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <Maximize2 className="w-5 h-5" />
              Comparar ({selectedFonts.length})
            </button>
          </div>
        )}
      </div>

      <ComparisonModal 
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        fonts={selectedFonts}
        previewText={previewText}
        originalImage={currentImage}
        mainFontData={downloadData ? { name: analysis.fontName, data: downloadData.fileContent } : undefined}
      />
    </>
  );
};