import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMarketIndicators } from '@/lib/marketData'
import { generateMainBriefing, generateArticleSummaries } from '@/lib/generateBriefing'

export async function POST() {
  const today = new Date().toISOString().split('T')[0]

  // 오늘 수집된 뉴스 가져오기
  const { data: articles, error: fetchError } = await supabase
    .from('news_articles')
    .select('id, title, summary')
    .eq('date', today)
    .order('created_at', { ascending: false })

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
  }

  if (!articles || articles.length === 0) {
    return NextResponse.json({
      success: false,
      error: '오늘 수집된 뉴스가 없습니다. 먼저 POST /api/collect-news를 실행해주세요.',
    }, { status: 400 })
  }

  // 시장 지표 수집 + 메인 브리핑 생성 병렬 실행
  // (generateMainBriefing은 지표 데이터가 필요하므로 지표 먼저)
  const indicators = await getMarketIndicators()

  const articleTitles = articles.map(a => a.title)
  const articlesNeedingSummary = articles.filter(a => !a.summary)

  // 메인 브리핑과 기사 요약 병렬 생성
  const [briefingResult, summaries] = await Promise.all([
    generateMainBriefing(articleTitles, indicators),
    generateArticleSummaries(articlesNeedingSummary.map(a => ({ id: a.id, title: a.title }))),
  ])

  // 지표에 AI 설명 합치기
  const fullIndicators = indicators.map(ind => ({
    ...ind,
    easyExplanation:
      briefingResult.indicatorExplanations.find(e => e.name === ind.name)?.easyExplanation ?? '',
  }))

  // 기사 요약 Supabase에 저장
  if (summaries.length > 0) {
    await Promise.all(
      summaries.map(s =>
        supabase.from('news_articles').update({ summary: s.summary }).eq('id', s.id)
      )
    )
  }

  // 브리핑 Supabase에 저장 (같은 날짜면 덮어쓰기)
  const { error: upsertError } = await supabase.from('briefings').upsert(
    {
      date: today,
      summary: briefingResult.summary,
      daily_term: JSON.stringify(briefingResult.dailyTerm),
      indicators: fullIndicators,
    },
    { onConflict: 'date' }
  )

  if (upsertError) {
    return NextResponse.json({ success: false, error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    date: today,
    articlesTotal: articles.length,
    articlesSummarized: summaries.length,
    indicatorsCollected: indicators.length,
    dailyTerm: briefingResult.dailyTerm.term,
  })
}

export async function GET() {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('briefings')
    .select('*')
    .eq('date', today)
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: '오늘 브리핑이 아직 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ success: true, briefing: data })
}
