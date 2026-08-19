/**
 * IndexNow — 새 페이지가 생기면 검색엔진에 즉시 알린다 (2026-08-19 신설, 마케팅 로드맵 P3-3)
 *
 * 무엇: 사이트가 검색엔진에 "이 주소 새로 생겼어요"라고 먼저 알려주는 공개 규약.
 *       참여 = Microsoft Bing · Naver · Seznam · Yandex · Yep. **구글은 참여하지 않는다**(구글은 사이트맵·크롤링 그대로).
 *       한 곳(api.indexnow.org)에 보내면 참여 엔진 전체로 전달된다.
 *
 * 왜: 검색 유입이 이 서비스의 상시 채널 1순위인데(마케팅 로드맵 P1-6),
 *     네이버·다음은 2026-08-19 실측으로 색인 0건이었다. 매일 새 브리핑이 생기니 알림이 붙으면 반영이 빨라진다.
 *
 * ⚠️ 지켜야 할 것
 *   - **발행에 성공한 뒤에만** 부른다. 없는 URL을 보내면 신뢰도가 깎인다
 *   - 키 파일이 실제로 열려야 한다: https://economytranslator.com/<KEY>.txt 안에 키 값만 (public/ 에 있음)
 *   - 응답 200(접수) / 202(접수, 키 확인 중) 둘 다 정상. 400 잘못된 형식 · 403 키 불일치 · 422 도메인 불일치 · 429 과다
 *   - 실패해도 발행 흐름을 막지 않는다(부가 기능이다)
 *
 * 설계 원본 = 전직로드맵/1_프로젝트/경제번역기/마케팅/02_P3_설계_2026-08-19.md (P3-3)
 */

const HOST = 'economytranslator.com'
const KEY = '311c0743daecebc6851f83ed32870e49'
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`
const ENDPOINT = 'https://api.indexnow.org/indexnow'

export type IndexNowResult = { ok: boolean; status: number; count: number; detail?: string }

/**
 * URL 목록을 검색엔진에 알린다.
 * @param urls 전체 주소(https://…) 목록. 우리 도메인이 아닌 주소는 걸러낸다(422 방지)
 */
export async function notifyIndexNow(urls: string[]): Promise<IndexNowResult> {
  const urlList = Array.from(new Set(urls)).filter(u => u.startsWith(`https://${HOST}/`))
  if (urlList.length === 0) return { ok: false, status: 0, count: 0, detail: '보낼 URL 없음' }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
    })
    const ok = res.status === 200 || res.status === 202
    let detail = ''
    if (!ok) detail = (await res.text().catch(() => '')).slice(0, 200)
    return { ok, status: res.status, count: urlList.length, detail }
  } catch (e) {
    return { ok: false, status: 0, count: urlList.length, detail: String(e).slice(0, 200) }
  }
}

/**
 * 오늘 브리핑이 새로 발행됐을 때 보낼 주소 묶음.
 * 홈(내용이 바뀜) · 브리핑 목록(한 줄 늘어남) · 그날 상세(새로 생김) 셋만 보낸다.
 * 용어 상세는 새로 생긴 날만 따로 넘기면 된다(daily_term이 신규일 때).
 */
export function briefingUrls(date: string, newTermSlug?: string | null): string[] {
  const base = `https://${HOST}`
  const urls = [`${base}/`, `${base}/briefing`, `${base}/briefing/${date}`]
  if (newTermSlug) urls.push(`${base}/dictionary/${newTermSlug}`)
  return urls
}
