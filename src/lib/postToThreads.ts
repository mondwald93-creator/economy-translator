/**
 * 스레드 자동 게시 — 2026-08-20 신설 (마케팅 로드맵 P3-6 · P4-7)
 *
 * 매일 아침 브리핑이 나오면 경번 전용 스레드 계정(@econ.5min)에 글을 올린다.
 * 사람 손이 들어가는 채널은 몇 주 안에 밀린다는 게 인스타 카드뉴스 4주 실측의 결론이라
 * (4시간 투입 → 유입 2명 → 휴업), 퍼뜨리는 일도 발행처럼 자동으로 돌린다.
 *
 * ⚠️ Meta 문서에서 확인한 제약 (2026-08-19 조사, 근거 = 01_로드맵_근거 📚 P1-7)
 *   - 게시는 2단계: 컨테이너 생성(POST /threads) → 게시(POST /threads_publish).
 *     사이에 30초 정도 기다리길 권장한다
 *   - **이미지 글에는 링크 미리보기 카드가 안 붙는다**(link_attachment는 텍스트 전용).
 *     그래서 텍스트 글 + 링크로 올린다. 링크 카드 그림은 우리 og 이미지가 자동으로 뜬다
 *   - 글자 수 500자 제한, 링크 5개 이하(초과 시 게시 실패)
 *   - 하루 250건 제한 (하루 1회라 여유)
 *   - "매우 높은 빈도로 같은 내용 반복"은 스팸 정책 대상 → 글 틀을 3개 돌려쓴다
 */
import { withUtm } from './utm'

const API = 'https://graph.threads.net/v1.0'
const MAX_TEXT = 500

/** 컨테이너 만든 뒤 게시까지 기다리는 시간 (문서 권장 30초) */
const PUBLISH_DELAY_MS = 30_000

export type ThreadsPostResult = { ok: boolean; postId?: string; detail: string }

/**
 * 글 틀 3개. 날짜(일)를 3으로 나눈 나머지로 고른다.
 * 매일 같은 문장이면 스팸으로 찍힐 수 있어서다. 내용이 아니라 말투만 바꾼다.
 */
export function buildPostText(opts: { date: string; headline: string; shareCard?: string | null }): string {
  const link = withUtm(`/briefing/${opts.date}`, 'threads')
  const day = Number(opts.date.slice(-2)) || 1
  const headline = opts.headline.trim()
  const sentence = (opts.shareCard ?? '').trim()

  const templates = [
    sentence ? `${sentence}\n\n${headline}\n\n👉 오늘 브리핑 ${link}` : `${headline}\n\n👉 오늘 브리핑 ${link}`,
    `${headline}\n\n무슨 말인지 3분이면 정리돼요.\n${link}`,
    `오늘 아침 경제 한눈에\n\n${headline}\n\n코스피·환율·금리까지 ${link}`,
  ]
  let text = templates[day % templates.length]

  // 500자를 넘으면 헤드라인을 줄인다(링크는 끝까지 살려야 클릭이 일어난다)
  if (text.length > MAX_TEXT) {
    const over = text.length - MAX_TEXT + 1
    const shortHeadline = headline.slice(0, Math.max(20, headline.length - over)) + '…'
    text = text.replace(headline, shortHeadline)
  }
  return text
}

/** 스레드에 텍스트 글 하나를 올린다. */
export async function postToThreads(
  token: string,
  text: string,
  opts: { delayMs?: number } = {}
): Promise<ThreadsPostResult> {
  // 1단계: 컨테이너 생성
  const createUrl = `${API}/me/threads?media_type=TEXT&text=${encodeURIComponent(text)}&access_token=${token}`
  const createRes = await fetch(createUrl, { method: 'POST' })
  const created = (await createRes.json()) as { id?: string; error?: { message?: string } }
  if (!createRes.ok || !created.id) {
    return { ok: false, detail: `컨테이너 생성 실패: ${created.error?.message ?? JSON.stringify(created).slice(0, 200)}` }
  }

  // 문서 권장 대기. 바로 게시하면 아직 준비가 안 돼 실패할 수 있다
  await new Promise(r => setTimeout(r, opts.delayMs ?? PUBLISH_DELAY_MS))

  // 2단계: 게시
  const publishUrl = `${API}/me/threads_publish?creation_id=${created.id}&access_token=${token}`
  const pubRes = await fetch(publishUrl, { method: 'POST' })
  const published = (await pubRes.json()) as { id?: string; error?: { message?: string } }
  if (!pubRes.ok || !published.id) {
    // 어디서 멈췄는지 알 수 있게 컨테이너 상태도 같이 물어본다
    let status = ''
    try {
      const s = await fetch(`${API}/${created.id}?fields=status,error_message&access_token=${token}`)
      status = JSON.stringify(await s.json()).slice(0, 200)
    } catch { /* 상태 조회 실패는 무시 */ }
    return {
      ok: false,
      detail: `게시 실패: ${published.error?.message ?? JSON.stringify(published).slice(0, 200)} / 컨테이너 상태 ${status}`,
    }
  }

  return { ok: true, postId: published.id, detail: '게시 완료' }
}
