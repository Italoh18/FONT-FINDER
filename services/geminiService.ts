import { GoogleGenAI } from "@google/genai";
import { FontAnalysis } from "../types";

// Helper to clean JSON string if the model wraps it in markdown
const cleanJsonString = (str: string): string => {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
};

export const identifyFontFromImage = async (base64Image: string, knownFonts: string[] = []): Promise<FontAnalysis> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }

  // Upgrade para gemini-3-pro-preview para maior capacidade de raciocínio visual e precisão
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Remove header if present (e.g., "data:image/jpeg;base64,")
  const base64Data = base64Image.split(',')[1] || base64Image;

  // Instrução de sistema para definir a persona de especialista sênior
  const systemInstruction = `
    Você é um Tipógrafo Sênior e Engenheiro de Fontes com vasta experiência em anatomia tipográfica.
    Sua missão é identificar fontes com precisão cirúrgica, analisando micro-detalhes como terminais, serifa, eixo, contraste e altura-x.
    Nunca responda que uma fonte "não foi encontrada". Sempre encontre a correspondência mais próxima possível.
  `;

  const prompt = `
    Realize uma análise forense da tipografia nesta imagem.

    CONTEXTO LOCAL (Arquivos do Usuário): ${knownFonts.length > 0 ? JSON.stringify(knownFonts) : "Nenhum."}

    PROTOCOLO DE IDENTIFICAÇÃO:

    1. ANÁLISE VISUAL PROFUNDA:
       - Observe os terminais (arredondados, quadrados, angulares?).
       - Analise o "a" minúsculo (binocular ou monocular?) e o "g" (binocular ou monocular?).
       - Verifique o contraste (diferença entre traços finos e grossos).
       - Identifique o estilo histórico (Humanista, Geométrica, Grotesca, Didone, Slab, etc.).

    2. VERIFICAÇÃO CRUZADA LOCAL:
       - Compare as características visuais extraídas com os nomes na lista de "CONTEXTO LOCAL".
       - Se houver uma correspondência visual PROVÁVEL com um nome da lista (ex: imagem parece Helvetica e lista tem "Helvetica-Bold"), SELECIONE A FONTE LOCAL.
       - Defina "source": "Local".

    3. BUSCA GLOBAL (Se não houver match local):
       - Busque no seu vasto conhecimento a fonte comercial ou gratuita (Google Fonts) que melhor corresponde aos detalhes anatômicos observados.
       - Defina "source": "Web".

    SAÍDA ESPERADA (JSON Puro):
    {
      "detectedText": "Texto exato da imagem (max 15 chars)",
      "fontName": "Nome Preciso da Família Tipográfica",
      "source": "Local" ou "Web",
      "category": "Classificação Técnica (ex: Sans-Serif Geométrica)",
      "visualStyle": "Descrição técnica detalhada dos traços e personalidade da fonte.",
      "matchConfidence": "Alta" | "Média" | "Baixa",
      "description": "Justificativa técnica explicando por que esta fonte é o match perfeito, citando detalhes específicos (ex: 'O terminal aberto do 'e' e a cauda curvada do 'R' são característicos desta fonte').",
      "similarFonts": ["Alternativa 1", "Alternativa 2", "Alternativa 3", "Alternativa 4"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2 // Temperatura baixa para respostas mais determinísticas e precisas
      }
    });

    const textResponse = response.text;
    
    if (!textResponse) {
      throw new Error("Não foi possível obter uma resposta da IA.");
    }

    const cleanedJson = cleanJsonString(textResponse);
    let parsedData;
    try {
        parsedData = JSON.parse(cleanedJson);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        throw new Error("Erro ao interpretar resposta da IA.");
    }

    return {
      fontName: parsedData.fontName || "Fonte Similar",
      detectedText: parsedData.detectedText || "Preview",
      category: parsedData.category || "Geral",
      visualStyle: parsedData.visualStyle || "",
      matchConfidence: parsedData.matchConfidence || "Baixa",
      description: parsedData.description || "Sem descrição disponível.",
      similarFonts: Array.isArray(parsedData.similarFonts) ? parsedData.similarFonts : [],
      source: parsedData.source === 'Local' ? 'Local' : 'Web'
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};