export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { getMarketIndicators } from '@/lib/marketData'
import { KeyIndicator, Top3AnalysisItem, HealthCheckItem, ConnectionItem } from '@/types'
import HeadlineBanner from '@/components/home/HeadlineBanner'
import EconomyHealthCheck from '@/components/home/EconomyHealthCheck'
import Top3NewsSection from '@/components/home/Top3NewsSection'
import ConnectionDiagram from '@/components/home/ConnectionDiagram'
import KeyIndicators from '@/components/home/KeyIndicators'
import NewsCardList from '@/components/home/NewsCardList'
import EconomyStudy from '@/components/home/EconomyStudy'
import TodaySentenceCard from '@/components/home/TodaySentenceCard'
// EmailSubscribeSection — 트래픽 생기면 활성화
// import EmailSubscribeSection from '@/components/home/EmailSubscribeSection'

// 홈 뉴스 목록 = 분야별(6개) 대표 기사 1개씩. 경제건강진단과 같은 6개 분류로 화면 일관성 유지.
// 각 기사는 브리핑이 full_analysis.category 꼬리표를 붙여 저장해 둔 것 중에서 고른다.
const CATEGORY_META = [
  { key: '물가', icon: '🛒' },
  { key: '소비', icon: '💳' },
  { key: '수출', icon: '🚢' },
  { key: '고용', icon: '👷' },
  { key: '부동산', icon: '🏠' },
  { key: '금융', icon: '📈' },
]

type AnalyzedArticle = {
  id: string
  title: string
  source: string
  created_at: string
  full_analysis: { category?: string } | null
}

function selectCategoryArticles(articles: AnalyzedArticle[]) {
  return CATEGORY_META
    .map(c => {
      const match = articles.find(a => a.full_analysis?.category === c.key)
      if (!match) return null
      return { id: match.id, title: match.title, source: match.source, category: c.key, categoryIcon: c.icon }
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
}

function formatKST(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function Home() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  )
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: briefing } = await db
    .from('briefings').select('*').eq('date', today).order('created_at', { ascending: false }).limit(1).single()

  const { data: analyzedArticles } = await db
    .from('news_articles').select('id, title, source, created_at, full_analysis')
    .eq('date', today).not('full_analysis', 'is', null)
    .order('created_at', { ascending: false }).limit(50)

  const articles = selectCategoryArticles((analyzedArticles ?? []) as AnalyzedArticle[])

  if (!briefing) {
    return (
      <div className="rounded-card border border-line p-8 text-center">
        <p className="text-2xl mb-3">⏳</p>
        <p className="text-sm font-medium text-ink mb-1">오늘 브리핑 준비 중이에요</p>
        <p className="text-xs text-ink-muted">매일 아침 9시에 올라와요. 커피 한 잔 마시고 다시 와주세요 ☕</p>
      </div>
    )
  }

  // 지표: 실시간 숫자 + 브리핑 AI 설명 합치기
  const storedIndicators = (briefing.indicators ?? []) as KeyIndicator[]
  const liveMarket = await getMarketIndicators()
  const indicators: KeyIndicator[] = liveMarket.length > 0
    ? liveMarket.map(live => ({
        ...live,
        easyExplanation: storedIndicators.find(s => s.name === live.name)?.easyExplanation ?? '',
      }))
    : storedIndicators

  // 오늘의 한 문장: AI가 생성한 share_card 우선, 없으면 summary 첫 문장
  const todaySentence: string = briefing.share_card
    || (() => {
      if (!briefing.summary) return ''
      const firstPara = (briefing.summary as string).split(/\n+/).find((p: string) => p.trim().length > 10) ?? ''
      return firstPara.match(/[^。.!?!?]*[。.!?!?]+/)?.[0]?.trim() ?? firstPara.slice(0, 60)
    })()
  // 주의: +9h 보정과 timeZone 옵션을 같이 쓰면 날짜가 하루 밀림 — timeZone만 사용
  const todayDateLabel = new Date()
    .toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })

  let dailyTerm: { term: string; explanation: string } | null = null
  if (briefing.daily_term) {
    try {
      dailyTerm = typeof briefing.daily_term === 'string'
        ? JSON.parse(briefing.daily_term)
        : briefing.daily_term
    } catch {
      dailyTerm = null
    }
  }

  return (
    <div className="space-y-10">
      <HeadlineBanner headline={briefing.headline ?? null} summary={briefing.summary ?? null} />
      {todaySentence && (
        <TodaySentenceCard sentence={todaySentence} dateLabel={todayDateLabel} />
      )}
      <KeyIndicators indicators={indicators} healthCheck={(briefing.health_check as HealthCheckItem[]) ?? null} briefingAt={formatKST(briefing.created_at)} />
      <EconomyHealthCheck healthCheck={(briefing.health_check as HealthCheckItem[]) ?? null} />
      <Top3NewsSection top3Analysis={(briefing.top3_analysis as Top3AnalysisItem[]) ?? null} />
      <ConnectionDiagram connections={(briefing.connections as ConnectionItem[]) ?? null} />
      <NewsCardList articles={articles} updatedAt={formatKST(briefing.created_at)} />
      <EconomyStudy dailyTerm={dailyTerm} />
    </div>
  )
}
