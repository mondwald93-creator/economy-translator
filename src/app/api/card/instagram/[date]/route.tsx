/**
 * 인스타 세로 카드 (2026-08-20 신설 · 마케팅 P4-8)
 *
 * 1080×1350 그림 한 장. 인스타 게시는 그림을 파일로 올리는 게 아니라
 * **공개 주소를 알려주면 Meta 서버가 직접 가져가는** 방식이라(문서: "must be hosted
 * on a publicly accessible server at the time of the attempt) 이렇게 라우트로 낸다.
 * 그래서 여기엔 인증을 걸지 않는다. 브리핑 내용은 어차피 사이트에 공개돼 있다.
 *
 * ⚠️ 문서는 "JPEG is the only image format supported"라고 하는데 `ImageResponse`는
 * PNG만 낸다. 8/14 매경 403 오판(문서·추정으로 단정했다가 틀림)이 있어서
 * **먼저 PNG로 실제로 올려 보고**, 거부될 때만 변환을 붙인다(P3-6 ⓐ→ⓑ 순서).
 */
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import {
  IG_SIZE,
  IG_FIXED_GLYPHS,
  OG_HEADERS,
  ogFonts,
  InstagramCard,
  type IgIndicator,
} from '@/lib/ogCard'

export const revalidate = 3600

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** '2026-08-20' → '2026년 8월 20일 (목)'. KST 자정 고정 — 브리핑 카드와 같은 방식 */
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

export async function GET(_request: Request, { params }: { params: { date: string } }) {
  if (!DATE_RE.test(params.date)) {
    return new Response('bad date', { status: 400 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await db
    .from('briefings')
    .select('headline, indicators, daily_term')
    .eq('date', params.date)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const headline = (data?.headline as string | null) ?? ''
  if (!headline) {
    // 그날 브리핑이 없으면 그림을 만들지 않는다. 게시 코드가 이걸 보고 멈춘다.
    // 빈 카드를 올리는 것보다 안 올리는 게 낫다.
    return new Response('no briefing', { status: 404 })
  }

  // ⚠️ 이 두 칸은 날에 따라 **객체로도 오고 JSON 문자열로도 온다.**
  // 첫 판에서 daily_term을 객체로만 보고 읽었다가 카드에서 용어 줄이 통째로 빠졌다.
  // page.tsx:115가 이미 같은 방식으로 방어하고 있다 — 거기에 맞춘다.
  function parseMaybeJson<T>(value: unknown): T | null {
    if (!value) return null
    try {
      return (typeof value === 'string' ? JSON.parse(value) : value) as T
    } catch {
      return null
    }
  }

  const indicators = parseMaybeJson<IgIndicator[]>(data?.indicators) ?? []
  const term = parseMaybeJson<{ term?: string }>(data?.daily_term)?.term ?? null
  const dateLabel = label(params.date)

  // 카드에 실제로 그려지는 글자를 전부 폰트 서브셋에 넘긴다.
  // 여기 빠진 글자는 다른 글꼴로 대체돼 굵기가 어긋난다(2026-08-11 실측).
  const glyphs = [
    headline,
    dateLabel,
    term,
    IG_FIXED_GLYPHS,
    ...indicators.flatMap((i) => [i.name, i.value, i.change]),
  ]

  return new ImageResponse(InstagramCard({ headline, dateLabel, indicators, term }), {
    ...IG_SIZE,
    fonts: await ogFonts(...glyphs),
    headers: OG_HEADERS,
  })
}
