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
import { withUtm } from './utm'
import { pickOpener } from './postToThreads'

const API = 'https://graph.instagram.com/v21.0'
const MAX_CAPTION = 2200

/** 컨테이너가 준비될 때까지 물어보는 간격·횟수 (최장 60초. 라우트 maxDuration 120초 안) */
const POLL_INTERVAL_MS = 5_000
const POLL_MAX = 12

export type InstagramPostResult = { ok: boolean; postId?: string; detail: string }

/**
 * 해시태그.
 * ⚠️ **아직 비어 있다. 니나님 확인 전까지 채우지 않는다.**
 * 인스타에서 해시태그는 유입 경로 자체라 아무 단어나 넣으면 엉뚱한 사람이 온다.
 * 무엇을 달지는 고르는 사람이 정할 일이지 내가 지어낼 값이 아니다
 * (2026-08-20: 문장을 지어내 넣었다가 지적받은 건과 같은 자리).
 * 값이 정해지면 여기 배열만 채우면 캡션에 붙는다.
 */
export const IG_HASHTAGS: string[] = []

/**
 * 캡션 = 첫 줄(스레드와 같은 계정 목소리) + 헤드라인(존댓말 원문) + 주소 안내 + 해시태그.
 * 첫 줄을 `pickOpener`로 공유하는 이유는 두 채널의 목소리를 하나로 두기 위해서다.
 */
export function buildCaption(opts: { date: string; headline: string }): string {
  const headline = opts.headline.trim()
  // 눌리지 않는 링크라도 꼬리표는 붙여둔다. 프로필 링크에 같은 값을 넣어두면
  // 사람이 주소를 보고 찾아온 경우와 프로필을 눌러 온 경우가 GA에서 같은 칸으로 모인다.
  const link = withUtm('/', 'instagram')
  const tags = IG_HASHTAGS.length ? `\n\n${IG_HASHTAGS.map(t => `#${t}`).join(' ')}` : ''

  let caption =
    `${pickOpener(opts.date)}\n\n` +
    `${headline}\n\n` +
    `전체 브리핑은 프로필 주소에서 볼 수 있어\n` +
    `${link}${tags}`

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
