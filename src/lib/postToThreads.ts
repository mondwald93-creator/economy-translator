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
 * 존댓말 문장을 반말로 바꾼다 (스레드 전용).
 *
 * ⚠️ AI를 한 번 더 부르지 않고 문자열 치환으로 끝낸다.
 *   이유: 발행당 AI 호출이 이미 3회라 비용·실패 지점을 늘리고 싶지 않고,
 *   브리핑 헤드라인·한 문장은 어미 종류가 한정돼 있어 치환으로 충분하다.
 *
 * 규칙은 **최근 8일치 실제 문장 16개로 검증해서 채웠다**(2026-08-20).
 * 처음엔 `~했어요/~해요/~예요`만 넣었다가 절반이 존댓말로 남는 걸 보고 늘렸다.
 * 실측에서 나온 어미: 했어요 · 됐어요 · 올랐어요 · 대요 · 래요 · 거든요 · 같아요 · 거라고 해요 · 상황이에요
 *
 * 못 바꾼 어미가 있으면 그 부분만 존댓말로 나간다. 글이 깨지는 것보다 낫다.
 * ⚠️ 규칙을 고치면 이 파일 아래 CASUAL_RULES 순서를 지킬 것 — **긴 것부터** 바꿔야 한다
 *   (짧은 규칙이 먼저 먹으면 "거라고 해요"가 "거라고 해"에서 멈추는 식으로 어색해진다).
 */
const CASUAL_RULES: [RegExp, string][] = [
  // 1) 여러 단어짜리 (제일 먼저)
  [/거라고 해요/g, '거래'],
  [/거라고 하네요/g, '거래'],
  [/것 같아요/g, '것 같아'],
  [/수 있어요/g, '수 있어'],
  [/수 없어요/g, '수 없어'],
  [/([가-힣])ㄹ 거예요/g, '$1ㄹ 듯'],
  [/일 거예요/g, '일 듯'],
  [/될 거예요/g, '될 듯'],
  [/할 거예요/g, '할 듯'],
  [/거예요/g, '듯'],
  // 2) 전언·이유 어미 (실측에서 가장 많았다)
  [/([가-힣])대요/g, '$1대'],
  [/([가-힣])래요/g, '$1래'],
  [/([가-힣])거든요/g, '$1거든'],
  [/([가-힣])잖아요/g, '$1잖아'],
  [/([가-힣])는데요/g, '$1는데'],
  [/([가-힣])군요/g, '$1군'],
  [/([가-힣])네요/g, '$1네'],
  // 3) ~어요 / ~아요 계열 (받침 있는 동사 과거형 포함)
  [/([가-힣])았어요/g, '$1았어'],
  [/([가-힣])었어요/g, '$1었어'],
  [/([가-힣])했어요/g, '$1했어'],
  [/([가-힣])졌어요/g, '$1졌어'],
  [/([가-힣])됐어요/g, '$1됐어'],
  [/있어요/g, '있어'],
  [/없어요/g, '없어'],
  // 4) 서술격 조사
  [/이에요/g, '이야'],
  [/예요/g, '야'],
  // 5) 남은 "…요"로 끝나는 흔한 활용
  [/([가-힣])세요/g, '$1세'],
  [/([가-힣])해요/g, '$1해'],
  [/([가-힣])져요/g, '$1져'],
  [/([가-힣])려요/g, '$1려'],
  [/([가-힣])켜요/g, '$1켜'],
  [/([가-힣])쳐요/g, '$1쳐'],
  [/([가-힣])와요/g, '$1와'],
  [/([가-힣])가요/g, '$1가'],
  [/([가-힣])봐요/g, '$1봐'],
  [/([가-힣])나요/g, '$1나'],
  [/([가-힣])워요/g, '$1워'],
  [/([가-힣])퍼요/g, '$1퍼'],
  [/([가-힣])려고요/g, '$1려고'],
  // 6) 그물망 (제일 마지막). 위에서 안 걸린 "~어요/~아요"를 통째로 잡는다.
  //    처음엔 `았어요`·`었어요`만 넣었다가 "올랐어요"(=랐+어요)가 새는 걸 실측에서 봤다.
  [/([가-힣])어요/g, '$1어'],
  [/([가-힣])아요/g, '$1아'],
]

export function toCasual(s: string): string {
  let text = s.trim()
  if (!text) return ''
  for (const [re, to] of CASUAL_RULES) text = text.replace(re, to)
  return text
}

/**
 * 글 틀 3개. 날짜(일)를 3으로 나눈 나머지로 고른다.
 * 매일 같은 문장이면 스팸으로 찍힐 수 있어서다. 내용이 아니라 말투만 바꾼다.
 *
 * 말투 = **반말**. 2026-08-20 사용자 결정.
 * 계정 첫 소개글을 반말·구어체로 올렸고("경제 뉴스를 읽고싶은데 뭔소린지 1도 모르겠따…ㅠ"),
 * 매일 글이 존댓말이면 계정 목소리가 둘로 갈린다. 스레드에서 읽히는 톤에 맞춘다.
 * ⚠️ 사이트 본문·뉴스레터는 존댓말 그대로다. 여기만 반말이다.
 */
export function buildPostText(opts: { date: string; headline: string; shareCard?: string | null }): string {
  const link = withUtm(`/briefing/${opts.date}`, 'threads')
  const day = Number(opts.date.slice(-2)) || 1
  // 헤드라인·한 문장은 사이트에서 존댓말로 생성된다("~했어요"). 스레드용으로만 반말로 바꾼다.
  const headline = toCasual(opts.headline)
  const sentence = toCasual(opts.shareCard ?? '')

  const templates = [
    sentence ? `${sentence}\n\n${headline}\n\n오늘 브리핑 보러가기 👉 ${link}` : `${headline}\n\n오늘 브리핑 보러가기 👉 ${link}`,
    `${headline}\n\n무슨 말인지 3분이면 정리됨\n${link}`,
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
