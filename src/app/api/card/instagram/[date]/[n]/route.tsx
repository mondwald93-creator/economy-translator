/**
 * 일간 인스타 캐러셀 카드 5장 (2026-08-23 신설)
 *
 * 주소 = `/api/card/instagram/<날짜>/<장번호 1~5>`
 *   1장 = 표지 (헤드라인 + 지표 + 오늘의 용어). `InstagramCard` 그대로
 *   2~4장 = 그날 TOP3
 *   5장 = 팔로우 유도
 *
 * ⚠️ **한 장짜리 주소(`/api/card/instagram/<날짜>`)는 손대지 않는다.**
 *    그 주소는 카드 게시용이면서 동시에 공유 카드로도 쓰이고 있어서, 갈아치우면
 *    엉뚱한 데가 같이 깨진다. 그래서 장 번호가 붙은 주소를 따로 낸다.
 *
 * ⭐ **AI를 부르지 않는다.** TOP3 해설(`steps`)은 아침 09:07 브리핑을 만들 때 이미
 *    생성돼 사이트에 나가 있는 문장이다. 여기서는 배치만 한다.
 *    주간 카드는 문장을 새로 만들어야 해서 숫자 검증이 필요했지만, 여기는 그럴 게 없다.
 *
 * ⚠️ `revalidate`를 쓰지 않고 Supabase 조회에 `no-store`를 붙인다.
 *    안 그러면 내용을 고쳐도 옛 그림이 계속 나온다(2026-08-21·08-23에 같은 함정에 두 번 걸렸다).
 */
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import {
  IG_SIZE,
  OG_HEADERS,
  ogFonts,
  InstagramCard,
  WeeklySectionCard,
  WeeklyCtaCard,
  type IgIndicator,
} from '@/lib/ogCard'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// ⚠️ 라우트 파일에서는 Next가 정한 이름(GET·dynamic 등) 말고 다른 것을 export하면 안 된다.
//    export 했다가 MODULE_NOT_FOUND로 라우트 전체가 500이 났다(2026-08-23).
const CARD_COUNT = 5

type Top3Step = {
  oneline?: string
  whatHappened?: string
  myImpact?: string
  conclusion?: string
}
type Top3Item = { title?: string; steps?: Top3Step }

/** `top3_analysis`·`indicators`는 날에 따라 객체로도, JSON 문자열로도 온다(`page.tsx:115`와 같은 방어) */
function parseJson<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback
  try {
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T
  } catch {
    return fallback
  }
}

/** '2026-08-23' → '2026년 8월 23일 (일)' */
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

export async function GET(
  _request: Request,
  { params }: { params: { date: string; n: string } }
) {
  const n = Number(params.n)
  if (!DATE_RE.test(params.date) || !Number.isInteger(n) || n < 1 || n > CARD_COUNT) {
    return new Response('bad params', { status: 400 })
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } }
  )
  const { data } = await db
    .from('briefings')
    .select('headline, indicators, daily_term, top3_analysis')
    .eq('date', params.date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{
      headline: string | null
      indicators: unknown
      daily_term: unknown
      top3_analysis: unknown
    }>()

  const headline = data?.headline ?? ''
  if (!headline) return new Response('no briefing', { status: 404 })

  const indicators = parseJson<IgIndicator[]>(data?.indicators, [])
  const term = parseJson<{ term?: string } | null>(data?.daily_term, null)?.term ?? null
  const top3 = parseJson<Top3Item[]>(data?.top3_analysis, [])

  // 2~4장은 TOP3. 그날 TOP3가 모자라면 그 장은 만들지 않는다(게시 코드가 404를 보고 멈춘다).
  const item = n >= 2 && n <= 4 ? top3[n - 2] : undefined
  if (n >= 2 && n <= 4 && !item?.steps?.oneline) {
    return new Response('no top3', { status: 404 })
  }

  const s = item?.steps ?? {}
  const bodyParts = [s.whatHappened, s.myImpact].filter((x): x is string => Boolean(x))

  const glyphs = [
    headline,
    label(params.date),
    term,
    ...indicators.flatMap(i => [i.name, i.value, i.change]),
    ...top3.flatMap(t => [
      t.steps?.oneline ?? '',
      t.steps?.whatHappened ?? '',
      t.steps?.myImpact ?? '',
      t.steps?.conclusion ?? '',
    ]),
    'TOP오늘의 브리핑매일 5분경제 왕초보 환영매일 아침이면경제가 쉬워져요',
    '프로필 링크에서 오늘 브리핑 보기팔로우하면 내일 브리핑이 와요경제번역기',
  ]

  let card
  if (n === 1) {
    card = (
      <InstagramCard
        headline={headline}
        dateLabel={label(params.date)}
        indicators={indicators}
        term={term}
      />
    )
  } else if (n === CARD_COUNT) {
    card = <WeeklyCtaCard />
  } else {
    // 주간 분야 카드와 구조가 같아 그대로 쓴다(배지·제목·본문 둘·하단 한마디).
    // 일간은 전부 라이트다 — 주간(다크 표지)과 그리드에서 갈리게 두려는 것이다.
    card = (
      <WeeklySectionCard
        badge={`TOP ${n - 1}`}
        titleTop=""
        titleAccent={s.oneline ?? ''}
        bodyParts={bodyParts}
        foot={s.conclusion ?? ''}
        dark={false}
      />
    )
  }

  return new ImageResponse(card, {
    ...IG_SIZE,
    fonts: await ogFonts(...glyphs),
    headers: OG_HEADERS,
  })
}
