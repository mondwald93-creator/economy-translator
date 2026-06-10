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

const ARTICLE_CATEGORIES = [
  { keywords: ['환율', '원달러', '달러', '금리', '기준금리', '한국은행', '원화', '외환'] },
  { keywords: ['부동산', '아파트', '주택', '건설', '분양', '전세', '집값', '청약', '재건축'] },
  { keywords: ['물가', '소비', '인플레', '식료품', '유가', '에너지', '전기료', '장바구니', 'CPI'] },
  { keywords: ['정부', '수출', '무역', '관세', '정책', '예산', '고용', '실업', '기획재정부'] },
  { keywords: ['반도체', '삼성', 'SK하이닉스', '현대차', 'LG', '기업', '실적', '영업이익', '수주'] },
  { keywords: ['코스피', '코스닥', '주식', '증시', '주가', '상장', '급등', '급락', '외국인'] },
]

type RawArticle = { id: string; title: string; source: string; created_at: string }

function selectDiverseArticles(articles: RawArticle[], count = 5): RawArticle[] {
  const selected: RawArticle[] = []
  const usedIds = new Set<string>()

  for (const category of ARTICLE_CATEGORIES) {
    if (selected.length >= count) break
    const match = articles.find(
      a => !usedIds.has(a.id) && category.keywords.some(kw => a.title.includes(kw))
    )
    if (match) {
      selected.push(match)
      usedIds.add(match.id)
    }
  }

  for (const article of articles) {
    if (selected.length >= count) break
    if (!usedIds.has(article.id)) {
      selected.push(article)
      usedIds.add(article.id)
    }
  }

  return selected
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

  const { data: rawArticles } = await db
    .from('news_articles').select('id, title, source, created_at').eq('date', today).order('created_at', { ascending: false }).limit(50)

  const articles = selectDiverseArticles((rawArticles ?? []) as RawArticle[])

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
  const todayDateLabel = new Date(Date.now() + 9 * 60 * 60 * 1000)
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
      <NewsCardList articles={articles} updatedAt={formatKST(rawArticles?.[0]?.created_at)} />
      <EconomyStudy dailyTerm={dailyTerm} />
    </div>
  )
}
