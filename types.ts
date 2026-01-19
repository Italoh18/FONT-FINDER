export interface FontAnalysis {
  fontName: string;
  category: string; // e.g., Serif, Sans-Serif, Script
  visualStyle: string; // e.g., "Bold geometric with high x-height"
  matchConfidence: 'Alta' | 'Média' | 'Baixa';
  description: string;
  similarFonts: string[]; // Lista de fontes parecidas
  detectedText?: string; // Texto extraído da imagem para preview
  source?: 'Local' | 'Web'; // Origem da identificação
}

export interface HistoryItem extends FontAnalysis {
  id: string;
  timestamp: number;
  thumbnailUrl: string; // Base64 or URL of the cropped image (ou placeholder para uploads)
  isUploaded?: boolean; // Flag para identificar se foi upload manual
  fileContent?: string; // Base64 do arquivo da fonte (.ttf, .otf)
  fileName?: string; // Nome original do arquivo
}

export interface ImageUploadProps {
  onImageSelected: (base64: string) => void;
  isLoading: boolean;
}

export interface FontResultProps {
  analysis: FontAnalysis | null;
  currentImage: string | null;
  onSave: () => void;
  isSaved: boolean;
  // Propriedade opcional para permitir download se for um item do histórico com arquivo
  downloadData?: {
    fileName: string;
    fileContent: string;
  };
}

export interface HistoryListProps {
  history: HistoryItem[];
  onDelete: (id: string) => void;
  onSelect: (item: HistoryItem) => void;
  onUpdate: (id: string, newName: string) => void;
  onUploadFonts: (files: FileList) => void; // Nova prop para upload
}

// --- Font Creator Types ---

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  points: Point[];
  type: 'freehand' | 'shape' | 'bezier';
  isClosed?: boolean; // Indica se o path deve ser fechado (para formas)
  filled?: boolean; // Indica se a forma deve ser preenchida (Paint Bucket)
  width?: number; // Espessura do traço
}

export interface GlyphData {
  char: string;
  strokes: Stroke[];
  previewUrl?: string; // Base64 image for fast rendering in grid
}

export type GlyphMap = Record<string, GlyphData>;