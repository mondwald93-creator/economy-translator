/**
 * 유입 경로 꼬리표(UTM) — 2026-08-19 신설 (마케팅 로드맵 P3-1)
 *
 * 왜: 밖에서 들어온 사람이 GA에 전부 "(direct)"로 잡혀 어디서 왔는지 알 수 없었다.
 *     7/24 오픈채팅 15명도 사용자 증언으로 정체를 맞춰야 했다.
 *
 * ⚠️ 규칙 두 개만 지키면 된다.
 *   ① 밖에서 들어오는 링크에만 붙인다. 사이트 안 링크에는 절대 붙이지 않는다
 *      (붙이면 GA가 우리 자신을 유입원으로 세서 경로 집계가 망가진다)
 *   ② 값은 소문자 고정. 한 글자만 달라도 GA에서 다른 채널로 갈린다 → 그래서 아래 상수로만 쓴다
 *
 * 설계 원본 = 전직로드맵/1_프로젝트/경제번역기/마케팅/02_P3_설계_2026-08-19.md (P3-1)
 */

export const SITE_URL = 'https://economytranslator.com'

/** 채널별 고정 꼬리표. 새 채널은 여기에만 추가한다. */
export const UTM = {
  threads: { source: 'threads', medium: 'social', campaign: 'daily' },
  instagram: { source: 'instagram', medium: 'social', campaign: 'daily' },
  email: { source: 'email', medium: 'email', campaign: 'daily' },
  linkedin: { source: 'linkedin', medium: 'social', campaign: 'launch' },
  disquiet: { source: 'disquiet', medium: 'community', campaign: 'launch' },
  geeknews: { source: 'geeknews', medium: 'community', campaign: 'launch' },
} as const

export type UtmChannel = keyof typeof UTM

/**
 * 밖에 뿌릴 링크를 만든다.
 * @param path  사이트 안 경로. '/' 또는 '/briefing/2026-08-20' 처럼 슬래시로 시작
 * @param channel  UTM 표의 채널 이름
 *
 * 예) withUtm('/briefing/2026-08-20', 'threads')
 *  → https://economytranslator.com/briefing/2026-08-20?utm_source=threads&utm_medium=social&utm_campaign=daily
 */
export function withUtm(path: string, channel: UtmChannel): string {
  const { source, medium, campaign } = UTM[channel]
  const url = new URL(path.startsWith('/') ? path : `/${path}`, SITE_URL)
  url.searchParams.set('utm_source', source)
  url.searchParams.set('utm_medium', medium)
  url.searchParams.set('utm_campaign', campaign)
  return url.toString()
}
