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

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = base64Image.split(',')[1] || base64Image;

  // Instrução de sistema focada em neutralidade e precisão
  const systemInstruction = `
    Você é um Tipógrafo Forense imparcial.
    Sua prioridade absoluta é a precisão visual.
    NUNCA force uma correspondência com a biblioteca local se a fonte não for VISUALMENTE IDÊNTICA.
    É melhor sugerir uma fonte da Web correta do que uma fonte Local errada.
  `;

  // Prompt estruturado para eliminar viés de confirmação
  const prompt = `
    Analise a imagem e identifique a fonte.

    LISTA DE VERIFICAÇÃO (Fontes enviadas pelo usuário): ${knownFonts.length > 0 ? JSON.stringify(knownFonts) : "Nenhuma."}

    PROTOCOLO DE ANÁLISE RIGOROSO:
    1.  Esqueça a lista de verificação inicialmente. Olhe APENAS para a imagem.
    2.  Identifique as características: Serifas, contraste, eixo, "a" minúsculo, "g" minúsculo.
    3.  AGORA, compare com a "LISTA DE VERIFICAÇÃO":
        - A fonte da imagem é EXATAMENTE igual a alguma da lista? (Considere espessura, terminais, estilo).
        - Se a imagem for "Arial" e a lista tiver "Times New Roman", NÃO É MATCH. Ignore a lista.
        - Se a imagem for "Brush Script" e a lista tiver "Abnes" (que é brush), elas são IDÊNTICAS nos detalhes? Se não, ignore a lista.

    4.  SELEÇÃO:
        - Se houver match visual exato (>98%) na lista local: Use o nome da lista e source="Local".
        - Caso contrário: Identifique a fonte real (Web/Comercial) e source="Web".

    5.  FONTES SIMILARES (Crucial para visualização):
        - Liste 4 fontes alternativas que sejam visualmente parecidas.
        - **IMPORTANTE:** Estas fontes similares DEVEM estar disponíveis no **GOOGLE FONTS** para que o preview funcione na interface.

    Retorne JSON:
    {
      "detectedText": "Texto da imagem (max 15 chars)",
      "fontName": "Nome da Fonte Identificada (Seja honesto, não force a local)",
      "source": "Local" ou "Web",
      "category": "Serif" | "Sans Serif" | "Display" | "Handwriting" | "Monospace",
      "visualStyle": "Descrição técnica (ex: 'Pincelada orgânica com textura seca')",
      "matchConfidence": "Alta" | "Média" | "Baixa",
      "description": "Explique a decisão. Se rejeitou a lista local, diga o porquê (ex: 'A fonte da imagem tem serifas, enquanto as locais não têm').",
      "similarFonts": ["Google Font 1", "Google Font 2", "Google Font 3"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
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
        temperature: 0.2 // Temperatura muito baixa para reduzir alucinações
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
      fontName: parsedData.fontName || "Fonte Desconhecida",
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
    throw error;
  }
};