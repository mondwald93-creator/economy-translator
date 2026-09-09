/**
 * 용어 상세 공유 카드 — 용어 + 한 줄 뜻 (2026-08-11 신설)
 * 용어 260개가 각자 다른 그림을 갖는다. 검색으로 들어오는 사람이 가장 먼저 닿는 자리다.
 */
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { slugifyTerm, type Term } from '@/lib/terms'
import {
  OG_SIZE,
  OG_CONTENT_TYPE,
  OG_HEADERS,
  ogFonts,
  firstSentence,
  TermCard,
  FallbackCard,
} from '@/lib/ogCard'

export const alt = '경제번역기 용어사전'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
// ⚠️ 상세 페이지(page.tsx)와 같은 함정. 용어 조회는 슬러그와 무관하게 늘 같은 조회문이라
//  캐시 열쇠가 하나로 고정되고, 굳으면 새 용어가 전부 기본 카드로 떨어진다.
//  2026-09-09에 상세 페이지 404 12건을 고치면서 여기도 같이 맞췄다.
//  그림 자체는 OG_HEADERS의 s-maxage=3600으로 CDN이 잡아주므로 매번 다시 그리지 않는다.
export const dynamic = 'force-dynamic'

export default async function Image({ params }: { params: { slug: string } }) {
  let term: Term | null = null

  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
    )
    const { data } = await db.from('terms').select('id, term, category, explanation, example').order('term')
    const decoded = decodeURIComponent(params.slug)
    term = ((data as Term[]) ?? []).find((t) => slugifyTerm(t.term) === decoded) ?? null
  } catch {
    // 조회 실패 시 기본 카드로 떨어진다
  }

  const body = term
    ? TermCard({ term: term.term, category: term.category, explanation: term.explanation })
    : FallbackCard()

  return new ImageResponse(body, {
    ...size,
    fonts: await ogFonts(term?.term, term?.category, term ? firstSentence(term.explanation) : null),
    headers: OG_HEADERS,
  })
}
