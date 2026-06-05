import { openai, SYSTEM_PROMPT } from './openai'
import { KeyIndicator } from '@/types'

interface BriefingAIResult {
  summary: string
  dailyTerm: {
    term: string
    explanation: string
  }
  indicatorExplanations: { name: string; easyExplanation: string }[]
}

export async function generateMainBriefing(
  articleTitles: string[],
  indicators: Omit<KeyIndicator, 'easyExplanation'>[]
): Promise<BriefingAIResult> {
  const indicatorList = indicators.length > 0
    ? indicators.map(i => `- ${i.name}: ${i.value} (전일 대비 ${i.change})`).join('\n')
    : '- 지표 데이터를 가져오지 못했습니다'

  const titleList = articleTitles.slice(0, 25).map((t, i) => `${i + 1}. ${t}`).join('\n')

  const prompt = `오늘의 경제 뉴스를 바탕으로 다음 내용을 JSON으로 생성해주세요.

## 오늘의 주요 지표
${indicatorList}

## 오늘의 주요 뉴스 제목
${titleList}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "summary": "오늘 경제 전체를 초보자 언어로 정리한 3~5문단 요약 글",
  "dailyTerm": {
    "term": "오늘 뉴스에서 가장 중요한 경제 용어 1개",
    "explanation": "그 용어를 초등학생도 이해할 수 있게 2~3문장으로 설명"
  },
  "indicatorExplanations": [
    { "name": "코스피", "easyExplanation": "오늘 수치를 바탕으로 초보자에게 1~2문장 설명" },
    { "name": "환율(원/달러)", "easyExplanation": "오늘 수치를 바탕으로 초보자에게 1~2문장 설명" },
    { "name": "코스닥", "easyExplanation": "오늘 수치를 바탕으로 초보자에게 1~2문장 설명" }
  ]
}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  return JSON.parse(res.choices[0].message.content ?? '{}') as BriefingAIResult
}

export async function generateArticleSummaries(
  articles: { id: string; title: string }[]
): Promise<{ id: string; summary: string }[]> {
  if (articles.length === 0) return []

  const articleList = articles.map(a => `{"id":"${a.id}","title":"${a.title}"}`).join('\n')

  const prompt = `다음 경제 뉴스 기사 제목들을 경제를 전혀 모르는 초보자가 이해할 수 있게 각각 2~3문장으로 설명해주세요.

기사 목록:
${articleList}

다음 JSON 형식으로만 응답하세요:
{"articles": [{"id": "기사id", "summary": "초보자용 2~3문장 설명"}]}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const parsed = JSON.parse(res.choices[0].message.content ?? '{"articles":[]}')
  return (parsed.articles ?? []) as { id: string; summary: string }[]
}
