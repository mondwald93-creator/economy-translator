import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getMarketIndicators } from '@/lib/marketData'
import {
  generateMainBriefing,
  generateArticleSummaries,
  generateTop3Analysis,
  buildTop3AnalysisData,
} from '@/lib/generateBriefing'

export async function POST() {
  const today = new Date().toISOString().split('T')[0]

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

  const articleInputs = articles.map(a => ({ id: a.id, title: a.title }))

  // 지표 수집 후 메인 브리핑 생성 (헤드라인 + TOP3 인덱스 + 건강진단 + 연결관계 포함)
  const indicators = await getMarketIndicators()
  const briefingResult = await generateMainBriefing(articleInputs, indicators)

  // TOP3 기사 추출
  const top3Articles = (briefingResult.top3Indices ?? [0, 1, 2])
    .filter(i => i < articles.length)
    .slice(0, 3)
    .map(i => articleInputs[i])

  // 기사 요약 (미완료분) + TOP3 6단계 분석 병렬 실행
  const articlesNeedingSummary = articles.filter(a => !a.summary).map(a => ({ id: a.id, title: a.title }))
  const [summaries, top3Analyses] = await Promise.all([
    generateArticleSummaries(articlesNeedingSummary),
    generateTop3Analysis(top3Articles),
  ])

  // 지표에 AI 설명 합치기
  const fullIndicators = indicators.map(ind => ({
    ...ind,
    easyExplanation:
      briefingResult.indicatorExplanations?.find(e => e.name === ind.name)?.easyExplanation ?? '',
  }))

  // 기사 간단 요약 저장
  if (summaries.length > 0) {
    await Promise.all(
      summaries.map(s =>
        supabase.from('news_articles').update({ summary: s.summary }).eq('id', s.id)
      )
    )
  }

  // TOP3 기사 full_analysis 저장
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

  // briefings 저장 (새 컬럼 포함)
  const top3AnalysisData = buildTop3AnalysisData(top3Analyses, articleInputs)

  const { error: upsertError } = await supabase.from('briefings').upsert(
    {
      date: today,
      summary: briefingResult.summary,
      headline: briefingResult.headline,
      daily_term: JSON.stringify(briefingResult.dailyTerm),
      indicators: fullIndicators,
      top3_analysis: top3AnalysisData,
      health_check: briefingResult.healthCheck,
      connections: briefingResult.connections,
    },
    { onConflict: 'date' }
  )

  if (upsertError) {
    return NextResponse.json({ success: false, error: upsertError.message }, { status: 500 })
  }

  // 오늘의 용어를 경제용어 사전에 자동 저장
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

  return NextResponse.json({
    success: true,
    date: today,
    articlesTotal: articles.length,
    articlesSummarized: summaries.length,
    indicatorsCollected: indicators.length,
    headline: briefingResult.headline,
    top3: top3Articles.map(a => a.title),
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
