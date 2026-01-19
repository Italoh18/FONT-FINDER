import React, { useRef, useState, useEffect } from 'react';
import { X, ChevronRight, Save, Square, Triangle, Circle, Undo, Eraser, PenTool, Spline, PaintBucket, Minus, Plus, Eye, EyeOff, Upload, Move, Maximize } from 'lucide-react';
import { Stroke, Point } from '../types';

interface DrawingModalProps {
  char: string;
  initialStrokes: Stroke[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (strokes: Stroke[], previewUrl: string) => void;
  onNext: (strokes: Stroke[], previewUrl: string) => void;
  isLast: boolean;
}

type ToolType = 'pen' | 'bezier' | 'square' | 'triangle' | 'circle' | 'bucket' | 'move' | 'scale';

export const DrawingModal: React.FC<DrawingModalProps> = ({ 
  char, initialStrokes, isOpen, onClose, onSave, onNext, isLast 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref para o input de arquivo
  const snapshotStrokesRef = useRef<Stroke[]>([]); // Ref para guardar estado inicial durante transformações (scale)
  
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [strokeWidth, setStrokeWidth] = useState<number>(15);
  const [showGuide, setShowGuide] = useState<boolean>(true); 
  
  // Interaction State
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  
  const [bezierPhase, setBezierPhase] = useState<0 | 1 | 2>(0);
  const [bezierControlPoint, setBezierControlPoint] = useState<Point | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStrokes(initialStrokes || []);
      setBezierPhase(0);
      setStartPoint(null);
      setCurrentPoint(null);
      setActiveTool('pen');
      setStrokeWidth(15);
      setShowGuide(true);
      snapshotStrokesRef.current = [];
    }
  }, [isOpen, initialStrokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Limpar
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Desenhar Guia (Sombra)
    if (showGuide) {
        drawGuideChar(ctx, canvas.width, canvas.height);
    }

    // 3. Desenhar Grade
    drawGuidelines(ctx, canvas.width, canvas.height);

    // Configuração para os traços do usuário
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'white';

    // 4. Desenhar Traços Salvos
    strokes.forEach(stroke => {
      drawStroke(ctx, stroke);
    });

    // 5. Desenhar Preview da Ferramenta Atual
    if (activeTool !== 'pen' && activeTool !== 'bucket' && activeTool !== 'move' && activeTool !== 'scale' && startPoint && currentPoint) {
       drawPreviewShape(ctx);
    }
  }, [strokes, startPoint, currentPoint, activeTool, isDrawing, bezierPhase, bezierControlPoint, strokeWidth, showGuide, char]);

  // --- SVG Import Logic ---

  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseAndLoadSvg(text);
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const parseAndLoadSvg = (svgText: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(svgText, "image/svg+xml");
      const pathElements = xmlDoc.getElementsByTagName("path");
      
      if (pathElements.length === 0) {
        alert("Nenhum caminho (path) encontrado no SVG.");
        return;
      }

      // Combina todos os paths em strokes
      let newStrokes: Stroke[] = [];
      
      for (let i = 0; i < pathElements.length; i++) {
        const d = pathElements[i].getAttribute("d");
        if (d) {
          const points = parseSvgPathData(d);
          if (points.length > 2) {
             newStrokes.push({
               points,
               type: 'shape',
               filled: true,
               isClosed: true,
               width: strokeWidth
             });
          }
        }
      }

      if (newStrokes.length > 0) {
        const centeredStrokes = normalizeStrokesToCanvas(newStrokes, 500, 500);
        setStrokes(prev => [...prev, ...centeredStrokes]);
        setActiveTool('pen'); // Reset tool
      }
    } catch (err) {
      console.error("Erro ao processar SVG", err);
      alert("Erro ao processar o arquivo SVG.");
    }
  };

  // Parser simplificado de SVG Path data para pontos
  const parseSvgPathData = (d: string): Point[] => {
    const commands = d.match(/([a-zA-Z])|([-+]?[0-9]*\.?[0-9]+)/g);
    if (!commands) return [];

    let points: Point[] = [];
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;
    
    let i = 0;
    while (i < commands.length) {
      const cmd = commands[i];
      
      // Se for número, assume que é continuação do comando anterior (ou L implícito)
      if (!isNaN(parseFloat(cmd))) {
         // Tratamento simplificado: avança
         i++;
         continue;
      }

      const getNum = () => parseFloat(commands[++i]);

      switch (cmd.toUpperCase()) {
        case 'M': // Move
          currentX = getNum();
          currentY = getNum();
          startX = currentX;
          startY = currentY;
          points.push({ x: currentX, y: currentY });
          if (cmd === 'm') { // Relative move treated as abs for simplicity in start or accumulation needed
             // Simplificação: SVGs complexos podem precisar de parser mais robusto
          }
          break;
        case 'L': // Line
          currentX = getNum();
          currentY = getNum();
          points.push({ x: currentX, y: currentY });
          break;
        case 'H': // Horizontal
          currentX = getNum();
          points.push({ x: currentX, y: currentY });
          break;
        case 'V': // Vertical
          currentY = getNum();
          points.push({ x: currentX, y: currentY });
          break;
        case 'Z': // Close
          points.push({ x: startX, y: startY });
          break;
        case 'C': // Cubic Bezier (Flatenned to points)
          const cp1x = getNum(); const cp1y = getNum();
          const cp2x = getNum(); const cp2y = getNum();
          const x = getNum();    const y = getNum();
          
          // Flatten curve
          for (let t = 0.1; t <= 1; t += 0.1) {
            const xt = (1-t)**3 * currentX + 3*(1-t)**2*t*cp1x + 3*(1-t)*t**2*cp2x + t**3*x;
            const yt = (1-t)**3 * currentY + 3*(1-t)**2*t*cp1y + 3*(1-t)*t**2*cp2y + t**3*y;
            points.push({x: xt, y: yt});
          }
          currentX = x;
          currentY = y;
          break;
        case 'Q': // Quadratic Bezier
           const qcp1x = getNum(); const qcp1y = getNum();
           const qx = getNum();    const qy = getNum();
           
           for (let t = 0.1; t <= 1; t += 0.1) {
             const xt = (1-t)**2 * currentX + 2*(1-t)*t*qcp1x + t**2*qx;
             const yt = (1-t)**2 * currentY + 2*(1-t)*t*qcp1y + t**2*qy;
             points.push({x: xt, y: yt});
           }
           currentX = qx;
           currentY = qy;
           break;
        default:
           // Comandos não suportados ignorados ou tratados como params
           break;
      }
      i++;
    }
    return points;
  };

  const normalizeStrokesToCanvas = (strokes: Stroke[], width: number, height: number): Stroke[] => {
     let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
     
     // Find Bounds
     strokes.forEach(s => s.points.forEach(p => {
       if (p.x < minX) minX = p.x;
       if (p.x > maxX) maxX = p.x;
       if (p.y < minY) minY = p.y;
       if (p.y > maxY) maxY = p.y;
     }));

     if (minX === Infinity) return strokes;

     const shapeW = maxX - minX;
     const shapeH = maxY - minY;
     
     // Scale to fit with padding (e.g., 80% of canvas)
     const padding = 50;
     const targetW = width - (padding * 2);
     const targetH = height - (padding * 2);
     
     const scale = Math.min(targetW / shapeW, targetH / shapeH);
     
     // Center offsets
     const offsetX = (width - shapeW * scale) / 2;
     const offsetY = (height - shapeH * scale) / 2;

     return strokes.map(s => ({
       ...s,
       points: s.points.map(p => ({
         x: (p.x - minX) * scale + offsetX,
         y: (p.y - minY) * scale + offsetY
       }))
     }));
  };

  // --- Funções de Desenho ---

  const drawGuideChar = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const baselineY = h * 0.8;
    
    ctx.save();
    // Configura a fonte guia. Times New Roman ou Sans-serif genérico para referência
    ctx.font = `bold ${h * 0.65}px sans-serif`; 
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; // Cinza bem transparente
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    
    // Desenha o caractere no centro horizontal, alinhado à baseline
    ctx.fillText(char, w / 2, baselineY);
    ctx.restore();
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length === 0) return;

    // Usa a espessura salva no stroke ou o padrão 15 se não existir (compatibilidade com antigos)
    ctx.lineWidth = stroke.width || 15;

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    if (stroke.type === 'bezier' && stroke.points.length === 3) {
      ctx.quadraticCurveTo(
        stroke.points[1].x, stroke.points[1].y,
        stroke.points[2].x, stroke.points[2].y
      );
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
    }
    
    if (stroke.isClosed) {
      ctx.closePath();
    }

    if (stroke.filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  };

  const drawPreviewShape = (ctx: CanvasRenderingContext2D) => {
    if (!startPoint || !currentPoint) return;

    // Usa a espessura ATUAL do slider para o preview
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'; // Blue preview
    ctx.beginPath();

    if (activeTool === 'square') {
      const w = currentPoint.x - startPoint.x;
      const h = currentPoint.y - startPoint.y;
      ctx.rect(startPoint.x, startPoint.y, w, h);
    } 
    else if (activeTool === 'circle') {
      const rx = Math.abs(currentPoint.x - startPoint.x) / 2;
      const ry = Math.abs(currentPoint.y - startPoint.y) / 2;
      const cx = Math.min(startPoint.x, currentPoint.x) + rx;
      const cy = Math.min(startPoint.y, currentPoint.y) + ry;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    }
    else if (activeTool === 'triangle') {
      const x1 = startPoint.x;
      const y1 = startPoint.y;
      const x2 = currentPoint.x;
      const y2 = currentPoint.y;
      const midX = (x1 + x2) / 2;
      ctx.moveTo(midX, Math.min(y1, y2));
      ctx.lineTo(Math.min(x1, x2), Math.max(y1, y2));
      ctx.lineTo(Math.max(x1, x2), Math.max(y1, y2));
      ctx.closePath();
    }
    else if (activeTool === 'bezier') {
      if (bezierPhase === 1) {
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
      } else if (bezierPhase === 2 && bezierControlPoint) {
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.quadraticCurveTo(
          bezierControlPoint.x, bezierControlPoint.y,
          currentPoint.x, currentPoint.y
        );
        // Handle visualizer
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(bezierControlPoint.x, bezierControlPoint.y);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.stroke();
        ctx.restore();
        
        ctx.stroke(); // Draw the curve itself
        return;
      }
    }
    else if (activeTool === 'pen') {
        // Freehand preview is handled by the stroke accumulation, 
        // but if we wanted a "cursor" preview it would go here.
    }

    ctx.stroke();
  };

  const drawGuidelines = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Cores
    const gridColor = '#1e293b'; // Slate 800
    const lineColor = '#475569'; // Slate 600 (Main lines)
    const subLineColor = '#334155'; // Slate 700 (Sub lines)

    // Configuração das linhas
    const baselineY = h * 0.8;      // 80% (ex: 400px)
    const capHeightY = h * 0.2;     // 20% (ex: 100px) - Topo das Maiúsculas
    const xHeightY = h * 0.5;       // 50% (ex: 250px) - Topo das Minúsculas (Aprox)
    const centerX = w * 0.5;

    // 1. Grade de Fundo (50px)
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 50) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += 50) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();

    // 2. Linhas Principais (Com Sombra para contraste)
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Baseline (Sólida)
    ctx.strokeStyle = '#94a3b8'; // Slate 400 (Mais claro)
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(w, baselineY);
    ctx.stroke();

    // 3. Linhas Auxiliares (Tracejadas)
    ctx.lineWidth = 1;
    ctx.strokeStyle = subLineColor;
    ctx.setLineDash([5, 5]);

    // Cap Height
    ctx.beginPath();
    ctx.moveTo(0, capHeightY);
    ctx.lineTo(w, capHeightY);
    ctx.stroke();

    // X-Height
    ctx.beginPath();
    ctx.moveTo(0, xHeightY);
    ctx.lineTo(w, xHeightY);
    ctx.stroke();

    // Center Vertical
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, h);
    ctx.stroke();

    // Reset
    ctx.setLineDash([]);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Labels (Texto de ajuda na grade)
    ctx.fillStyle = '#64748b'; // Slate 500
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText("Cap Height", 5, capHeightY - 5);
    ctx.fillText("x-Height", 5, xHeightY - 5);
    ctx.fillText("Baseline", 5, baselineY - 5);
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const isPointInStroke = (p: Point, stroke: Stroke): boolean => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    stroke.points.forEach(pt => {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y);
      maxY = Math.max(maxY, pt.y);
    });
    
    const tolerance = 20;
    if (p.x < minX - tolerance || p.x > maxX + tolerance || p.y < minY - tolerance || p.y > maxY + tolerance) {
      return false;
    }

    for(const pt of stroke.points) {
      const dist = Math.sqrt(Math.pow(p.x - pt.x, 2) + Math.pow(p.y - pt.y, 2));
      if (dist < tolerance) return true;
    }
    return false;
  };

  // --- Handlers ---

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;

    if (activeTool === 'bucket') {
      const newStrokes = [...strokes];
      for (let i = newStrokes.length - 1; i >= 0; i--) {
        if (isPointInStroke(pos, newStrokes[i])) {
          newStrokes[i] = { ...newStrokes[i], filled: !newStrokes[i].filled, isClosed: true };
          setStrokes(newStrokes);
          return;
        }
      }
      return;
    }

    if (activeTool === 'move') {
      setIsDrawing(true);
      setCurrentPoint(pos); // Define ponto inicial do movimento
      return;
    }

    if (activeTool === 'scale') {
      setIsDrawing(true);
      setStartPoint(pos);
      // Salva snapshot para evitar distorção cumulativa
      snapshotStrokesRef.current = JSON.parse(JSON.stringify(strokes));
      return;
    }

    if (activeTool === 'pen') {
      setIsDrawing(true);
      // Salva a espessura atual no novo traço
      setStrokes(prev => [...prev, { points: [pos], type: 'freehand', width: strokeWidth }]);
    } 
    else if (activeTool === 'bezier') {
      if (bezierPhase === 0) {
        setStartPoint(pos);
        setCurrentPoint(pos);
        setBezierPhase(1);
        setIsDrawing(true);
      } else if (bezierPhase === 2) {
        if (startPoint && currentPoint && bezierControlPoint) {
            setStrokes(prev => [...prev, {
                points: [startPoint, bezierControlPoint, currentPoint],
                type: 'bezier',
                width: strokeWidth
            }]);
            setBezierPhase(0);
            setStartPoint(null);
            setCurrentPoint(null);
            setBezierControlPoint(null);
            setIsDrawing(false);
        }
      }
    }
    else {
      setStartPoint(pos);
      setCurrentPoint(pos);
      setIsDrawing(true);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;

    if (activeTool === 'move' && isDrawing && currentPoint) {
       const dx = pos.x - currentPoint.x;
       const dy = pos.y - currentPoint.y;
       
       setStrokes(prev => prev.map(stroke => ({
         ...stroke,
         points: stroke.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
       })));
       
       setCurrentPoint(pos);
       return;
    }

    if (activeTool === 'scale' && isDrawing && startPoint) {
       // Calcular fator de escala baseado no movimento vertical
       // Mover para cima (Y menor) aumenta, mover para baixo (Y maior) diminui
       const sensitivity = 0.005;
       const dy = startPoint.y - pos.y; 
       const scale = Math.max(0.1, 1 + (dy * sensitivity));
       
       const cx = 250; // Centro X do canvas
       const cy = 250; // Centro Y do canvas

       const newStrokes = snapshotStrokesRef.current.map(s => ({
         ...s,
         // Escalar também a espessura para manter proporção visual
         width: (s.width || 15) * scale,
         points: s.points.map(p => ({
             x: cx + (p.x - cx) * scale,
             y: cy + (p.y - cy) * scale
         }))
       }));
       
       setStrokes(newStrokes);
       return;
    }

    if (activeTool === 'pen' && isDrawing) {
      setStrokes(prev => {
        const lastStroke = prev[prev.length - 1];
        if (!lastStroke || lastStroke.type !== 'freehand') return prev;
        return [
          ...prev.slice(0, -1),
          { ...lastStroke, points: [...lastStroke.points, pos] }
        ];
      });
    } 
    else if (activeTool === 'bezier') {
      if (bezierPhase === 1) setCurrentPoint(pos);
      else if (bezierPhase === 2) setBezierControlPoint(pos);
    }
    else if (isDrawing) {
      setCurrentPoint(pos);
    }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    if (activeTool === 'bucket') return;

    if (activeTool === 'move') {
      setIsDrawing(false);
      setCurrentPoint(null);
      return;
    }

    if (activeTool === 'scale') {
      setIsDrawing(false);
      setStartPoint(null);
      snapshotStrokesRef.current = []; // Limpa snapshot
      return;
    }

    if (activeTool === 'pen') {
      setIsDrawing(false);
    }
    else if (activeTool === 'bezier') {
        if (bezierPhase === 1) {
            setBezierPhase(2);
            if (startPoint && currentPoint) {
                setBezierControlPoint({
                    x: (startPoint.x + currentPoint.x) / 2,
                    y: (startPoint.y + currentPoint.y) / 2
                });
            }
        }
    }
    else if (isDrawing && startPoint && currentPoint) {
      setIsDrawing(false);
      const newStroke = createShapeStroke(activeTool, startPoint, currentPoint);
      if (newStroke) {
        setStrokes(prev => [...prev, newStroke]);
      }
      setStartPoint(null);
      setCurrentPoint(null);
    }
  };

  const createShapeStroke = (tool: ToolType, p1: Point, p2: Point): Stroke | null => {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    const w = maxX - minX;
    const h = maxY - minY;

    if (w < 5 && h < 5) return null;

    let points: Point[] = [];

    if (tool === 'square') {
      points = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
        { x: minX, y: minY }
      ];
    } else if (tool === 'triangle') {
      points = [
        { x: minX + w / 2, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
        { x: minX + w / 2, y: minY }
      ];
    } else if (tool === 'circle') {
      const cx = minX + w / 2;
      const cy = minY + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      const segments = 32;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * 2 * Math.PI;
        points.push({ x: cx + rx * Math.cos(theta), y: cy + ry * Math.sin(theta) });
      }
    }

    return { points, type: 'shape', isClosed: true, filled: false, width: strokeWidth };
  };

  // --- Utils ---

  const handleUndo = () => {
    if (bezierPhase !== 0) {
        setBezierPhase(0);
        setStartPoint(null);
        setCurrentPoint(null);
        setIsDrawing(false);
    } else {
        setStrokes(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setBezierPhase(0);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const generatePreview = (): string => {
    if (!canvasRef.current) return '';
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 100;
    tempCanvas.height = 100;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      // Draw background for preview consistency? No, keep transparent.
      ctx.drawImage(canvasRef.current, 0, 0, 100, 100);
    }
    return tempCanvas.toDataURL('image/png');
  };

  const handleSaveInternal = () => {
    const preview = generatePreview();
    onSave(strokes, preview);
  };

  const handleNextInternal = () => {
    const preview = generatePreview();
    onNext(strokes, preview);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col h-[90vh] md:h-auto">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-2xl font-bold text-white">
               {char}
             </div>
             <div>
               <h3 className="text-white font-bold">Desenhando caractere</h3>
               <p className="text-xs text-slate-400">
                   {activeTool === 'bucket' ? 'Toque na forma para preencher' :
                    activeTool === 'move' ? 'Arraste para mover o desenho' :
                    activeTool === 'scale' ? 'Arraste (Cima/Baixo) para redimensionar' :
                    activeTool === 'bezier' ? '1. Arraste a linha | 2. Arraste a curva' : 
                    activeTool === 'pen' ? 'Desenho livre' : 'Arraste para definir o tamanho'}
               </p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center touch-none">
          <canvas
            ref={canvasRef}
            width={500}
            height={500}
            className={`bg-slate-950 touch-none border border-slate-800 shadow-inner w-full h-auto max-w-[500px] max-h-[500px]
                ${activeTool === 'bucket' ? 'cursor-alias' : 
                  activeTool === 'move' ? 'cursor-move' : 
                  activeTool === 'scale' ? 'cursor-ns-resize' : 'cursor-crosshair'}
            `}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        <div className="p-4 bg-slate-800 border-t border-slate-700 space-y-4">
            
          {/* Toolbar Top Row: Tools */}
          <div className="flex justify-between items-center overflow-x-auto pb-2 gap-2">
             <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTool('pen')} 
                    className={`p-2 rounded transition-colors ${activeTool === 'pen' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} 
                    title="Lápis Livre"
                >
                  <PenTool className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setActiveTool('bezier')} 
                    className={`p-2 rounded transition-colors ${activeTool === 'bezier' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} 
                    title="Curva Bézier"
                >
                  <Spline className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setActiveTool('bucket')} 
                    className={`p-2 rounded transition-colors ${activeTool === 'bucket' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} 
                    title="Balde de Tinta"
                >
                  <PaintBucket className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setActiveTool('move')} 
                    className={`p-2 rounded transition-colors ${activeTool === 'move' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} 
                    title="Mover Desenho"
                >
                  <Move className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setActiveTool('scale')} 
                    className={`p-2 rounded transition-colors ${activeTool === 'scale' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} 
                    title="Redimensionar Desenho"
                >
                  <Maximize className="w-5 h-5" />
                </button>
             </div>

             <div className="flex gap-1 bg-slate-900 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTool('square')} 
                    className={`p-2 rounded transition-colors ${activeTool === 'square' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} 
                    title="Retângulo"
                >
                  <Square className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setActiveTool('triangle')} 
                    className={`p-2 rounded transition-colors ${activeTool === 'triangle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} 
                    title="Triângulo"
                >
                  <Triangle className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setActiveTool('circle')} 
                    className={`p-2 rounded transition-colors ${activeTool === 'circle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} 
                    title="Círculo"
                >
                  <Circle className="w-5 h-5" />
                </button>
             </div>
             
             <div className="flex gap-1 items-center">
                 <div className="h-8 w-px bg-slate-700 mx-1"></div>
                 <button 
                    onClick={() => setShowGuide(!showGuide)} 
                    className={`p-2 rounded transition-colors ${showGuide ? 'text-blue-400 bg-slate-900' : 'text-slate-500 hover:text-white'}`} 
                    title="Guia de Caractere (Sombra)"
                 >
                   {showGuide ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                 </button>
                 
                 {/* Botão de Importar SVG */}
                 <div className="relative">
                   <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded transition-colors text-purple-400 hover:text-white hover:bg-slate-700" 
                      title="Importar Vetor SVG"
                   >
                     <Upload className="w-5 h-5" />
                   </button>
                   <input 
                      type="file" 
                      accept=".svg" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleSvgUpload}
                   />
                 </div>
             </div>

             <div className="flex gap-1 items-center ml-2">
                <button onClick={handleUndo} className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-slate-300" title="Desfazer">
                  <Undo className="w-5 h-5" />
                </button>
                <button onClick={handleClear} className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-red-400" title="Limpar">
                  <Eraser className="w-5 h-5" />
                </button>
             </div>
          </div>

          {/* Toolbar Bottom Row: Stroke Size & Actions */}
          <div className="flex flex-col md:flex-row gap-4 items-center">
             
             {/* Slider de Espessura */}
             <div className="flex items-center gap-3 w-full md:w-auto bg-slate-900 px-4 py-2 rounded-xl border border-slate-700">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Traço</span>
                <Minus className="w-3 h-3 text-slate-500" />
                <input 
                  type="range" 
                  min="2" 
                  max="60" 
                  value={strokeWidth} 
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="w-full md:w-32 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <Plus className="w-3 h-3 text-slate-500" />
                <span className="text-xs font-mono text-blue-400 w-6 text-right">{strokeWidth}</span>
                {/* Visual Preview of Dot Size */}
                <div 
                    className="w-4 h-4 rounded-full bg-white ml-2 transition-all" 
                    style={{ transform: `scale(${strokeWidth / 20})` }}
                />
             </div>

             <div className="flex gap-2 w-full md:w-auto flex-1 justify-end">
                <button 
                  onClick={handleSaveInternal}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-colors text-sm"
                >
                  <Save className="w-4 h-4" />
                  Salvar
                </button>
                <button 
                  onClick={handleNextInternal}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors text-sm"
                >
                  {isLast ? "Finalizar" : "Salvar & Próximo"}
                  {!isLast && <ChevronRight className="w-4 h-4" />}
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};