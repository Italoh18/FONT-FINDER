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

  const systemInstruction = `
    Você é um especialista em Tipografia Digital e Forense.
    Sua missão é identificar a fonte exata de uma imagem.
    Você é extremamente cético. Você NÃO adivinha. Você compara evidências visuais.
  `;

  // Prompt desenhado para quebrar o viés de confirmação da lista local
  const prompt = `
    Analise a imagem anexada.

    CONTEXTO (Arquivos do Usuário): ${knownFonts.length > 0 ? JSON.stringify(knownFonts) : "Nenhum arquivo enviado."}

    PASSO 1: ANÁLISE VISUAL PURA
    - Extraia o texto visível.
    - Identifique traços chave: Serifa, altura-x, contraste, estilo (Script, Sans, etc).

    PASSO 2: AUDITORIA DA LISTA LOCAL
    - Para cada fonte listada em "CONTEXTO", pergunte: "Esta fonte é IDÊNTICA à da imagem?"
    - CUIDADO: Se a imagem é "Script" e o usuário tem uma fonte "Script" na lista, NÃO assuma que são a mesma.
    - Verifique glifos específicos. Se o 'g' ou 'a' ou 'r' for diferente, REJEITE a fonte local.
    - Se a fonte local for rejeitada, ignore-a completamente.

    PASSO 3: IDENTIFICAÇÃO FINAL
    - Se houve um match local perfeito (100% idêntico): Retorne o nome local e source="Local".
    - Se NÃO houve: Identifique a melhor correspondência no mercado global (Google Fonts, Adobe, etc) e defina source="Web".

    PASSO 4: ALTERNATIVAS VISUAIS (Obrigatório)
    - Liste 4 fontes SIMILARES que existam no **Google Fonts**.
    - Isso é crucial para que o usuário possa visualizar a comparação na interface.

    FORMATO JSON:
    {
      "detectedText": "Texto da imagem",
      "fontName": "Nome da Fonte Identificada",
      "source": "Local" ou "Web",
      "category": "Serif" | "Sans Serif" | "Display" | "Handwriting" | "Monospace",
      "visualStyle": "Ex: 'Traço orgânico de pincel seco, alto contraste'",
      "matchConfidence": "Alta" | "Média" | "Baixa",
      "description": "Explicação detalhada. Se rejeitou fontes locais, explique a diferença visual encontrada.",
      "similarFonts": ["Google Font 1", "Google Font 2", "Google Font 3", "Google Font 4"]
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
        temperature: 0.1, // Temperatura mínima para máxima precisão e menor alucinação
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