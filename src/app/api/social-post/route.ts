/**
 * 자동 게시 크론 진입점 — 2026-08-20 신설 (마케팅 로드맵 P4-7 · P4-8)
 *
 * 매일 09:35 KST에 불린다(브리핑 09:07 · 보험 09:20 뒤).
 * cron-job.org 잡 `8294068`. Vercel 크론을 안 쓴 이유는 무료 플랜이 시각을 보장하지
 * 않아서다 — 9시대 아무 때나 돌면 브리핑(09:07)보다 먼저 돌아 그날 게시가 통째로 빠진다.
 *
 * 채널 둘을 **각각 따로, 나란히** 돌린다. 한쪽이 실패해도 다른 쪽은 올라간다.
 * 순서대로 하면 스레드 32초 + 인스타 최대 60초 = 92초라 maxDuration 120초에 빠듯하기도 하다.
 *
 * ⚠️ 하루 한 번 보장 = `social_posts`의 부분 유니크 인덱스(성공 1건/일) + 여기 선조회.
 *   재시도로 여러 번 불려도 두 번 올라가지 않는다.
 */
import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getAccessToken, alreadyPosted, recordPost, type Platform } from '@/lib/socialTokens'
import { buildPostText, postToThreads, currentTopicTag } from '@/lib/postToThreads'
import { buildCaption, postToInstagram, postCarouselToInstagram } from '@/lib/postToInstagram'
import { SITE_URL } from '@/lib/utm'
import { notifyFailure } from '@/lib/notifyAdmin'

export const maxDuration = 120

type Plan = { platform: Platform; ready: boolean; reason: string; token: string | null }

/** 올릴 수 있는 상태인지 본다. 전부 DB·토큰 조회라 1초 안에 끝난다. */
async function plan(platform: Platform): Promise<Plan> {
  if (await alreadyPosted(platform, todayKST())) {
    return { platform, ready: false, reason: '오늘 이미 게시함', token: null }
  }
  const { token, note } = await getAccessToken(platform)
  if (!token) return { platform, ready: false, reason: note, token: null }
  return { platform, ready: true, reason: note, token }
}

const DAILY_CARD_COUNT = 5

/**
 * 일간 인스타 게시. 5장 캐러셀로 올리고, **실패하면 표지 한 장으로 다시 시도한다.**
 *
 * 장수가 늘면 실패할 자리도 는다(카드 5장 중 하나만 안 그려져도 캐러셀 전체가 멈춘다).
 * 그날 아무것도 안 나가는 것보다는 표지 한 장이라도 나가는 게 낫다 —
 * 일간은 매일이라 하루 빠지면 연속 기록이 끊긴다(6/5부터 하루도 안 빠졌다).
 */
async function postDailyInstagram(
  token: string,
  carouselUrls: string[],
  coverUrl: string,
  caption: string
) {
  const carousel = await postCarouselToInstagram(token, carouselUrls, caption)
  if (carousel.ok) return carousel

  const single = await postToInstagram(token, coverUrl, caption)
  return {
    ...single,
    detail: single.ok
      ? `캐러셀 실패해 표지 한 장으로 올림 · 캐러셀 사유: ${carousel.detail}`
      : `캐러셀·한 장 모두 실패 · 캐러셀: ${carousel.detail} · 한 장: ${single.detail}`,
  }
}

function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ?dry=1 이면 올리지 않고 "무슨 글이 나갈지"만 돌려준다(실물 확인 전 점검용)
  const dry = new URL(request.url).searchParams.get('dry') === '1'
  const today = todayKST()

  try {
    const { data: briefing } = await supabase
      .from('briefings')
      .select('headline, share_card')
      .eq('date', today)
      .maybeSingle<{ headline: string | null; share_card: string | null }>()

    if (!briefing?.headline) {
      return NextResponse.json({ skipped: '오늘 브리핑 없음', date: today })
    }

    const headline = briefing.headline
    const text = buildPostText({ date: today, headline, shareCard: briefing.share_card })
    const caption = buildCaption({ date: today, headline })
    const imageUrl = `${SITE_URL}/api/card/instagram/${today}`
    // 2026-08-23: 한 장에서 5장 캐러셀로. 표지 + TOP3 셋 + 팔로우 유도.
    // 단일 이미지 도달이 1년 새 21.96% 떨어졌다는 실측(Metricool 2,436만 건)과,
    // 매일 팔로우를 유도할 자리가 없다는 게 이유다.
    const carouselUrls = Array.from(
      { length: DAILY_CARD_COUNT },
      (_, i) => `${SITE_URL}/api/card/instagram/${today}/${i + 1}`
    )

    const [threads, instagram] = await Promise.all([plan('threads'), plan('instagram')])

    if (dry) {
      return NextResponse.json({
        dryRun: true,
        date: today,
        threads: { ...channelView(threads), length: text.length, topicTag: currentTopicTag(), text },
        instagram: { ...channelView(instagram), length: caption.length, caption, imageUrl, carouselUrls },
      })
    }

    // 게시는 백그라운드로 넘기고 응답을 먼저 돌려준다.
    // cron-job.org는 30초만 기다리고 timeout을 실패로 기록 → 연속 25회면 크론잡이 자동으로 꺼진다
    // (2026-06-12 실측. cron-briefing이 같은 이유로 같은 구조다).
    // 여기까지는 1~2초면 끝나고, 건너뛴 이유는 아래 응답에 그대로 담기므로
    // 크론 화면만 봐도 무슨 일이 있었는지 보인다.
    waitUntil(
      Promise.allSettled([
        threads.ready ? run('threads', () => postToThreads(threads.token!, text), text) : noop(),
        instagram.ready
          ? run('instagram', () => postDailyInstagram(instagram.token!, carouselUrls, imageUrl, caption), caption)
          : noop(),
      ])
    )

    return NextResponse.json({
      accepted: true,
      date: today,
      threads: channelView(threads),
      instagram: channelView(instagram),
    })
  } catch (error) {
    await notifyFailure('자동 게시 오류', String(error))
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

/** 응답에 담는 채널 상태 (토큰 값은 절대 넣지 않는다) */
function channelView(p: Plan) {
  return p.ready ? { willPost: true, tokenNote: p.reason } : { willPost: false, reason: p.reason }
}

function noop() {
  return Promise.resolve()
}

/**
 * 한 채널을 올리고 결과를 남긴다.
 *
 * ⚠️ 토큰이 아예 없는 경우는 여기까지 오지 않는다(`plan`에서 걸러진다).
 * 인스타는 계정 연결 전이라 토큰이 없는 게 정상 상태라서, 그걸 실패로 적고
 * 매일 알림을 보내면 진짜 실패가 묻힌다. 연결하고 나면 이 자리에서 같이 감시된다.
 */
async function run(
  platform: Platform,
  post: () => Promise<{ ok: boolean; postId?: string; detail: string }>,
  body: string
): Promise<void> {
  const today = todayKST()
  const label = platform === 'threads' ? '스레드' : '인스타'
  try {
    const result = await post()
    await recordPost(platform, today, result.ok ? 'success' : 'failed', result.postId, result.detail)
    if (!result.ok) {
      await notifyFailure(`${label} 자동 게시 실패`, `${result.detail}\n\n본문:\n${body}`)
    }
  } catch (error) {
    await recordPost(platform, today, 'failed', null, String(error))
    await notifyFailure(`${label} 자동 게시 오류`, String(error))
  }
}
