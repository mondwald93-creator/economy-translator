import OpenAI from 'openai'

// timeout/maxRetries: 외부 지연 1건이 Vercel 5분 제한 전체를 소진하지 않게 (SDK 기본값은 10분 대기)
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60_000,
  maxRetries: 1,
})

export const SYSTEM_PROMPT = `당신은 경제 뉴스를 초보자도 이해할 수 있게 설명하는 전문가입니다.
주식, 환율, 금리 등 경제 용어를 전혀 모르는 사람도 이해할 수 있도록,
친근하고 쉬운 언어로 설명합니다.
비유와 일상 예시를 자주 사용하고, 어려운 용어는 반드시 괄호로 설명을 추가합니다.`
