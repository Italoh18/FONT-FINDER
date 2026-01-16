import opentype from 'opentype.js';
import * as martinez from 'martinez-polygon-clipping';
import { GlyphMap, Stroke, Point } from '../types';

// Configurações da fonte
const UNITS_PER_EM = 1000;
const ASCENDER = 800;
const DESCENDER = -200;
const CANVAS_SIZE = 500;
const STROKE_WIDTH_CANVAS = 15;

const FONT_SCALE = UNITS_PER_EM / CANVAS_SIZE;

// Transforma coordenadas do Canvas (Y para baixo) para Fonte (Y para cima)
const transformCoordinate = (val: number, isY: boolean): number => {
  if (isY) {
    const baselineY = CANVAS_SIZE * 0.8;
    return (baselineY - val) * FONT_SCALE;
  }
  return val * FONT_SCALE;
};

// --- Funções Geométricas Auxiliares ---

const add = (p1: Point, p2: Point): Point => ({ x: p1.x + p2.x, y: p1.y + p2.y });
const sub = (p1: Point, p2: Point): Point => ({ x: p1.x - p2.x, y: p1.y - p2.y });
const mul = (p: Point, s: number): Point => ({ x: p.x * s, y: p.y * s });
const normalize = (p: Point): Point => {
  const len = Math.sqrt(p.x * p.x + p.y * p.y);
  return len === 0 ? { x: 0, y: 0 } : { x: p.x / len, y: p.y / len };
};
const perp = (p: Point): Point => ({ x: -p.y, y: p.x });

/**
 * Expande uma linha (stroke) em um polígono fechado (outline points).
 * Retorna Array de Points no sistema de coordenadas do CANVAS.
 */
const getStrokeOutline = (points: Point[], width: number, isClosed: boolean): Point[] => {
  if (points.length < 2) return [];

  const halfWidth = width / 2;
  const leftSide: Point[] = [];
  const rightSide: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    let normal: Point = { x: 0, y: 0 };
    
    // Vetor anterior
    if (i > 0) {
      const vPrev = normalize(sub(points[i], points[i-1]));
      normal = add(normal, perp(vPrev));
    }
    
    // Vetor seguinte
    if (i < points.length - 1) {
      const vNext = normalize(sub(points[i+1], points[i]));
      normal = add(normal, perp(vNext));
    } else if (isClosed && i === points.length - 1) {
       // Fechamento suave
       const vNext = normalize(sub(points[1], points[0])); 
       normal = add(normal, perp(vNext));
    }

    normal = normalize(normal);
    if (normal.x === 0 && normal.y === 0) normal = {x: 1, y: 0}; // Fallback

    const p = points[i];
    leftSide.push(add(p, mul(normal, halfWidth)));
    rightSide.push(sub(p, mul(normal, halfWidth)));
  }

  // Montar polígono fechado (sentido anti-horário no canvas visual)
  const polygon = [...leftSide];
  for (let i = rightSide.length - 1; i >= 0; i--) {
    polygon.push(rightSide[i]);
  }
  
  // Fechar o loop explicitamente
  if (polygon.length > 0) {
      const first = polygon[0];
      const last = polygon[polygon.length - 1];
      if (first.x !== last.x || first.y !== last.y) {
          polygon.push(first);
      }
  }

  return polygon;
};

const getBezierPoints = (p0: Point, p1: Point, p2: Point): Point[] => {
  const segments = 20;
  const points: Point[] = [];
  for(let i=0; i<=segments; i++) {
    const t = i / segments;
    const invT = 1 - t;
    const x = (invT * invT * p0.x) + (2 * invT * t * p1.x) + (t * t * p2.x);
    const y = (invT * invT * p0.y) + (2 * invT * t * p1.y) + (t * t * p2.y);
    points.push({x, y});
  }
  return points;
};

/**
 * Converte um Stroke do app em um Formato GeoJSON Polygon para a biblioteca Martinez.
 * Formato: [[[x,y], [x,y], ...]] (Array de Aneis, onde o primeiro é o externo)
 */
const strokeToGeoJsonPolygon = (stroke: Stroke): number[][][] | null => {
    let points: Point[] = [];

    // 1. Obter os pontos brutos ou expandidos
    if (stroke.filled) {
        // Se é uma forma preenchida, usamos os pontos diretos
        if (stroke.type === 'bezier' && stroke.points.length === 3) {
            // Bezier preenchido (raro na UI atual, mas suportado)
            points = getBezierPoints(stroke.points[0], stroke.points[1], stroke.points[2]);
            points.push(points[0]); 
        } else {
            points = [...stroke.points];
            if (points.length > 0) {
                const first = points[0];
                const last = points[points.length -1];
                if (first.x !== last.x || first.y !== last.y) {
                    points.push(first);
                }
            }
        }
    } else {
        // Se é um traço (outline), precisamos expandir para criar espessura
        // USA A ESPESSURA DEFINIDA NO STROKE OU O PADRÃO
        const strokeWidth = stroke.width || STROKE_WIDTH_CANVAS;

        let basePathPoints = stroke.points;
        if (stroke.type === 'bezier' && stroke.points.length === 3) {
            basePathPoints = getBezierPoints(stroke.points[0], stroke.points[1], stroke.points[2]);
        }
        points = getStrokeOutline(basePathPoints, strokeWidth, !!stroke.isClosed);
    }

    if (points.length < 3) return null;

    // Converter para array de coordenadas [x, y]
    const coords = points.map(p => [p.x, p.y]);
    
    // GeoJSON Polygon structure: [ [ [x,y]... ] ]
    return [coords];
};

export const generateTTF = async (fontName: string, glyphs: GlyphMap): Promise<ArrayBuffer> => {
  const notdefPath = new opentype.Path();
  notdefPath.moveTo(200, 0);
  notdefPath.lineTo(200, 700);
  notdefPath.lineTo(600, 700);
  notdefPath.lineTo(600, 0);
  notdefPath.close();
  
  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: 800,
    path: notdefPath
  });

  const fontGlyphs = [notdefGlyph];

  Object.values(glyphs).forEach(data => {
    if (data.strokes.length === 0) return;

    // Geometria acumulada (MultiPolygon)
    let combinedGeometry: any = []; 

    data.strokes.forEach(stroke => {
        const poly = strokeToGeoJsonPolygon(stroke);
        if (poly) {
            if (combinedGeometry.length === 0) {
                combinedGeometry = [poly]; 
            } else {
                try {
                    combinedGeometry = martinez.union(combinedGeometry, [poly]);
                } catch (e) {
                    console.error("Erro na união geométrica:", e);
                    combinedGeometry.push(poly);
                }
            }
        }
    });

    // Converter geometria unificada de volta para OpenType Path
    const finalPath = new opentype.Path();

    if (Array.isArray(combinedGeometry)) {
        combinedGeometry.forEach((polygon: any) => {
            if (Array.isArray(polygon)) {
                polygon.forEach((ring: any) => {
                    if (Array.isArray(ring) && ring.length > 0) {
                        const start = { x: ring[0][0], y: ring[0][1] };
                        const startT = { 
                            x: transformCoordinate(start.x, false), 
                            y: transformCoordinate(start.y, true) 
                        };
                        
                        finalPath.moveTo(startT.x, startT.y);

                        for (let i = 1; i < ring.length; i++) {
                            const p = { x: ring[i][0], y: ring[i][1] };
                            const ptT = {
                                x: transformCoordinate(p.x, false),
                                y: transformCoordinate(p.y, true)
                            };
                            finalPath.lineTo(ptT.x, ptT.y);
                        }
                        finalPath.close();
                    }
                });
            }
        });
    }
    
    const advanceWidth = UNITS_PER_EM * 0.6;

    const glyph = new opentype.Glyph({
      name: data.char,
      unicode: data.char.charCodeAt(0),
      advanceWidth: advanceWidth,
      path: finalPath
    });

    fontGlyphs.push(glyph);
  });

  const font = new opentype.Font({
    familyName: fontName || 'MyCustomFont',
    styleName: 'Regular',
    unitsPerEm: UNITS_PER_EM,
    ascender: ASCENDER,
    descender: DESCENDER,
    glyphs: fontGlyphs
  });

  return font.toArrayBuffer();
};