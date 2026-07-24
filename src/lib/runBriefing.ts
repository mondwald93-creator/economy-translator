import { supabaseAdmin as supabase } from './supabaseAdmin'
import { getMarketIndicators } from './marketData'
import {
  generateMainBriefing,
  generateCategoryNews,
  generateTop3Analysis,
  buildTop3AnalysisData,
} from './generateBriefing'
import { filterCandidatePool } from './articleGate'

// 관문 신선도 기준(발행 후 이 일수 초과 시 후보 제외).
// ⚠️ 잠정값 — published_at 실데이터가 며칠 쌓이면 실분포 보고 확정(2026-07-24).
const GATE_STALE_DAYS = 3

export async function runDailyBriefing({ regenerate = false }: { regenerate?: boolean } = {}) {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

  // 하루 한 번만 발행: 오늘 브리핑이 이미 완성돼 있으면 다시 만들지 않고 그대로 둔다.
  // (아침에 두 번 도는 구조에서 나중 실행이 먼저 것을 덮어써 내용이 바뀌던 문제 방지)
  // 수동 재생성(regenerate:true)일 때만 이 잠금을 건너뛴다.
  if (!regenerate) {
    const { data: existing } = await supabase
      .from('briefings')
      .select('headline')
      .eq('date', today)
      .maybeSingle()
    if (existing?.headline) {
      return { date: today, generated: false, skipped: '오늘 브리핑이 이미 있어 재생성하지 않음' }
    }
  }

  const { data: articles, error: fetchError } = await supabase
    .from('news_articles')
    .select('id, title, summary, published_at')
    .eq('date', today)
    .order('created_at', { ascending: false })

  if (fetchError) throw new Error(fetchError.message)
  if (!articles || articles.length === 0) {
    throw new Error('오늘 수집된 뉴스가 없습니다. 먼저 뉴스 수집이 완료되어야 합니다.')
  }

  // 후보 풀 관문: AI(헤드라인·TOP3·분야별)에게 넘기기 전에 오래된·연성·의견글 기사를 거른다.
  // 여기가 generateMainBriefing과 generateCategoryNews "둘 다"의 상류라 한 곳에서 막힌다.
  const gate = filterCandidatePool(
    articles.map(a => ({ id: a.id, title: a.title, published_at: a.published_at ?? null })),
    { staleDays: GATE_STALE_DAYS }
  )
  // 안전장치: 관문이 과하게 걸러 후보가 부족하면(데이터 이상 등) 원본을 그대로 쓴다 — 빈 브리핑 방지.
  const useGated = gate.kept.length >= 30
  const articleInputs = (useGated ? gate.kept : articles).map(a => ({ id: a.id, title: a.title }))
  console.log(`[runBriefing] 후보 관문: ${articles.length}건 → 통과 ${gate.kept.length}건 (제외 ${gate.dropped.length}건: ` +
    `신선도 ${gate.dropped.filter(d => d.reason === 'stale').length}·` +
    `연성 ${gate.dropped.filter(d => d.reason === 'lifestyle').length}·` +
    `의견글 ${gate.dropped.filter(d => d.reason === 'opinion').length})` +
    (useGated ? '' : ' ⚠️통과<30 → 원본 사용'))

  const sevenDaysAgo = new Date(Date.now() + 9 * 60 * 60 * 1000 - 7 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  const { data: recentBriefings } = await supabase
    .from('briefings')
    .select('daily_term')
    .gte('date', sevenDaysAgo)
    .lt('date', today)
  const recentTerms = (recentBriefings ?? [])
    .map(b => {
      try {
        const t = typeof b.daily_term === 'string' ? JSON.parse(b.daily_term) : b.daily_term
        return t?.term ?? ''
      } catch { return '' }
    })
    .filter(Boolean) as string[]

  const indicators = await getMarketIndicators()
  const briefingResult = await generateMainBriefing(articleInputs, indicators, recentTerms)

  const top3Articles = (briefingResult.top3Indices ?? [])
    .slice(0, 3)
    .map(idx => briefingResult.candidateArticles[idx])
    .filter((a): a is { id: string; title: string } => !!a)

  // 홈 목록용 = 분야별(6개) 대표 기사 1개씩 선정 + 분석 / TOP3 = 별도 하이라이트 분석
  const [categoryNews, top3Analyses] = await Promise.all([
    generateCategoryNews(articleInputs),
    generateTop3Analysis(top3Articles),
  ])

  const fullIndicators = indicators.map(ind => ({
    ...ind,
    easyExplanation:
      briefingResult.indicatorExplanations?.find(e => e.name === ind.name)?.easyExplanation ?? '',
  }))

  // TOP3 먼저 저장 → 분야 대표와 겹치는 기사가 있으면 아래에서 category까지 덮어쓰도록 순서 보장
  if (top3Analyses.length > 0) {
    const results = await Promise.all(
      top3Analyses.map(a =>
        supabase.from('news_articles').update({
          full_analysis: {
            oneline: a.oneline,
            whatHappened: a.whatHappened,
            whyHappened: a.whyHappened,
            myImpact: a.myImpact,
            outlook: a.outlook,
            conclusion: a.conclusion,
          },
        }).eq('id', a.id)
      )
    )
    // 조용한 실패 방지: update 오류를 그냥 넘기지 않고 로그로 드러낸다 (발행 흐름은 막지 않음)
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      console.error(`[runBriefing] TOP3 기사 상세(full_analysis) 저장 실패 ${failed.length}/${top3Analyses.length}건:`, failed.map(r => r.error?.message))
    }
  }

  // 분야별 대표 기사: full_analysis에 category 꼬리표 포함 저장 (홈 목록이 이걸로 골라 뿌림)
  if (categoryNews.length > 0) {
    const results = await Promise.all(
      categoryNews.map(a =>
        supabase.from('news_articles').update({
          full_analysis: {
            category: a.category,
            oneline: a.oneline,
            whatHappened: a.whatHappened,
            whyHappened: a.whyHappened,
            myImpact: a.myImpact,
            outlook: a.outlook,
            conclusion: a.conclusion,
          },
        }).eq('id', a.id)
      )
    )
    // 조용한 실패 방지: 분야별 대표 기사 저장 오류도 로그로 드러낸다 (발행 흐름은 막지 않음)
    const failed = results.filter(r => r.error)
    if (failed.length > 0) {
      console.error(`[runBriefing] 분야별 대표 기사(full_analysis) 저장 실패 ${failed.length}/${categoryNews.length}건:`, failed.map(r => r.error?.message))
    }
  }

  const top3AnalysisData = buildTop3AnalysisData(top3Analyses, articleInputs)

  const { error: insertError } = await supabase.from('briefings').upsert({
    date: today,
    summary: briefingResult.summary,
    headline: briefingResult.headline,
    share_card: briefingResult.shareCard ?? null,
    daily_term: JSON.stringify(briefingResult.dailyTerm),
    indicators: fullIndicators,
    top3_analysis: top3AnalysisData,
    health_check: briefingResult.healthCheck,
    connections: briefingResult.connections,
  }, { onConflict: 'date' })

  if (insertError) throw new Error(insertError.message)

  if (briefingResult.dailyTerm?.term) {
    await supabase.from('terms').upsert(
      {
        term: briefingResult.dailyTerm.term,
        category: briefingResult.dailyTerm.category ?? '기타',
        explanation: briefingResult.dailyTerm.explanation,
      },
      { onConflict: 'term' }
    )
  }

  return {
    date: today,
    generated: true,
    articlesTotal: articles.length,
    categoryNewsCount: categoryNews.length,
    indicatorsCollected: indicators.length,
    headline: briefingResult.headline,
    top3: top3Articles.map(a => a.title),
    dailyTerm: briefingResult.dailyTerm?.term ?? '',
  }
}
