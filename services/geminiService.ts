import { GoogleGenAI } from "@google/genai";
import { FontAnalysis } from "../types";

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
  // Inicializa a IA usando a chave de ambiente padrão
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = base64Image.split(',')[1] || base64Image;

  const systemInstruction = `
    Você é um especialista em Tipografia Digital.
    Sua missão é identificar a fonte de uma imagem.
    Analise a imagem e compare com as fontes locais se houver contexto.
  `;

  const prompt = `
    Analise a imagem anexada.
    CONTEXTO (Fontes do Usuário): ${knownFonts.length > 0 ? JSON.stringify(knownFonts) : "Nenhum arquivo enviado."}
    
    Identifique a fonte e sugira 4 similares do Google Fonts.
    
    RETORNE APENAS JSON NO FORMATO:
    {
      "detectedText": "Texto extraído",
      "fontName": "Nome da Fonte",
      "source": "Local" ou "Web",
      "category": "Serif" | "Sans Serif" | "Display" | "Handwriting" | "Monospace",
      "visualStyle": "Descrição breve",
      "matchConfidence": "Alta" | "Média" | "Baixa",
      "description": "Explicação técnica",
      "similarFonts": ["Fonte 1", "Fonte 2", "Fonte 3", "Fonte 4"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const textResponse = response.text;
    if (!textResponse) throw new Error("Resposta vazia da IA.");

    const parsedData = JSON.parse(cleanJsonString(textResponse));

    return {
      fontName: parsedData.fontName || "Desconhecida",
      detectedText: parsedData.detectedText || "Aa",
      category: parsedData.category || "Display",
      visualStyle: parsedData.visualStyle || "",
      matchConfidence: parsedData.matchConfidence || "Baixa",
      description: parsedData.description || "Análise concluída.",
      similarFonts: Array.isArray(parsedData.similarFonts) ? parsedData.similarFonts : [],
      source: parsedData.source === 'Local' ? 'Local' : 'Web'
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Erro ao conectar com a IA. Verifique sua API Key.");
  }
};