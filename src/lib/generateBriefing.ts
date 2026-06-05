import { openai, SYSTEM_PROMPT } from './openai'
import { KeyIndicator, Top3AnalysisItem, HealthCheckItem, ConnectionItem, ArticleFullAnalysis } from '@/types'

interface BriefingAIResult {
  headline: string
  summary: string
  dailyTerm: { term: string; category: string; explanation: string }
  indicatorExplanations: { name: string; easyExplanation: string }[]
  top3Indices: number[]
  healthCheck: HealthCheckItem[]
  connections: ConnectionItem[]
}

// B1 + B3 + B4: 메인 브리핑 생성 (헤드라인, TOP3 선정, 건강진단, 연결관계 포함)
export async function generateMainBriefing(
  articles: { id: string; title: string }[],
  indicators: Omit<KeyIndicator, 'easyExplanation'>[]
): Promise<BriefingAIResult> {
  const indicatorList = indicators.length > 0
    ? indicators.map(i => `- ${i.name}: ${i.value} (전일 대비 ${i.change})`).join('\n')
    : '- 지표 데이터를 가져오지 못했습니다'

  const titleList = articles.slice(0, 25).map((a, i) => `${i}. ${a.title}`).join('\n')

  const prompt = `오늘의 경제 뉴스를 바탕으로 다음 내용을 JSON으로 생성해주세요.

## 오늘의 주요 지표
${indicatorList}

## 오늘의 주요 뉴스 (인덱스. 제목)
${titleList}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "headline": "오늘 한국 경제를 한 문장으로 요약한 헤드라인 (예: 미국 관세 충격에 코스피 2% 급락, 달러 강세 지속)",
  "summary": "오늘 경제 전체를 초보자 언어로 정리한 3~5문단 요약 글",
  "dailyTerm": {
    "term": "오늘 뉴스에서 가장 중요한 경제 용어 1개",
    "category": "금리|환율|주식|부동산|무역|경기|소비|통화 중 하나",
    "explanation": "그 용어를 초등학생도 이해할 수 있게 2~3문장으로 설명"
  },
  "indicatorExplanations": [
    { "name": "코스피", "easyExplanation": "오늘 수치를 바탕으로 초보자에게 1~2문장 설명" },
    { "name": "환율(원/달러)", "easyExplanation": "오늘 수치를 바탕으로 초보자에게 1~2문장 설명" },
    { "name": "코스닥", "easyExplanation": "오늘 수치를 바탕으로 초보자에게 1~2문장 설명" }
  ],
  "top3Indices": [0, 1, 2],
  "healthCheck": [
    { "category": "물가", "status": "warning", "summary": "밥값·전기료 등 생활물가가 계속 오르고 있어요" },
    { "category": "소비", "status": "normal", "summary": "..." },
    { "category": "수출", "status": "good", "summary": "..." },
    { "category": "고용", "status": "normal", "summary": "..." },
    { "category": "부동산", "status": "normal", "summary": "..." },
    { "category": "금융", "status": "warning", "summary": "..." }
  ],
  "connections": [
    { "from": "원인 키워드", "to": "결과 키워드" },
    { "from": "결과 키워드", "to": "파생 결과 키워드" }
  ]
}

규칙:
- status는 반드시 "good", "normal", "warning" 중 하나
- healthCheck는 반드시 6개 (물가·소비·수출·고용·부동산·금융 순서)
- top3Indices는 위 뉴스 목록에서 오늘 가장 중요한 기사 3개의 인덱스 (0-based)
- connections는 오늘 뉴스에서 가장 핵심적인 경제 흐름 3~5개 (짧은 키워드로)`

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

// B2: 기사별 간단 요약 (뉴스 카드용, 2~3문장)
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

// B2: TOP3 기사 6단계 과외 스타일 분석
export async function generateTop3Analysis(
  articles: { id: string; title: string }[]
): Promise<(ArticleFullAnalysis & { id: string })[]> {
  if (articles.length === 0) return []

  const articleList = articles.map(a => `{"id":"${a.id}","title":"${a.title}"}`).join('\n')

  const prompt = `다음 경제 뉴스 기사들을 경제 과외 선생님처럼 6단계로 깊이 설명해주세요.

기사 목록:
${articleList}

각 기사에 대해 아래 6단계로 설명하세요:
- oneline: 이 기사를 한 마디로 (15자 이내, 예: "금리 또 올랐다")
- whatHappened: 무슨 일이야? (초보자 언어로 2~3문장)
- whyHappened: 왜 이런 일이 생겼어? (원인 설명 2~3문장)
- myImpact: 나한테 어떤 영향이 있어? (실생활 연결 2~3문장)
- outlook: 앞으로 어떻게 될까? (전망 1~2문장)
- conclusion: 한 줄 결론 (10자 이내 핵심 메시지)

다음 JSON 형식으로만 응답하세요:
{
  "articles": [
    {
      "id": "기사id",
      "oneline": "한 마디 요약",
      "whatHappened": "무슨 일 설명",
      "whyHappened": "원인 설명",
      "myImpact": "내 생활 영향",
      "outlook": "앞으로 전망",
      "conclusion": "한 줄 결론"
    }
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

  const parsed = JSON.parse(res.choices[0].message.content ?? '{"articles":[]}')
  return (parsed.articles ?? []) as (ArticleFullAnalysis & { id: string })[]
}

// Top3AnalysisItem 배열로 변환 (DB 저장용)
export function buildTop3AnalysisData(
  top3Analyses: (ArticleFullAnalysis & { id: string })[],
  articles: { id: string; title: string }[]
): Top3AnalysisItem[] {
  return top3Analyses.map(analysis => ({
    articleId: analysis.id,
    title: articles.find(a => a.id === analysis.id)?.title ?? '',
    steps: {
      oneline: analysis.oneline,
      whatHappened: analysis.whatHappened,
      whyHappened: analysis.whyHappened,
      myImpact: analysis.myImpact,
      outlook: analysis.outlook,
      conclusion: analysis.conclusion,
    },
  }))
}
