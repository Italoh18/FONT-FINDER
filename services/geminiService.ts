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
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = base64Image.split(',')[1] || base64Image;

  const systemInstruction = `
    Você é um especialista em Tipografia e Design Gráfico.
    Sua tarefa é analisar imagens e identificar com precisão a fonte utilizada ou sugerir a alternativa mais próxima no Google Fonts.
    Analise características como peso, serifa, inclinação e proporções.
  `;

  const prompt = `
    Analise a imagem anexada para identificar a fonte.
    CONTEXTO DE FONTES LOCAIS DO USUÁRIO: ${knownFonts.length > 0 ? JSON.stringify(knownFonts) : "Nenhuma fonte local carregada."}
    
    Se a fonte na imagem for EXATAMENTE uma das fontes locais, retorne source="Local".
    Caso contrário, identifique a fonte comercial/web e sugira 4 alternativas gratuitas do Google Fonts.
    
    RETORNE APENAS UM OBJETO JSON VÁLIDO:
    {
      "detectedText": "Texto que você leu na imagem",
      "fontName": "Nome da Fonte Identificada",
      "source": "Local" ou "Web",
      "category": "Serif" | "Sans Serif" | "Display" | "Handwriting" | "Monospace",
      "visualStyle": "Descrição curta do estilo (ex: Bold Geometric, High Contrast)",
      "matchConfidence": "Alta" | "Média" | "Baixa",
      "description": "Explicação técnica rápida do porquê desta identificação",
      "similarFonts": ["Fonte 1", "Fonte 2", "Fonte 3", "Fonte 4"]
    }
  `;

  try {
    // Alterado para gemini-2.0-flash-exp para contornar limitações de cota do 2.5
    // Este modelo experimental costuma ter boa disponibilidade no tier gratuito
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
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
    if (!textResponse) throw new Error("A IA não retornou uma resposta válida.");

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
    if (error.message?.includes("API_KEY_MISSING")) {
        throw error;
    }
    
    // Tratamento específico para erro 429 (Too Many Requests)
    if (error.status === 429 || error.message?.toLowerCase().includes("quota") || error.message?.toLowerCase().includes("limit")) {
        throw new Error("Cota excedida para o modelo atual. Tente novamente em alguns instantes.");
    }
    
    throw new Error(error.message || "Erro ao processar a imagem.");
  }
};