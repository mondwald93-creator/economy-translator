import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 3600

const BASE = 'https://economy-translator.vercel.app'

export const metadata: Metadata = {
  title: '지난 브리핑',
  description: '매일 아침 9시에 올라온 경제 브리핑을 날짜별로 모아뒀어요. 그날 무슨 일이 있었고 왜 그런 일이 생겼는지 쉬운 말로 확인해보세요.',
  alternates: { canonical: `${BASE}/briefing` },
  openGraph: {
    title: '지난 브리핑 | 경제번역기',
    description: '날짜별 경제 브리핑 모아보기',
    url: `${BASE}/briefing`,
  },
}

interface Row {
  date: string
  headline: string | null
  summary: string | null
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`)
  const ymd = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
  const weekday = d.toLocaleDateString('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' })
  return `${ymd} (${weekday})`
}

function monthLabel(date: string): string {
  const [y, m] = date.split('-')
  return `${y}년 ${Number(m)}월`
}

export default async function BriefingListPage() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await db
    .from('briefings')
    .select('date, headline, summary')
    .not('headline', 'is', null)
    .order('date', { ascending: false })

  const rows = (data ?? []) as Row[]

  // 월별로 묶어서 보여준다
  const groups: { month: string; items: Row[] }[] = []
  for (const row of rows) {
    const m = monthLabel(row.date)
    const last = groups[groups.length - 1]
    if (last && last.month === m) last.items.push(row)
    else groups.push({ month: m, items: [row] })
  }

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-brand-green pl-4 py-1">
        <p className="section-label">아카이브</p>
        <h1 className="text-xl font-bold text-ink leading-snug">지난 브리핑</h1>
        <p className="text-sm text-ink-muted mt-1">
          매일 아침 9시에 올라온 브리핑을 날짜별로 모아뒀어요
        </p>
      </div>

      <p className="text-xs text-ink-subtle">전체 {rows.length}개</p>

      {rows.length === 0 && (
        <div className="border border-line rounded-[14px] p-8 text-center bg-white">
          <p className="text-ink-subtle text-sm">아직 쌓인 브리핑이 없어요</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.month} className="space-y-2">
          <h2 className="text-sm font-bold text-ink-muted pt-2">{g.month}</h2>
          <div className="space-y-2">
            {g.items.map((row) => (
              <Link
                key={row.date}
                href={`/briefing/${row.date}`}
                className="block border border-line rounded-[14px] p-4 bg-white hover:bg-surface transition-colors"
              >
                <p className="text-[11px] text-ink-subtle mb-1">{formatDate(row.date)}</p>
                <p className="text-[15px] sm:text-sm font-bold text-ink leading-snug mb-1">
                  {(row.headline ?? '').split('\n')[0]}
                </p>
                {row.summary && (
                  <p className="text-[13px] sm:text-xs text-ink-muted leading-relaxed line-clamp-2">{row.summary}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
