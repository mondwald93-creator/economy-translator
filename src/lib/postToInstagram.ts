/**
 * 인스타 자동 게시 — 2026-08-20 신설 (마케팅 로드맵 P3-6 · P4-8)
 *
 * 스레드와 같은 2단계지만 세 가지가 다르다. 전부 Meta 문서에서 확인한 것이다
 * (조사 원본 = 01_로드맵_근거 「P1-7 인스타」 6·7번 항목).
 *
 *   ① **그림이 필수다.** 텍스트만으로는 못 올린다. 그래서 카드 라우트를 따로 만들었다
 *      (`/api/card/instagram/<날짜>`). Meta 서버가 그 주소를 직접 가져간다 —
 *      "must be hosted on a publicly accessible server at the time of the attempt"
 *   ② **캡션 링크는 눌리지 않는다.** 스레드처럼 링크로 보낼 수 없어서 카드 안에
 *      주소를 크게 쓰고, 캡션은 "프로필 주소에서" 하고 유도만 한다
 *   ③ **컨테이너가 바로 준비되지 않는다.** 스레드는 30초 기다리면 됐지만 여기는
 *      Meta가 그림을 내려받아 처리하는 시간이 있어 `status_code`를 물어봐야 한다
 *
 * ⚠️ 문서는 "JPEG is the only image format supported"인데 우리 카드는 PNG다.
 *    8/14에 매경 403을 문서·추정만으로 단정했다가 틀린 적이 있어서,
 *    **먼저 PNG로 올려 보고 실제로 거부될 때만** 변환(sharp)을 붙인다.
 *    거부되면 `detail`에 그 응답이 그대로 남으므로 그걸 보고 판단한다.
 */
import { pickOpener } from './postToThreads'

const API = 'https://graph.instagram.com/v21.0'
const MAX_CAPTION = 2200

/** 컨테이너가 준비될 때까지 물어보는 간격·횟수 (최장 60초. 라우트 maxDuration 120초 안) */
const POLL_INTERVAL_MS = 5_000
const POLL_MAX = 12

export type InstagramPostResult = { ok: boolean; postId?: string; detail: string }

/**
 * 캡션에 붙는 해시태그 상한. 인스타가 2025-12-18에 **캡션 5개로 강제 제한**했다
 * (@creators 공식: "using fewer (up to 5) more targeted hashtags, rather than many
 * generic ones, can improve both your content's performance and people's experience").
 * 넘겨서 올리면 오류가 아니라 **조용히 잘리거나 게시가 실패**할 수 있어 코드에서 막는다.
 * ⚠️ 공식 발표문이 "gradually"라 아직 전면 적용이 아닐 수 있다
 *    (2026-08-21 실측: 7주 전 캡션 13개짜리 게시물이 살아 있었다). 그래도 상한은 지킨다.
 */
const MAX_HASHTAGS = 5

/**
 * 해시태그 (2026-08-21 확정).
 *
 * 고른 근거는 두 가지고 **둘 다 실측**이다. 지어낸 태그는 없다.
 *   ① `#경제뉴스` 태그가 붙은 인스타 게시물 20개를 열어 함께 쓰인 태그를 셌다
 *      → 재테크 6 · 경제 4 · 주식공부 3 · 주식투자 3 · 코스피 3 · 경제공부 2
 *   ② 어제(8/20) 스레드 주제 태그를 정할 때 니나님이 앱에서 직접 센 게시물 수
 *      → 경제뉴스 704 · 재테크 589 · 주식공부 388 · 경제 264
 *
 * `재테크`는 빈도 2위인데 뺐다. 투자 정보를 기대하고 오는 자리인데 경번은 조언을 안 한다
 * (스레드 태그를 고를 때 세운 기준을 그대로 적용). 기대한 게 없으면 바로 나간다.
 * `주식공부`·`주식투자`도 같은 이유 — 경번은 주식 전용이 아니라 뉴스 브리핑 전반이다.
 *
 * ⚠️ 태그 위치를 **캡션으로 둔 이유**: 요즘 계정들이 대댓글로 옮기는 건 5개 제한을 피해
 *    9~11개를 쓰려는 우회다(한국경제가 7주 전 캡션 13개 → 8/21 대댓글 9개로 옮겼다).
 *    5개 이하로 갈 거면 옮길 이유가 없고, 인스타 공식 검색 문서는 지금도
 *    "게시물이 검색에 걸리려면 키워드와 해시태그를 캡션에 넣어라, 댓글 말고"라고 한다.
 *    댓글 태그가 5개 한도에 합산되는지도 인스타가 밝힌 적이 없다.
 */
export const IG_HASHTAGS: string[] = ['경제뉴스', '경제공부', '마켓브리핑', '코스피', '경제']

/**
 * 캡션 = 첫 줄(스레드와 같은 계정 목소리) + 헤드라인(존댓말 원문) + 계정 소개·팔로우 유도 + 해시태그.
 * 첫 줄을 `pickOpener`로 공유하는 이유는 두 채널의 목소리를 하나로 두기 위해서다.
 *
 * 소개·유도 두 줄은 **2026-08-22에 니나님이 실제 게시물을 손으로 고쳐 정한 문구**를 그대로 옮겼다.
 * 바꿀 일이 생기면 인스타에 올라간 글과 이 문자열을 같이 고쳐야 한다(한쪽만 고치면 갈린다).
 *
 * ⚠️ **캡션에서 사이트 주소를 뺐다.** 인스타는 캡션 링크가 눌리지 않아서, 눌리지도 않는 긴 주소가
 *    자리만 차지하고 있었다. 주소는 카드 그림 하단에 40px로 크게 박혀 있다(`InstagramCard`).
 *
 * 🚨 **그래서 인스타 → 사이트 유입을 세는 꼬리표(utm)가 붙을 자리는 프로필 링크 하나뿐이다.**
 *    프로필 웹사이트가 맨 주소(`economytranslator.com`)이면 그 방문이 GA에서 전부 '직접 방문'으로
 *    뭉쳐서, 인스타가 유입에 효과가 있었는지 나중에 못 잰다. 프로필 링크는 반드시
 *    `economytranslator.com/?utm_source=instagram&utm_medium=social&utm_campaign=daily`
 *    (= `withUtm('/', 'instagram')`과 같은 값)로 둘 것. 링크 수정은 **인스타 앱에서만** 된다.
 */
export function buildCaption(opts: { date: string; headline: string }): string {
  const headline = opts.headline.trim()
  // 상한을 넘겨 넣어두면 인스타가 조용히 자르거나 거부한다. 여기서 먼저 자른다.
  const used = IG_HASHTAGS.slice(0, MAX_HASHTAGS)
  const tags = used.length ? `\n\n${used.map(t => `#${t}`).join(' ')}` : ''

  let caption =
    `${pickOpener(opts.date)}\n\n` +
    `${headline}\n\n` +
    `어려운 경제 뉴스, 매일 아침 5분이면 끝 ☕ 경제 왕초보 환영!\n` +
    `👉 팔로우하면 내일 브리핑이 와요 / 프로필 링크에서 오늘 브리핑 확인` +
    `${tags}`

  if (caption.length > MAX_CAPTION) caption = caption.slice(0, MAX_CAPTION - 1) + '…'
  return caption
}

/** 컨테이너가 준비됐는지 물어본다. FINISHED가 되어야 게시할 수 있다. */
async function waitUntilReady(token: string, containerId: string): Promise<{ ok: boolean; detail: string }> {
  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    const res = await fetch(`${API}/${containerId}?fields=status_code,status&access_token=${token}`)
    const body = (await res.json()) as { status_code?: string; status?: string; error?: { message?: string } }
    if (body.status_code === 'FINISHED') return { ok: true, detail: `준비 완료 (${(i + 1) * 5}초)` }
    if (body.status_code === 'ERROR' || body.status_code === 'EXPIRED') {
      return { ok: false, detail: `컨테이너 ${body.status_code}: ${body.status ?? JSON.stringify(body).slice(0, 200)}` }
    }
    // IN_PROGRESS면 계속 기다린다
  }
  return { ok: false, detail: `${(POLL_MAX * POLL_INTERVAL_MS) / 1000}초 안에 준비되지 않음` }
}

/** 인스타에 그림 한 장 + 캡션을 올린다. */
export async function postToInstagram(
  token: string,
  imageUrl: string,
  caption: string
): Promise<InstagramPostResult> {
  // 1단계: 컨테이너 생성
  const createUrl =
    `${API}/me/media?image_url=${encodeURIComponent(imageUrl)}` +
    `&caption=${encodeURIComponent(caption)}&access_token=${token}`
  const createRes = await fetch(createUrl, { method: 'POST' })
  const created = (await createRes.json()) as { id?: string; error?: { message?: string } }
  if (!createRes.ok || !created.id) {
    return {
      ok: false,
      detail: `컨테이너 생성 실패: ${created.error?.message ?? JSON.stringify(created).slice(0, 250)}`,
    }
  }

  // 2단계: 준비될 때까지 기다린다 (Meta가 그림을 내려받아 처리하는 시간)
  const ready = await waitUntilReady(token, created.id)
  if (!ready.ok) return { ok: false, detail: ready.detail }

  // 3단계: 게시
  const pubRes = await fetch(`${API}/me/media_publish?creation_id=${created.id}&access_token=${token}`, {
    method: 'POST',
  })
  const published = (await pubRes.json()) as { id?: string; error?: { message?: string } }
  if (!pubRes.ok || !published.id) {
    return {
      ok: false,
      detail: `게시 실패: ${published.error?.message ?? JSON.stringify(published).slice(0, 250)}`,
    }
  }

  return { ok: true, postId: published.id, detail: `게시 완료 · ${ready.detail}` }
}
