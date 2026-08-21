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

/**
 * 주제 태그 — 스레드가 글을 묶어 보여주는 값. **글 하나에 1개만** 붙는다(Meta 문서).
 * 1~50자, 마침표(.)와 &는 못 쓴다.
 *
 * 팔로워가 없는 계정 글은 팔로우 타임라인에 아무한테도 안 뜬다. 그래서 이 태그가
 * 사실상 유일한 발견 경로다. 실제로 8/20·8/21 자동 게시 두 건은 태그가 없어 조회 0이었고,
 * 사용자가 태그 '경제'를 붙여 쓴 소개글만 조회 8이었다(2026-08-21 API 실측).
 *
 * **'경제뉴스'로 정한 근거** = 2026-08-21 사용자가 스레드 앱에서 직접 센 최근 게시물 수.
 *   경제뉴스 704 · 재테크 589 · 주식공부 388 · 경제 264 · 경제공부 없음
 * 넓은 말인 '경제'가 오히려 적었다(Claude 추측과 반대. 앱에서 직접 안 봤으면 264짜리에 붙일 뻔했다).
 * 성격도 여기가 맞다 — 재테크·주식공부는 투자 정보를 기대하는 자리인데 경번은 조언을 하지 않는다.
 *
 * ⚠️ 태그 값을 바꾸려면 실제로 글이 쌓여 있는 태그인지 앱에서 먼저 확인할 것.
 *    없는 태그를 지어 붙이면 아무도 안 본다(그래서 '경제공부'를 뺐다).
 */
const TOPIC_TAG = '경제뉴스'

export type ThreadsPostResult = { ok: boolean; postId?: string; detail: string }

/**
 * 첫 줄 후보 — 요일과 상관없이 아무 날에나 쓰는 7개.
 *
 * 전부 사용자와 함께 고른 원문이다. **Claude가 임의로 문장을 늘리지 말 것**
 * (2026-08-20 사고: 지어낸 문장 2개 + 근거 없는 "3분"을 넣었다가 지적받음.
 *  사이트·계정 소개글은 전부 "5분"이다).
 */
const OPENERS: ((label: string) => string)[] = [
  l => `${l} 브리핑 등장! 보러갈 사람🙋‍♀️`,
  l => `오늘도 무사히 발행됐다... ${l} 브리핑🙋‍♀️`,
  l => `경제 뉴스 봐야지 하고 미뤘던 사람 여기여기🙋‍♀️\n${l} 브리핑 나왔어`,
  l => `${l} 경제 뭐 있었냐면...🙋‍♀️`,
  l => `오늘도 5분컷 가능! ${l} 브리핑🙋‍♀️`,
  l => `경제알못들 모여라~ ${l} 브리핑 왔다🙋‍♀️`,
  l => `아침에 뉴스 볼 시간 없었지? ${l} 브리핑 요약해왔어🙋‍♀️`,
]

/**
 * 요일 전용 첫 줄. 인덱스 = `Date#getUTCDay()` (0=일 … 6=토).
 * 그날 요일 것 하나만 후보에 넣으므로 엉뚱한 요일에 나갈 수 없다.
 * 주말에도 브리핑은 발행된다(8/15 토·8/16 일 실측 200) → 7개 전부 있어야 한다.
 */
const WEEKDAY_OPENERS: ((label: string) => string)[] = [
  l => `일요일 느긋하게 ${l} 브리핑 보고 한 주 준비🙋‍♀️`,
  l => `월요일 아침부터 빡세지만... ${l} 브리핑은 보고 가자🙋‍♀️`,
  l => `화요일! 주말 아직 멀었어... ${l} 브리핑 왔어🙋‍♀️`,
  l => `수요일이면 절반은 온 거임 ${l} 브리핑🙋‍♀️`,
  l => `목요일... 하루만 더 버티자 ${l} 브리핑🙋‍♀️`,
  l => `드디어 금요일! ${l} 브리핑 보고 주말 시작🙋‍♀️`,
  l => `토요일에도 발행됐어 ${l} 브리핑🙋‍♀️`,
]

/**
 * 'YYYY-MM-DD'의 요일 (0=일 … 6=토).
 * UTC 자정으로 고정해 서버 시간대의 영향을 없앤다. 날짜 문자열 자체가 이미 KST 기준으로
 * 확정된 값이라 여기서 +9h를 또 더하면 안 된다(CLAUDE.md "날짜 처리" 규칙).
 */
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

/** '2026-08-20' → '8월 20일' */
export function dateLabelOf(date: string): string {
  const [, mm, dd] = date.split('-')
  return `${Number(mm)}월 ${Number(dd)}일`
}

/**
 * 그날의 첫 줄을 고른다. **인스타 캡션도 이 함수를 쓴다** — 두 채널의 목소리를
 * 하나로 두려는 것이고, 문장을 또 지어내지 않으려는 것이기도 하다.
 */
export function pickOpener(date: string): string {
  const label = dateLabelOf(date)
  const day = Number(date.split('-')[2]) || 1
  const candidates = [WEEKDAY_OPENERS[weekdayOf(date)], ...OPENERS]
  return candidates[day % candidates.length](label)
}

/**
 * 글 구조 = **부르는 첫 줄(반말·계정 목소리) + 브리핑 헤드라인(존댓말 원문) + 링크.**
 *
 * 2026-08-20 사용자 결정. 처음엔 브리핑 문장까지 전부 반말로 바꿔봤는데
 * ("SK하이닉스 자사주 매입했어 / 코스피·환율·금리까지…") 사용자 판정이 "개딱딱하다"였다.
 * 어미만 반말이고 말투는 여전히 홍보 문구였던 게 원인이다.
 * → 브리핑 본문은 사이트 원문(존댓말) 그대로 두고, **첫 줄 하나만** 계정 목소리로 부른다.
 *   계정 소개글이 "…뭔소린지 1도 모르겠따…ㅠ / 많관부🥱" 결이라 첫 줄이 그 역할을 한다.
 *
 * 첫 줄은 **그날 요일 문장 1개 + 요일 무관 7개 = 8개**에서 날짜(일)%8로 고른다.
 * 매일 같은 문장은 스팸 정책 대상이라서다. 요일 문장은 매달 8·16·24일에 걸리는데,
 * 그 날짜의 요일은 달마다 바뀌므로 특정 요일에만 몰리지 않는다.
 * ⚠️ 「오늘의 한 문장」(share_card)은 넣지 않는다 — 헤드라인과 내용이 겹쳐 장황해진다(사용자 지적).
 */
export function buildPostText(opts: { date: string; headline: string; shareCard?: string | null }): string {
  const link = withUtm(`/briefing/${opts.date}`, 'threads')
  const headline = opts.headline.trim()

  let text = `${pickOpener(opts.date)}\n\n${headline}\n\n${link}`

  // 500자를 넘으면 헤드라인을 줄인다(링크는 끝까지 살려야 클릭이 일어난다)
  if (text.length > MAX_TEXT) {
    const over = text.length - MAX_TEXT + 1
    const shortHeadline = headline.slice(0, Math.max(20, headline.length - over)) + '…'
    text = text.replace(headline, shortHeadline)
  }
  return text
}

/** 지금 붙는 주제 태그 (점검용 `?dry=1` 응답에서도 보여준다) */
export function currentTopicTag(): string {
  return TOPIC_TAG
}

/** 글 담을 그릇을 만든다. 태그를 붙일 때와 뺄 때 둘 다 여기를 지난다. */
async function createContainer(token: string, text: string, topicTag: string | null) {
  const params = new URLSearchParams({ media_type: 'TEXT', text, access_token: token })
  if (topicTag) params.set('topic_tag', topicTag)

  const res = await fetch(`${API}/me/threads?${params.toString()}`, { method: 'POST' })
  const json = (await res.json()) as { id?: string; error?: { message?: string } }
  return {
    id: res.ok ? json.id : undefined,
    reason: json.error?.message ?? JSON.stringify(json).slice(0, 200),
  }
}

/** 스레드에 텍스트 글 하나를 올린다. */
export async function postToThreads(
  token: string,
  text: string,
  opts: { delayMs?: number; topicTag?: string | null } = {}
): Promise<ThreadsPostResult> {
  const topicTag = opts.topicTag === undefined ? TOPIC_TAG : opts.topicTag

  // 1단계: 컨테이너 생성
  let created = await createContainer(token, text, topicTag)
  let tagNote = topicTag ? ` (주제 '${topicTag}')` : ''

  // 태그 때문에 막힌 거라면 태그를 빼고 한 번 더 시도한다.
  // 태그는 덤이고 **매일 글이 나가는 게 본질**이라, 덤 때문에 그날 게시가 통째로
  // 빠지면 안 된다. 태그가 빠진 채 올라간 건 아래 detail에 남아 다음 날 눈에 띈다.
  if (!created.id && topicTag) {
    const retry = await createContainer(token, text, null)
    if (retry.id) {
      created = retry
      tagNote = ` (⚠️ 주제 '${topicTag}' 거부돼 태그 없이 올림: ${created.reason || '사유 없음'})`
    }
  }

  if (!created.id) {
    return { ok: false, detail: `컨테이너 생성 실패${tagNote}: ${created.reason}` }
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

  return { ok: true, postId: published.id, detail: `게시 완료${tagNote}` }
}
