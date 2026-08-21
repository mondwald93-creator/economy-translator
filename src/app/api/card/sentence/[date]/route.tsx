/**
 * 「오늘의 한 문장」 화면 카드 (2026-08-21 신설)
 *
 * 홈 화면에 보이는 카드와 「📸 이미지 저장」이 쓰는 그림.
 *
 * ⚠️ 왜 홈 og(`/opengraph-image`)를 안 쓰고 따로 냈나 — 8/11에 둘을 한 장으로
 * 합쳐뒀는데(화면 = 저장 = 카톡 미리보기), 8/20에 홈 og를 **간판 고정**으로 바꾸면서
 * 화면 카드까지 같이 간판이 됐다. 「오늘의 한 문장」 자리에 그날 문장이 아니라
 * "경제 뉴스를 쉬운 말로 옮겨 드려요"가 떴다(사용자가 화면에서 발견).
 *
 * 홈 링크 미리보기는 간판이 맞다(스레드 고정글·프로필·이메일 등 홈으로 보내는
 * 링크는 전부 간판 자리라서다. 커밋 67ee189). 화면 카드는 그날 문장이 맞다.
 * **쓰임이 둘이라 주소도 둘이어야 한다.** 대신 그리는 코드는 `SentenceCard` 한 벌을
 * 같이 쓰므로 그림이 갈라지지 않는다 — 8/11이 걱정한 게 그것이었다.
 */
import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { OG_SIZE, OG_HEADERS, ogFonts, SentenceCard, FallbackCard } from '@/lib/ogCard'
import { pickTodaySentence, sentenceDateLabel } from '@/lib/todaySentence'

/**
 * ⚠️ `revalidate = 3600`을 쓰지 않는다. 그 설정은 그림뿐 아니라 **안에서 하는 DB 조회까지**
 * 1시간 묶어버린다. 그래서 문장을 고쳐도 최대 1시간은 옛 문장으로 그렸다(2026-08-21 실측:
 * `x-vercel-cache: MISS`인데도 옛 문장). `page.tsx`가 같은 함정 때문에 `cache: 'no-store'`를
 * 쓰고 있다(CLAUDE.md "절대 건드리지 말 것" 표).
 *
 * 대신 매번 새로 읽고, 캐시는 CDN이 `OG_HEADERS`(s-maxage=3600)로 한다.
 * 그림을 다시 그리는 건 1시간에 한 번뿐이고, 그때 최신 문장을 읽는다.
 */
export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(_request: Request, { params }: { params: { date: string } }) {
  if (!DATE_RE.test(params.date)) {
    return new Response('bad date', { status: 400 })
  }

  let sentence = ''
  const dateLabel = sentenceDateLabel(params.date)

  try {
    // no-store: 위 주석 참조. 이게 없으면 조회 결과가 캐시에 굳는다
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
    )
    const { data } = await db
      .from('briefings')
      .select('share_card, summary')
      .eq('date', params.date)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // 화면(page.tsx)과 **같은 함수**로 고른다. 그림과 「텍스트 복사」가 어긋나지 않게
    sentence = pickTodaySentence(data?.share_card, data?.summary)
  } catch {
    // 조회가 실패해도 그림은 떠야 한다. 아래 간판 카드로 떨어진다
  }

  const body = sentence ? SentenceCard({ sentence, dateLabel }) : FallbackCard()

  return new ImageResponse(body, {
    ...OG_SIZE,
    fonts: await ogFonts(sentence, dateLabel),
    headers: OG_HEADERS,
  })
}
