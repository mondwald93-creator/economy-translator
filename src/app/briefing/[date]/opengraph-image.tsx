/**
 * 브리핑 상세 공유 카드 — 그날 헤드라인 (2026-08-11 신설)
 * 뿌린 링크가 실제로 도착하는 자리라 3종 중 가장 중요하다.
 */
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { OG_SIZE, OG_CONTENT_TYPE, OG_HEADERS, ogFonts, BriefingCard, FallbackCard } from '@/lib/ogCard'

export const alt = '경제번역기 브리핑'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const revalidate = 3600

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** '2026-08-11' → '2026년 8월 11일 (화)'. KST 자정으로 고정해 하루 밀림을 막는다. */
function label(date: string): string {
  const d = new Date(`${date}T00:00:00+09:00`)
  const ymd = d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  })
  const weekday = d.toLocaleDateString('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' })
  return `${ymd} (${weekday})`
}

export default async function Image({ params }: { params: { date: string } }) {
  let headline = ''
  let dateLabel = ''

  if (DATE_RE.test(params.date)) {
    dateLabel = label(params.date)
    try {
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data } = await db
        .from('briefings')
        .select('headline')
        .eq('date', params.date)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      headline = (data?.headline as string | null) ?? ''
    } catch {
      // 조회 실패 시 기본 카드로 떨어진다
    }
  }

  const body = headline
    ? BriefingCard({ headline, dateLabel })
    : FallbackCard()

  return new ImageResponse(body, {
    ...size,
    fonts: await ogFonts(headline, dateLabel),
    headers: OG_HEADERS,
  })
}
