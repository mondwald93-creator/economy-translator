/**
 * 주간 카드 7장 (2026-08-23 신설)
 *
 * 주소 = `/api/card/weekly/<주 마지막날(일요일)>/<장번호 1~7>`
 * 인스타 캐러셀은 그림을 파일로 올리는 게 아니라 **공개 주소를 알려주면 Meta 서버가
 * 직접 가져가는** 방식이라 장마다 주소가 하나씩 있어야 한다. 그래서 라우트에 인증을 걸지 않는다.
 *
 * 여기서는 **그림만 그린다.** 문장·숫자는 `weekly_briefings`에 이미 저장된 것을 읽는다.
 * 라우트가 만들면 Meta가 7장을 가져올 때 OpenAI를 7번 부르게 되고, 장마다 다른 문장이
 * 나올 수도 있다.
 *
 * ⚠️ **`revalidate`를 쓰지 않는다.** 그 설정은 그림뿐 아니라 라우트 안의 fetch(DB 조회)까지
 *    같이 묶어서, 내용을 고쳐도 옛 그림이 계속 나온다(2026-08-21에 「오늘의 한 문장」 카드가
 *    정확히 이 함정에 걸렸다). 그림 캐시는 CDN이 `OG_HEADERS`로 처리한다.
 */
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import {
  IG_SIZE,
  OG_HEADERS,
  ogFonts,
  WeeklyCoverCard,
  WeeklySectionCard,
  WeeklyStatsCard,
  WeeklyCtaCard,
  type IgIndicator,
} from '@/lib/ogCard'
import type { WeeklyData } from '@/lib/weeklyBriefing'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 장 번호 → 밝기.
 * 옛 주간 카드 순서 그대로다 — 커버(1) 다크로 시작해 번갈아 가고, 6장(숫자)은 값이
 * 도드라지게 다크, 7장(팔로우 유도)은 눌러야 하는 화면이라 라이트로 끝낸다.
 */
function isDark(n: number): boolean {
  if (n === 1 || n === 6) return true
  if (n === 7) return false
  return n % 2 === 1 // 3·5 다크 / 2·4 라이트
}

export async function GET(
  _request: Request,
  { params }: { params: { date: string; n: string } }
) {
  const n = Number(params.n)
  if (!DATE_RE.test(params.date) || !Number.isInteger(n) || n < 1 || n > 7) {
    return new Response('bad params', { status: 400 })
  }

  // ⚠️ `no-store`를 반드시 붙인다. `dynamic = 'force-dynamic'`만으로는 부족하다 —
  // 그건 라우트를 매번 실행하게 할 뿐이고, 그 안에서 하는 fetch(=Supabase 조회)는
  // Next가 따로 캐시한다. 안 붙이면 내용을 고쳐도 **옛 데이터로 그림이 계속 나온다.**
  // (2026-08-23 실측으로 다시 확인: 문장을 바꿔 저장했는데 카드는 이전 문장을 그렸다.
  //  `page.tsx`가 같은 이유로 매 렌더 createClient + no-store를 쓴다 — CLAUDE.md 참조)
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } }
  )
  const { data: row } = await db
    .from('weekly_briefings')
    .select('data')
    .eq('week_end', params.date)
    .maybeSingle<{ data: WeeklyData }>()

  const w = row?.data
  if (!w) {
    // 그 주 데이터가 없으면 그림을 만들지 않는다. 게시 코드가 이걸 보고 멈춘다.
    return new Response('no weekly data', { status: 404 })
  }

  // 분야 카드는 2~5장. 배열 인덱스로 바꾼다.
  const section = n >= 2 && n <= 5 ? w.sections[n - 2] : undefined
  if (n >= 2 && n <= 5 && !section) {
    return new Response('no section', { status: 404 })
  }

  const glyphs = [
    w.rangeLabel,
    ...w.coverLines,
    ...w.sections.flatMap(s => [s.badge, s.titleTop, s.titleAccent, ...s.bodyParts, s.foot]),
    ...w.indicators.flatMap(i => [i.name, i.value, i.change]),
    ...Object.values(w.indicatorNotes ?? {}),
    '주간 정리이번 주 숫자매일 5분경제 왕초보 환영오른 건 지수, 지갑은 아직경제번역기',
    '매일 아침 5분이면경제가 쉬워져요프로필 링크에서 오늘 브리핑 보기팔로우하면 내일 브리핑이 와요',
    '이번 주 경제, 4가지로 정리 →',
  ]

  let card
  if (n === 1) {
    card = <WeeklyCoverCard rangeLabel={w.rangeLabel} lines={w.coverLines} />
  } else if (n === 6) {
    card = (
      <WeeklyStatsCard
        rangeLabel={w.rangeLabel}
        indicators={w.indicators as IgIndicator[]}
        notes={w.indicatorNotes}
      />
    )
  } else if (n === 7) {
    card = <WeeklyCtaCard />
  } else {
    card = (
      <WeeklySectionCard
        badge={section!.badge}
        titleTop={section!.titleTop}
        titleAccent={section!.titleAccent}
        bodyParts={section!.bodyParts}
        foot={section!.foot}
        dark={isDark(n)}
      />
    )
  }

  return new ImageResponse(card, {
    ...IG_SIZE,
    fonts: await ogFonts(...glyphs),
    headers: OG_HEADERS,
  })
}
