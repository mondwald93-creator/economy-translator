import { supabase } from './supabase'
import { getMarketIndicators } from './marketData'
import {
  generateMainBriefing,
  generateArticleSummaries,
  generateTop3Analysis,
  buildTop3AnalysisData,
} from './generateBriefing'

export async function runDailyBriefing() {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: articles, error: fetchError } = await supabase
    .from('news_articles')
    .select('id, title, summary')
    .eq('date', today)
    .order('created_at', { ascending: false })

  if (fetchError) throw new Error(fetchError.message)
  if (!articles || articles.length === 0) {
    throw new Error('오늘 수집된 뉴스가 없습니다. 먼저 뉴스 수집이 완료되어야 합니다.')
  }

  const articleInputs = articles.map(a => ({ id: a.id, title: a.title }))

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

  const articlesNeedingSummary = articles
    .filter(a => !a.summary)
    .map(a => ({ id: a.id, title: a.title }))

  const [summaries, top3Analyses] = await Promise.all([
    generateArticleSummaries(articlesNeedingSummary),
    generateTop3Analysis(top3Articles),
  ])

  const fullIndicators = indicators.map(ind => ({
    ...ind,
    easyExplanation:
      briefingResult.indicatorExplanations?.find(e => e.name === ind.name)?.easyExplanation ?? '',
  }))

  if (summaries.length > 0) {
    await Promise.all(
      summaries.map(s =>
        supabase.from('news_articles').update({ summary: s.summary }).eq('id', s.id)
      )
    )
  }

  if (top3Analyses.length > 0) {
    await Promise.all(
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
  }

  const top3AnalysisData = buildTop3AnalysisData(top3Analyses, articleInputs)

  const { error: insertError } = await supabase.from('briefings').upsert({
    date: today,
    summary: briefingResult.summary,
    headline: briefingResult.headline,
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
    articlesTotal: articles.length,
    articlesSummarized: summaries.length,
    indicatorsCollected: indicators.length,
    headline: briefingResult.headline,
    top3: top3Articles.map(a => a.title),
    dailyTerm: briefingResult.dailyTerm?.term ?? '',
  }
}
