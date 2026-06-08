export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { KeyIndicator, Top3AnalysisItem, HealthCheckItem, ConnectionItem } from '@/types'
import HeadlineBanner from '@/components/home/HeadlineBanner'
import EconomyHealthCheck from '@/components/home/EconomyHealthCheck'
import Top3NewsSection from '@/components/home/Top3NewsSection'
import ConnectionDiagram from '@/components/home/ConnectionDiagram'
import KeyIndicators from '@/components/home/KeyIndicators'
import NewsCardList from '@/components/home/NewsCardList'
import EconomyStudy from '@/components/home/EconomyStudy'

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

  const { data: articles } = await db
    .from('news_articles').select('id, title, source, created_at').eq('date', today).order('created_at', { ascending: false }).limit(5)

  if (!briefing) {
    return (
      <div className="rounded-card border border-line p-8 text-center">
        <p className="text-2xl mb-3">⏳</p>
        <p className="text-sm font-medium text-ink mb-1">브리핑 준비 중이에요</p>
        <p className="text-xs text-ink-muted">매일 오전 9시에 업데이트돼요. 잠시 후 다시 확인해 주세요.</p>
      </div>
    )
  }

  const indicators: KeyIndicator[] | null = briefing.indicators ?? null

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
      <KeyIndicators indicators={indicators} healthCheck={(briefing.health_check as HealthCheckItem[]) ?? null} briefingAt={formatKST(briefing.created_at)} />
      <EconomyHealthCheck healthCheck={(briefing.health_check as HealthCheckItem[]) ?? null} />
      <Top3NewsSection top3Analysis={(briefing.top3_analysis as Top3AnalysisItem[]) ?? null} />
      <ConnectionDiagram connections={(briefing.connections as ConnectionItem[]) ?? null} />
      <NewsCardList articles={articles} updatedAt={formatKST(articles?.[0]?.created_at)} />
      <EconomyStudy dailyTerm={dailyTerm} />
    </div>
  )
}
