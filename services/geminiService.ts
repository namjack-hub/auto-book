import { GoogleGenAI, Type } from "@google/genai";
import { Book, GeminiAnalysis } from '../types';

export const analyzeAcquisitionList = async (books: Book[]): Promise<GeminiAnalysis> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured.");
  }

  if (books.length === 0) {
     return {
        summary: "선택된 도서가 없습니다.",
        budgetAnalysis: "0원",
        categoryBreakdown: "없음",
        recommendationScore: 0
     };
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const bookSummaries = books.map(b => `- ${b.title} (저자: ${b.author}, 가격: ${b.priceSales}원, 분야: ${b.categoryName}): ${b.description.substring(0, 50)}...`).join('\n');
  
  const prompt = `
    당신은 전문 도서관 사서입니다. 다음은 수서(구입) 예정인 도서 목록입니다.
    이 목록을 분석하여 구매 정당성 보고서를 작성해주세요.
    
    도서 목록:
    ${bookSummaries}
    
    다음 항목들을 포함해야 합니다:
    1. 구입 목록 요약 및 선정 이유 (트렌드 반영 등)
    2. 예산 효율성 분석
    3. 주제별 분포 분석
    4. 추천 점수 (100점 만점)
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "구입 목록 요약 및 선정 이유" },
            budgetAnalysis: { type: Type.STRING, description: "예산 효율성 분석" },
            categoryBreakdown: { type: Type.STRING, description: "주제별 분포 분석" },
            recommendationScore: { type: Type.NUMBER, description: "1-100 사이의 추천 점수" }
          },
          required: ["summary", "budgetAnalysis", "categoryBreakdown", "recommendationScore"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as GeminiAnalysis;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw new Error("AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }
};