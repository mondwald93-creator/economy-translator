import Anthropic from '@anthropic-ai/sdk'

// 기사 해설 쓰기(analyzeWithBody) 전용 — 2026-10-13 신설
// 키가 없으면 null을 돌려주고, 호출하는 쪽이 OpenAI로 대신 쓴다(발행을 막지 않음).
// timeout/maxRetries: openai.ts와 같은 이유. 외부 지연 1건이 Vercel 5분 제한 전체를 소진하지 않게.
export const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 100_000, maxRetries: 1 })
  : null
