/**
 * 자동 게시용 토큰 보관·갱신 — 2026-08-20 신설 (마케팅 로드맵 P3-6)
 *
 * 왜 DB에 두나: Meta 토큰은 60일마다 갱신해야 하고 **갱신하면 값이 바뀐다.**
 * Vercel 환경변수는 코드가 스스로 바꿀 수 없다(바꾸려면 사람이 재배포).
 * 그래서 값이 변하는 것(토큰)은 DB, 변하지 않는 것(앱 시크릿)은 환경변수에 둔다.
 *
 * ⚠️ 60일 안에 한 번도 갱신 못 하면 토큰이 죽고, 그때는 사람이 Meta 화면에서 재발급해야 한다.
 *    그래서 매 실행마다 "만료 14일 이내면 갱신"을 시도한다(문서 조건: 발급 24시간 뒤 ~ 만료 전).
 *
 * 테이블 = supabase/social_post.sql (`social_tokens`. RLS 켜고 정책 없음 = anon 완전 차단)
 */
import { supabaseAdmin as supabase } from './supabaseAdmin'

export type Platform = 'threads' | 'instagram'

type TokenRow = { platform: string; access_token: string; expires_at: string }

/** 갱신을 시도하기 시작하는 시점(만료까지 남은 일수) */
const REFRESH_WINDOW_DAYS = 14

const REFRESH_ENDPOINT: Record<Platform, (token: string) => string> = {
  threads: t => `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${t}`,
  instagram: t => `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${t}`,
}

/**
 * 토큰을 가져온다. 만료가 가까우면 갱신하고 새 값을 저장한 뒤 돌려준다.
 * 갱신에 실패해도 아직 유효하면 기존 토큰을 그대로 쓴다(오늘 게시를 막지 않기 위해).
 * @returns 토큰 문자열, 없거나 이미 만료됐으면 null
 */
export async function getAccessToken(platform: Platform): Promise<{ token: string | null; note: string }> {
  const { data, error } = await supabase
    .from('social_tokens')
    .select('platform, access_token, expires_at')
    .eq('platform', platform)
    .maybeSingle<TokenRow>()

  if (error) return { token: null, note: `토큰 조회 실패: ${error.message}` }
  if (!data) return { token: null, note: '저장된 토큰 없음 (Meta 화면에서 발급해 DB에 넣어야 함)' }

  const msLeft = new Date(data.expires_at).getTime() - Date.now()
  const daysLeft = msLeft / 86_400_000
  if (daysLeft <= 0) return { token: null, note: '토큰 만료됨 — 재발급 필요(갱신 불가)' }
  if (daysLeft > REFRESH_WINDOW_DAYS) return { token: data.access_token, note: `유효 ${Math.floor(daysLeft)}일` }

  // 만료가 가까움 → 갱신 시도
  try {
    const res = await fetch(REFRESH_ENDPOINT[platform](data.access_token))
    const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: unknown }
    if (!res.ok || !body.access_token) {
      return { token: data.access_token, note: `갱신 실패(남은 ${Math.floor(daysLeft)}일): ${JSON.stringify(body).slice(0, 150)}` }
    }
    const expiresAt = new Date(Date.now() + (body.expires_in ?? 60 * 86400) * 1000).toISOString()
    await supabase
      .from('social_tokens')
      .update({ access_token: body.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq('platform', platform)
    return { token: body.access_token, note: `갱신 완료 → ${expiresAt.slice(0, 10)}까지` }
  } catch (e) {
    return { token: data.access_token, note: `갱신 중 오류(남은 ${Math.floor(daysLeft)}일): ${String(e).slice(0, 120)}` }
  }
}

/**
 * 기록용 채널 이름. 토큰은 플랫폼당 하나지만(`Platform`), **게시 기록은 종류별로 나눈다.**
 * 일요일에는 일간과 주간이 같은 날 같은 계정에 올라가는데, `social_posts`의 하루 한 번
 * 잠금이 (platform, post_date)라서 이름이 같으면 둘째 것이 막힌다 (2026-08-23 주간 신설).
 */
export type PostChannel = Platform | 'threads_weekly' | 'instagram_weekly'

/** 오늘 이미 성공적으로 올렸는지 (같은 날 두 번 게시 방지) */
export async function alreadyPosted(platform: PostChannel, date: string): Promise<boolean> {
  const { data } = await supabase
    .from('social_posts')
    .select('id')
    .eq('platform', platform)
    .eq('post_date', date)
    .eq('status', 'success')
    .maybeSingle()
  return Boolean(data)
}

/** 게시 결과를 남긴다. 실패도 남겨야 "조용히 안 돌아간 날"을 나중에 알 수 있다. */
export async function recordPost(
  platform: PostChannel,
  date: string,
  status: 'success' | 'failed',
  postId?: string | null,
  detail?: string | null
): Promise<void> {
  await supabase.from('social_posts').insert({
    platform,
    post_date: date,
    status,
    post_id: postId ?? null,
    detail: detail?.slice(0, 500) ?? null,
  })
}
