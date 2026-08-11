import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { KeyIndicator, Top3AnalysisItem, HealthCheckItem, ConnectionItem } from '@/types'
import HeadlineBanner from '@/components/home/HeadlineBanner'
import KeyIndicators from '@/components/home/KeyIndicators'
import EconomyHealthCheck from '@/components/home/EconomyHealthCheck'
import Top3NewsSection from '@/components/home/Top3NewsSection'
import ConnectionDiagram from '@/components/home/ConnectionDiagram'
import EndCard from '@/components/home/EndCard'

// 오늘 날짜도 이 경로로 열리므로 갱신 주기를 짧게 둔다.
export const revalidate = 3600
export const dynamicParams = true

const BASE = 'https://economy-translator.vercel.app'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** '2026-07-26' → '2026년 7월 26일 (일)'. 날짜 문자열을 KST 자정으로 고정해 하루 밀림을 막는다. */
function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`)
  const ymd = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
  const weekday = d.toLocaleDateString('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' })
  return `${ymd} (${weekday})`
}

/** '2026-07-24' → '2026.7.24'. 검색 결과에서 잘리지 않게 제목에 쓰는 짧은 형태. */
function shortDate(date: string): string {
  const [y, m, d] = date.split('-')
  return `${y}.${Number(m)}.${Number(d)}`
}

async function getAllDates(): Promise<string[]> {
  const { data } = await getDb()
    .from('briefings')
    .select('date')
    .not('headline', 'is', null)
    .order('date', { ascending: false })
  return (data ?? []).map((r) => r.date as string)
}

async function getBriefing(date: string) {
  const { data } = await getDb()
    .from('briefings')
    .select('*')
    .eq('date', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

export async function generateStaticParams() {
  const dates = await getAllDates()
  return dates.map((date) => ({ date }))
}

export async function generateMetadata({ params }: { params: { date: string } }): Promise<Metadata> {
  if (!DATE_RE.test(params.date)) return { title: '브리핑을 찾을 수 없어요' }
  const briefing = await getBriefing(params.date)
  if (!briefing?.headline) return { title: '브리핑을 찾을 수 없어요' }

  const firstLine = (briefing.headline as string).split('\n')[0].trim()
  const title = `${firstLine} (${shortDate(params.date)} 경제 브리핑)`
  const description = (briefing.summary as string | null)?.slice(0, 150) ?? firstLine
  const url = `${BASE}/briefing/${params.date}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | 경제번역기`, description, url, type: 'article', publishedTime: briefing.created_at },
    twitter: { card: 'summary_large_image', title: `${title} | 경제번역기`, description },
  }
}

export default async function BriefingArchivePage({ params }: { params: { date: string } }) {
  if (!DATE_RE.test(params.date)) notFound()

  const briefing = await getBriefing(params.date)
  if (!briefing?.headline) notFound()

  const dates = await getAllDates()
  const idx = dates.indexOf(params.date)
  const newer = idx > 0 ? dates[idx - 1] : null
  const older = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : null

  // 과거 브리핑은 실시간 시세가 아니라 그날 저장된 스냅샷을 보여준다.
  const indicators = (briefing.indicators ?? []) as KeyIndicator[]

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

  const dateLabel = formatDate(params.date)
  const firstLine = (briefing.headline as string).split('\n')[0].trim()
  const url = `${BASE}/briefing/${params.date}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NewsArticle',
        '@id': url,
        headline: `${firstLine} (${shortDate(params.date)} 경제 브리핑)`,
        description: (briefing.summary as string | null)?.slice(0, 200) ?? firstLine,
        datePublished: briefing.created_at,
        inLanguage: 'ko',
        publisher: { '@type': 'Organization', name: '경제번역기', url: BASE },
        mainEntityOfPage: url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: BASE },
          { '@type': 'ListItem', position: 2, name: '지난 브리핑', item: `${BASE}/briefing` },
          { '@type': 'ListItem', position: 3, name: dateLabel, item: url },
        ],
      },
    ],
  }

  return (
    <div className="space-y-6 sm:space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* 위치 표시 */}
      <nav className="text-xs text-ink-subtle">
        <Link href="/" className="hover:text-ink-muted">홈</Link>
        <span className="mx-1.5">›</span>
        <Link href="/briefing" className="hover:text-ink-muted">지난 브리핑</Link>
        <span className="mx-1.5">›</span>
        <span className="text-ink-muted">{dateLabel}</span>
      </nav>

      {/* 제목(h1)은 HeadlineBanner 안의 헤드라인이 맡는다. 여기는 날짜 표시만.
          폰에서는 위 빵부스러기와 아래 날짜칩에 같은 날짜가 이미 두 번 나와 숨긴다(2026-08-11). */}
      <div className="hidden sm:block border-l-4 border-brand-green pl-4 py-1">
        <p className="section-label">지난 브리핑</p>
        <p className="text-lg font-bold text-ink leading-snug">{dateLabel}</p>
      </div>

      <HeadlineBanner
        headline={briefing.headline ?? null}
        summary={briefing.summary ?? null}
        dateLabel={dateLabel}
        showStreak={false}
        shareUrl={url}
        shareTitle={`${firstLine} (${shortDate(params.date)} 경제 브리핑)`}
      />
      <KeyIndicators
        indicators={indicators}
        healthCheck={(briefing.health_check as HealthCheckItem[]) ?? null}
        briefingAt={dateLabel}
        snapshot
      />
      <EconomyHealthCheck healthCheck={(briefing.health_check as HealthCheckItem[]) ?? null} snapshot />
      <Top3NewsSection top3Analysis={(briefing.top3_analysis as Top3AnalysisItem[]) ?? null} snapshot />
      <ConnectionDiagram connections={(briefing.connections as ConnectionItem[]) ?? null} snapshot />
      <EndCard dailyTerm={dailyTerm} prevDate={older ?? null} snapshot />

      {/* 앞뒤 브리핑 이동 — 폰에서는 끝 카드의 "○월 ○일 브리핑 보기" 버튼과 같은 날짜를 두 번 가리켜 숨긴다(2026-08-11) */}
      <div className="hidden sm:flex items-center justify-between gap-3 pt-2 border-t border-line">
        {older ? (
          <Link href={`/briefing/${older}`} className="text-xs text-ink-muted hover:text-ink">
            ‹ {formatDate(older)}
          </Link>
        ) : <span />}
        <Link href="/briefing" className="text-xs text-brand-green-dark underline underline-offset-2">
          전체 목록
        </Link>
        {newer ? (
          <Link href={`/briefing/${newer}`} className="text-xs text-ink-muted hover:text-ink">
            {formatDate(newer)} ›
          </Link>
        ) : <span />}
      </div>
    </div>
  )
}
