/**
 * 주간 브리핑 게시 — 2026-08-23 신설
 *
 * 매주 일요일 18:00 KST에 불린다. cron-job.org 잡(일간 09:35 잡과 같은 계정).
 * Vercel 크론을 안 쓰는 이유는 무료 플랜이 시각을 보장하지 않아서다 — 주 1회인데
 * 시각이 밀리면 그 주가 통째로 이상해진다(일간 09:35을 cron-job.org에 둔 것과 같은 이유).
 *
 * 흐름:
 *   ① `weekly_briefings`에 이번 주 데이터가 있으면 그걸 쓰고, 없으면 만들어 저장한다(멱등)
 *   ② 카드 7장 주소를 만들어 인스타 캐러셀로, 같은 재료로 스레드 글도 올린다
 *   ③ 결과를 `social_posts`에 `instagram_weekly` / `threads_weekly`로 기록한다
 *
 * ⚠️ 주 1회라 **한 번 실패하면 일주일이 빈다.** 일간은 다음 날이 있지만 여기는 없다.
 *    그래서 실패하면 반드시 알림을 보낸다(일간은 토큰 없을 때 조용히 넘어가지만 여기는 아니다).
 */
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getAccessToken, alreadyPosted, recordPost, type PostChannel } from '@/lib/socialTokens'
import { buildWeeklyData, weekRange, indicatorSummaryLine, type WeeklyData } from '@/lib/weeklyBriefing'
import { postCarouselToInstagram, buildWeeklyCaption } from '@/lib/postToInstagram'
import { postToThreads, buildWeeklyPostText } from '@/lib/postToThreads'
import { SITE_URL } from '@/lib/utm'
import { notifyFailure } from '@/lib/notifyAdmin'

export const maxDuration = 300

/**
 * 카드 장 번호 → 주소. 카드 라우트의 번호 규칙(1 표지 · 2~5 분야 · 6 숫자 · 7 팔로우)을 따른다.
 *
 * ⚠️ 분야가 4개 미만이면 **있는 분야만큼만** 장을 만든다(2026-09-13 수정).
 *    문장 필터(`keepIfNumbersOk`)가 분야를 버리면 4개 아래로 내려오는데, 그동안은 무조건
 *    7장 주소를 만들어서 빈 분야 장이 404 "no section"으로 나갔다. Meta는 그림이 아닌
 *    응답을 받으면 "Only photo or video can be accepted"로 캐러셀 전체를 거절한다.
 *    (9/13 실측: 분야 2개 → 5번째 장 실패 → 주간 인스타 통째로 빠짐)
 */
function weeklyCardUrls(weekEnd: string, sectionCount: number): string[] {
  const nums = [1, ...Array.from({ length: Math.min(sectionCount, 4) }, (_, i) => i + 2), 6, 7]
  return nums.map(n => `${SITE_URL}/api/card/weekly/${weekEnd}/${n}`)
}

/**
 * 게시 전에 카드 주소를 전부 받아 본다. 하나라도 그림이 아니면 게시하지 않는다.
 * Meta가 가져가기 전에 우리가 먼저 보는 것이라, 9/6처럼 이유 없이 한 장이 안 나오는 날도
 * 헛시도 대신 어느 장이 어떻게 안 나왔는지(상태코드·형식)가 기록에 남는다.
 * 미리 받아 두면 CDN 캐시도 데워져서 Meta 쪽 받기도 빨라진다.
 */
async function precheckCards(urls: string[]): Promise<{ ok: true } | { ok: false; detail: string }> {
  const results = await Promise.all(
    urls.map(async (url, i) => {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        const type = res.headers.get('content-type') ?? ''
        if (!res.ok || !type.startsWith('image/')) {
          return `${i + 1}번째 장 사전확인 실패: http ${res.status} ${type || '(형식 없음)'}`
        }
        return null
      } catch (e) {
        return `${i + 1}번째 장 사전확인 오류: ${String(e).slice(0, 120)}`
      }
    })
  )
  const bad = results.filter((r): r is string => Boolean(r))
  return bad.length ? { ok: false, detail: bad.join(' / ') } : { ok: true }
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

/** 이번 주 데이터를 가져온다. 없으면 만들어 저장한다(같은 주에 두 번 만들지 않는다). */
async function ensureWeeklyData(baseDate: string): Promise<WeeklyData | null> {
  const { weekEnd } = weekRange(baseDate)

  const { data: row } = await supabase
    .from('weekly_briefings')
    .select('data')
    .eq('week_end', weekEnd)
    .maybeSingle<{ data: WeeklyData }>()
  if (row?.data) return row.data

  const built = await buildWeeklyData(baseDate)
  if (!built) return null

  await supabase
    .from('weekly_briefings')
    .upsert(
      {
        week_start: built.weekStart,
        week_end: built.weekEnd,
        data: built,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'week_end' }
    )
  return built
}

/** 결과를 기록한다. 실패는 알림까지 보낸다(주 1회라 놓치면 일주일이 빈다). */
async function run(
  channel: PostChannel,
  date: string,
  fn: () => Promise<{ ok: boolean; postId?: string; detail: string }>
) {
  try {
    const r = await fn()
    await recordPost(channel, date, r.ok ? 'success' : 'failed', r.postId ?? null, r.detail)
    if (!r.ok) await notifyFailure(`주간 게시 실패 (${channel})`, r.detail)
  } catch (e) {
    await recordPost(channel, date, 'failed', null, String(e).slice(0, 300))
    await notifyFailure(`주간 게시 오류 (${channel})`, String(e))
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dry = url.searchParams.get('dry') === '1'
  // 지난 주치를 다시 만들 때 쓴다(예: ?date=2026-08-16). 없으면 오늘 기준.
  const baseDate = url.searchParams.get('date') ?? todayKST()

  try {
    const w = await ensureWeeklyData(baseDate)
    if (!w) {
      return NextResponse.json({ skipped: '주간 재료 부족(그 주 브리핑이 없거나 지표 조회 실패)', baseDate })
    }

    const imageUrls = weeklyCardUrls(w.weekEnd, w.sections.length)
    const caption = buildWeeklyCaption({
      rangeLabel: w.rangeLabel,
      coverLines: w.coverLines,
      sections: w.sections,
    })
    const threadText = buildWeeklyPostText({
      rangeLabel: w.rangeLabel,
      coverLines: w.coverLines,
      sections: w.sections,
      coverStat: indicatorSummaryLine(w.indicators),
    })

    const [igDone, thDone] = await Promise.all([
      alreadyPosted('instagram_weekly', w.weekEnd),
      alreadyPosted('threads_weekly', w.weekEnd),
    ])
    const [ig, th] = await Promise.all([getAccessToken('instagram'), getAccessToken('threads')])

    if (dry) {
      return NextResponse.json({
        dryRun: true,
        week: `${w.weekStart} ~ ${w.weekEnd}`,
        rangeLabel: w.rangeLabel,
        coverLines: w.coverLines,
        indicatorNotes: w.indicatorNotes,
        indicators: w.indicators,
        sections: w.sections,
        imageUrls,
        cardCount: imageUrls.length,
        sectionCount: w.sections.length,
        instagram: { willPost: !igDone && Boolean(ig.token), note: ig.note, captionLength: caption.length, caption },
        threads: { willPost: !thDone && Boolean(th.token), note: th.note, length: threadText.length, text: threadText },
      })
    }

    // 게시는 백그라운드로 넘기고 응답을 먼저 준다. 캐러셀은 7장을 Meta가 받아가는
    // 시간이 있어서 동기로 기다리면 cron-job.org 30초 timeout에 걸린다(일간과 같은 이유).
    waitUntil(
      Promise.allSettled([
        !igDone && ig.token
          ? run('instagram_weekly', w.weekEnd, async () => {
              const pre = await precheckCards(imageUrls)
              if (!pre.ok) return { ok: false, detail: pre.detail }
              return postCarouselToInstagram(ig.token!, imageUrls, caption)
            })
          : Promise.resolve(),
        !thDone && th.token
          ? run('threads_weekly', w.weekEnd, () => postToThreads(th.token!, threadText))
          : Promise.resolve(),
      ])
    )

    return NextResponse.json({
      accepted: true,
      week: `${w.weekStart} ~ ${w.weekEnd}`,
      instagram: { willPost: !igDone && Boolean(ig.token), note: igDone ? '이번 주 이미 게시함' : ig.note },
      threads: { willPost: !thDone && Boolean(th.token), note: thDone ? '이번 주 이미 게시함' : th.note },
    })
  } catch (error) {
    await notifyFailure('주간 게시 오류', String(error))
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
