import { supabase } from '@/lib/supabase'
import DailyBriefing from '@/components/home/DailyBriefing'
import KeyIndicators from '@/components/home/KeyIndicators'
import NewsCardList from '@/components/home/NewsCardList'
import DailyTerm from '@/components/home/DailyTerm'
import { KeyIndicator } from '@/types'

export default async function Home() {
  const today = new Date().toISOString().split('T')[0]

  const [{ data: briefing }, { data: articles }] = await Promise.all([
    supabase.from('briefings').select('*').eq('date', today).single(),
    supabase.from('news_articles').select('*').eq('date', today).order('created_at', { ascending: false }).limit(5),
  ])

  if (!briefing) {
    return (
      <div className="space-y-6">
        <section className="bg-blue-600 text-white rounded-2xl p-5">
          <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-2">
            오늘의 경제 브리핑
          </p>
          <p className="text-lg font-semibold leading-relaxed text-blue-100">
            오늘 브리핑이 준비 중이에요. 잠시 후 다시 확인해 주세요.
          </p>
        </section>
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
    <div className="space-y-6">
      <DailyBriefing summary={briefing.summary} />
      <KeyIndicators indicators={indicators} />
      <NewsCardList articles={articles} />
      <DailyTerm dailyTerm={dailyTerm} />
    </div>
  )
}
