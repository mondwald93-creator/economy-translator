export const dynamic = 'force-dynamic'

import { supabase } from '@/lib/supabase'
import { KeyIndicator, Top3AnalysisItem, HealthCheckItem, ConnectionItem } from '@/types'
import HeadlineBanner from '@/components/home/HeadlineBanner'
import EconomyHealthCheck from '@/components/home/EconomyHealthCheck'
import Top3NewsSection from '@/components/home/Top3NewsSection'
import ConnectionDiagram from '@/components/home/ConnectionDiagram'
import KeyIndicators from '@/components/home/KeyIndicators'
import NewsCardList from '@/components/home/NewsCardList'
import EconomyStudy from '@/components/home/EconomyStudy'

export default async function Home() {
  const today = new Date().toISOString().split('T')[0]

  const [{ data: briefing }, { data: articles }] = await Promise.all([
    supabase.from('briefings').select('*').eq('date', today).single(),
    supabase.from('news_articles').select('*').eq('date', today).order('created_at', { ascending: false }).limit(5),
  ])

  if (!briefing) {
    return (
      <div className="border-l-4 border-gray-200 pl-4 py-1">
        <p className="text-sm text-notion-muted">
          오늘 브리핑이 준비 중이에요. 잠시 후 다시 확인해 주세요.
        </p>
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
    <div className="space-y-8">
      <HeadlineBanner headline={briefing.headline ?? null} />
      <EconomyHealthCheck healthCheck={(briefing.health_check as HealthCheckItem[]) ?? null} />
      <Top3NewsSection top3Analysis={(briefing.top3_analysis as Top3AnalysisItem[]) ?? null} />
      <ConnectionDiagram connections={(briefing.connections as ConnectionItem[]) ?? null} />
      <KeyIndicators indicators={indicators} />
      <NewsCardList articles={articles} />
      <EconomyStudy dailyTerm={dailyTerm} />
    </div>
  )
}
