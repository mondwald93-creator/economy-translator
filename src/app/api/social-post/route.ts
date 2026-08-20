/**
 * 자동 게시 크론 진입점 — 2026-08-20 신설 (마케팅 로드맵 P4-7)
 *
 * 매일 09:35 KST에 불린다(브리핑 09:07 · 보험 09:20 뒤).
 * 흐름: 오늘 브리핑 조회 → 이미 올렸으면 skip → 토큰 확인·갱신 → 글 조립 → 게시 → 결과 기록
 *
 * 크론 자리: cron-job.org (Vercel에 이미 5개가 등록돼 있어 6번째가 되는지 미확인이라
 *   브리핑 발행에 쓰는 외부 크론에 붙였다. 실패 이력도 그쪽 화면에 남는다)
 *
 * ⚠️ 하루 한 번 보장 = `social_posts`의 부분 유니크 인덱스(성공 1건/일) + 이 라우트의 선조회.
 *   재시도로 여러 번 불려도 두 번 올라가지 않는다.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { getAccessToken, alreadyPosted, recordPost } from '@/lib/socialTokens'
import { buildPostText, postToThreads } from '@/lib/postToThreads'
import { notifyFailure } from '@/lib/notifyAdmin'

export const maxDuration = 120

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ?dry=1 이면 올리지 않고 "무슨 글이 나갈지"만 돌려준다(실물 확인 전 점검용)
  const dry = new URL(request.url).searchParams.get('dry') === '1'

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

  try {
    const { data: briefing } = await supabase
      .from('briefings')
      .select('headline, share_card')
      .eq('date', today)
      .maybeSingle<{ headline: string | null; share_card: string | null }>()

    if (!briefing?.headline) {
      return NextResponse.json({ skipped: '오늘 브리핑 없음', date: today })
    }

    const text = buildPostText({ date: today, headline: briefing.headline, shareCard: briefing.share_card })

    if (await alreadyPosted('threads', today)) {
      return NextResponse.json({ skipped: '오늘 이미 게시함', date: today, text })
    }

    const { token, note } = await getAccessToken('threads')
    if (!token) {
      await recordPost('threads', today, 'failed', null, note)
      await notifyFailure('스레드 자동 게시 — 토큰 없음', note)
      return NextResponse.json({ success: false, error: note }, { status: 500 })
    }

    if (dry) {
      return NextResponse.json({ dryRun: true, date: today, tokenNote: note, length: text.length, text })
    }

    const result = await postToThreads(token, text)
    await recordPost('threads', today, result.ok ? 'success' : 'failed', result.postId, result.detail)

    if (!result.ok) {
      await notifyFailure('스레드 자동 게시 실패', `${result.detail}\n\n본문:\n${text}`)
      return NextResponse.json({ success: false, error: result.detail, text }, { status: 500 })
    }

    return NextResponse.json({ success: true, date: today, postId: result.postId, tokenNote: note, text })
  } catch (error) {
    await recordPost('threads', today, 'failed', null, String(error))
    await notifyFailure('스레드 자동 게시 오류', String(error))
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
