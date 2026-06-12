import { openai, SYSTEM_PROMPT } from './openai'
import { KeyIndicator, Top3AnalysisItem, HealthCheckItem, ConnectionItem, ArticleFullAnalysis } from '@/types'

interface BriefingAIResult {
  headline: string
  summary: string
  shareCard: string
  dailyTerm: { term: string; category: string; explanation: string }
  indicatorExplanations: { name: string; easyExplanation: string }[]
  top3Indices: number[]
  healthCheck: HealthCheckItem[]
  connections: ConnectionItem[]
}

export interface BriefingResult extends BriefingAIResult {
  candidateArticles: { id: string; title: string }[]
}

// B1 + B3 + B4: 메인 브리핑 생성 (헤드라인, TOP3 선정, 건강진단, 연결관계 포함)
export async function generateMainBriefing(
  articles: { id: string; title: string }[],
  indicators: Omit<KeyIndicator, 'easyExplanation'>[],
  recentTerms: string[] = []
): Promise<BriefingResult> {
  const indicatorList = indicators.length > 0
    ? indicators.map(i => `- ${i.name}: ${i.value} (전일 대비 ${i.change})`).join('\n')
    : '- 지표 데이터를 가져오지 못했습니다'

  // 한국 경제 관련 기사 우선 정렬 (외신·미국 뉴스는 뒤로)
  const foreignKeywords = ['미국', '미 ', '美 ', '美국', '연준', 'Fed ', '중국', '中 ', '일본', '日 ', '유럽', '월가', '나스닥', '다우', 'S&P', '뉴욕증시']
  const koreanFirst = [...articles].sort((a, b) => {
    const aForeign = foreignKeywords.some(k => a.title.includes(k)) ? 1 : 0
    const bForeign = foreignKeywords.some(k => b.title.includes(k)) ? 1 : 0
    return aForeign - bForeign
  })
  const candidateArticles = koreanFirst.slice(0, 30)
  const titleList = candidateArticles.map((a, i) => `${i}. ${a.title}`).join('\n')
  const avoidTerms = recentTerms.length > 0
    ? ` (최근 7일간 이미 다룬 용어는 피하세요: ${recentTerms.join(', ')})`
    : ''

  const prompt = `당신은 한국 경제 전문 브리핑 서비스입니다. 오늘의 한국 경제 뉴스를 바탕으로 다음 내용을 JSON으로 생성해주세요.

## 오늘의 주요 지표
${indicatorList}

## 오늘의 주요 뉴스 (인덱스. 제목)
${titleList}

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "headline": "오늘 핵심 사건 한 줄\\n결과·영향 한 줄 (두 줄을 \\n으로 구분, 구어체 ~했어요 형식. 첫 줄은 반드시 18자 이내 짧게. 예: '코스피가 크게 떨어졌어요\\n환율이 오르면서 생활물가 압박이 커졌어요')",
  "summary": "오늘 경제 전체를 초보자 언어로 정리한 3~5문단 요약 글",
  "shareCard": "경제를 전혀 모르는 친구에게 카카오톡으로 보내는 오늘의 한 줄 (20~40자, 숫자보다 의미 중심, headline과 다른 내용. 예: '오늘 주식이 올랐어요 — 외국인들이 올해 들어 가장 많이 산 날이에요')",
  "dailyTerm": {
    "term": "오늘 뉴스와 관련 있는 경제 용어 1개${avoidTerms}",
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
- 이 서비스는 한국 경제 전문입니다. 헤드라인·TOP3·healthCheck 모두 한국 경제 상황을 중심으로 작성하세요
- 미국·중국 등 해외 뉴스는 한국 경제에 직접 영향을 줄 때만 언급하고, 단독 TOP3로 선정하지 마세요
- status는 반드시 "good", "normal", "warning" 중 하나
- healthCheck는 반드시 6개 (물가·소비·수출·고용·부동산·금융 순서)
- top3Indices는 위 뉴스 목록의 앞 숫자(인덱스)를 3개 선정. 예: 0번 기사 선택 시 0. 미국·중국·일본·유럽 등 해외 경제 뉴스는 절대 TOP3에 넣지 마세요. 한국 기업·증시·부동산·정책·소비·고용 관련 기사를 우선하세요
- connections는 오늘 한국 경제에서 가장 핵심적인 흐름 3~5개 (짧은 키워드로)`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const parsed = JSON.parse(res.choices[0].message.content ?? '{}') as BriefingAIResult
  return { ...parsed, candidateArticles }
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
  }, { timeout: 100_000 }) // 요약은 건수가 많아 출력이 길다 — 기본 60초로는 정상 응답도 끊길 수 있음

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
