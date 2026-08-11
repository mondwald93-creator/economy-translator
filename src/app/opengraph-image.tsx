/**
 * 홈 공유 카드 — 오늘의 한 문장 (2026-08-11 신설)
 * 링크를 카톡·스레드에 붙였을 때 뜨는 1200x630 그림.
 */
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { OG_SIZE, OG_CONTENT_TYPE, OG_HEADERS, ogFonts, SentenceCard, FallbackCard } from '@/lib/ogCard'

export const alt = '경제번역기 — 오늘의 한 문장'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
// 그림 자체는 1시간마다 다시 만든다. 브리핑은 하루 한 번(9시 무렵) 바뀐다.
export const revalidate = 3600

/** '2026-08-11' → '2026년 8월 11일' */
function label(date: string): string {
  const [y, m, d] = date.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

export default async function Image() {
  let sentence = ''
  let dateLabel = ''

  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await db
      .from('briefings')
      .select('date, share_card, summary')
      .not('headline', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      dateLabel = label(data.date as string)
      // 홈 화면(page.tsx)과 같은 순서로 고른다: share_card 우선, 없으면 요약 첫 문장
      sentence = (data.share_card as string | null) ?? ''
      if (!sentence && data.summary) {
        const para = (data.summary as string).split(/\n+/).find((p) => p.trim().length > 10) ?? ''
        sentence = para.match(/[^。.!?！？]*[。.!?！？]+/)?.[0]?.trim() ?? para.slice(0, 60)
      }
    }
  } catch {
    // 조회가 실패해도 그림은 떠야 한다. 아래 기본 카드로 떨어진다.
  }

  const body = sentence
    ? SentenceCard({ sentence, dateLabel })
    : FallbackCard()

  return new ImageResponse(body, {
    ...size,
    fonts: await ogFonts(sentence, dateLabel),
    headers: OG_HEADERS,
  })
}
