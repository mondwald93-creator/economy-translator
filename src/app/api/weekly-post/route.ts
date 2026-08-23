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

const CARD_COUNT = 7

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

    const imageUrls = Array.from(
      { length: CARD_COUNT },
      (_, i) => `${SITE_URL}/api/card/weekly/${w.weekEnd}/${i + 1}`
    )
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
        instagram: { willPost: !igDone && Boolean(ig.token), note: ig.note, captionLength: caption.length, caption },
        threads: { willPost: !thDone && Boolean(th.token), note: th.note, length: threadText.length, text: threadText },
      })
    }

    // 게시는 백그라운드로 넘기고 응답을 먼저 준다. 캐러셀은 7장을 Meta가 받아가는
    // 시간이 있어서 동기로 기다리면 cron-job.org 30초 timeout에 걸린다(일간과 같은 이유).
    waitUntil(
      Promise.allSettled([
        !igDone && ig.token
          ? run('instagram_weekly', w.weekEnd, () => postCarouselToInstagram(ig.token!, imageUrls, caption))
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
