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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  // Estratégia de Robustez:
  // 1. Tenta gemini-flash-latest (Modelo estável, cota alta)
  // 2. Se falhar, tenta gemini-2.0-flash-exp (Modelo experimental, cota separada)
  const modelsToTry = ['gemini-flash-latest', 'gemini-2.0-flash-exp'];
  const MAX_RETRIES = 3;
  let lastError: any;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: model,
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
        lastError = error;
        console.warn(`Tentativa ${attempt} com ${model} falhou:`, error.message);

        if (error.message?.includes("API_KEY_MISSING")) throw error;

        // Se for erro de quota (429) ou erro temporário de servidor (5xx)
        const isQuotaError = error.status === 429 || error.message?.toLowerCase().includes("quota") || error.message?.toLowerCase().includes("limit");
        const isServerError = error.status >= 500;

        if ((isQuotaError || isServerError) && attempt < MAX_RETRIES) {
            // Backoff exponencial simples: 2s, 4s...
            const delay = 2000 * attempt;
            await wait(delay);
            continue;
        }
        
        // Se não for recuperável ou acabaram as tentativas deste modelo, para o loop interno
        break;
      }
    }
    // Se teve sucesso, o return já aconteceu. Se chegou aqui, tenta o próximo modelo.
  }

  // Se falhou com todos os modelos e todas as tentativas
  if (lastError?.status === 429 || lastError?.message?.toLowerCase().includes("quota")) {
      throw new Error("Sistema sobrecarregado (Limite de Cota). Aguarde 1 minuto e tente novamente.");
  }
  
  throw new Error(lastError?.message || "Erro ao processar a imagem. Tente novamente.");
};