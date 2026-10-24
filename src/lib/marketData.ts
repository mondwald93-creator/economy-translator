import { KeyIndicator } from '@/types'

interface YahooMeta {
  regularMarketPrice: number
  regularMarketTime?: number
  previousClose?: number
  chartPreviousClose?: number
}

// 등락률의 기준값(직전 종가)을 어디서 가져왔는지까지 들고 다닌다(2026-10-19).
interface Quote {
  price: number
  prev: number | null // null = 기준을 믿을 수 없어 등락률을 안 낸다(2026-10-24, 「확인 불가」)
  basis: string // 예: '10/16 종가 794.78' · '24시간 전 10/18 06:00 1,334.2'. DB에 남겨 나중에 검산한다
}

type Bar = { t: number; close: number } // t = 봉 시작 시각(초, UTC)

const DAY = 24 * 60 * 60
// 초(UTC) → KST 날짜 'YYYY-MM-DD'. +9h 한 번만 쓴다(timeZone 옵션과 같이 쓰지 말 것 — CLAUDE.md 날짜 규칙)
const kstDate = (sec: number) => new Date((sec + 9 * 60 * 60) * 1000).toISOString().slice(0, 10)
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

async function fetchChart(symbol: string, interval: string, range: string): Promise<{ meta: YahooMeta; bars: Bar[] } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`,
      { next: { revalidate: 0 }, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    const r = json?.chart?.result?.[0]
    const meta = r?.meta as YahooMeta | undefined
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null
    const ts: number[] = r?.timestamp ?? []
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? []
    const bars = ts
      .map((t, i) => ({ t, close: closes[i] as number }))
      .filter(b => typeof b.close === 'number' && !isNaN(b.close))
    return { meta, bars }
  } catch {
    return null
  }
}

/**
 * 지수(코스피·코스닥)의 직전 거래일 종가를 **날짜로** 찾는다.
 *
 * ⚠️ 야후 chartPreviousClose를 쓰지 말 것 — 2026-10-19 실측.
 *    9:07 발행 때 야후 코스닥 일봉에 전날 봉이 아직 안 올라온 날이 많다. 그때 chartPreviousClose는
 *    「마지막으로 올라온 봉의 전날」 = 이틀 전 종가가 되고, 값(regularMarketPrice)은 전날 종가라서
 *    등락률이 이틀치로 찍혔다. 8/15~10/19 66일 중 33일(방향까지 반대인 날 포함: 10/3 실제 −0.11% → +4.37%).
 *    코스피는 66일 모두 맞았다(봉이 제때 올라옴). 9/25 감사 R2 · 10/6 점검에서 같은 증상을 봤다.
 *    기준금리 ECOS 사고(아래 fetchBaseRate ⚠️)와 같은 병이다 — 자리는 날짜를 대신하지 못한다.
 * 방법: 값이 찍힌 시각(regularMarketTime)의 KST 날짜보다 앞선 봉 중 마지막 봉의 종가.
 *       전날 봉이 늦게 올라와도, 주말·휴장이 끼어도 「값의 날짜 바로 앞 거래일」이 된다.
 */
export function prevCloseByDate(bars: Bar[], anchorSec: number): { close: number; date: string } | null {
  const anchor = kstDate(anchorSec)
  let found: Bar | null = null
  for (const b of bars) if (kstDate(b.t) < anchor) found = b
  return found ? { close: found.close, date: kstDate(found.t) } : null
}

// 'YYYY-MM-DD' 두 날짜 사이(양끝 제외)의 평일 수
export function weekdaysBetween(a: string, b: string): number {
  let n = 0
  for (let t = Date.parse(`${a}T00:00:00Z`) + DAY * 1000; t < Date.parse(`${b}T00:00:00Z`); t += DAY * 1000) {
    const w = new Date(t).getUTCDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}

/**
 * 야후 일봉으로 찾은 직전 종가가 의심스러우면 이유를, 멀쩡하면 null.
 *
 * ⚠️ 마지막 봉만 늦는 게 아니다 — 2026-10-24 실측.
 *    10/23 9:07 발행 때 코스피·코스닥 둘 다 기준이 「10/20 종가」로 잡혀 10/22 하루 −3.52%·−3.62%가
 *    −0.34%·−2.29%로 나갔다(10/21을 건너뜀). 지금 야후엔 10/21 봉이 있다 = 그 순간만 중간 봉이 비었거나
 *    (종가 null인 봉은 fetchChart가 버린다) 값 시각(regularMarketTime)이 하루 늦었다. 둘 다 같은 결과라 기록 없이 못 가린다.
 *    채점기는 같은 지표를 정답으로 대조해 「사실」 만점을 줬다. 그날 건강진단 금융 칸에도 틀린 숫자가 들어갔다.
 * 의심 = ① 기준일과 값 날짜 사이에 평일이 낀다(봉 누락 또는 휴장) ② 값 날짜의 봉 종가가 값과 다르다
 *        ③ 값 날짜보다 뒤 봉이 있다(②·③ = 값 시각이 늦게 갱신됨). 판정은 네이버 거래일로 한다(아래 resolve).
 */
export function suspectIndexBasis(bars: Bar[], anchorSec: number, price: number, prevDate: string): string | null {
  const anchor = kstDate(anchorSec)
  if (weekdaysBetween(prevDate, anchor) > 0) return `야후 기준 ${md(prevDate)} · 값 ${md(anchor)} 사이 평일 빔`
  const anchorBar = bars.find(b => kstDate(b.t) === anchor)
  if (anchorBar && Math.abs(anchorBar.close / price - 1) > 0.001) return `야후 ${md(anchor)} 봉 ${anchorBar.close.toFixed(2)} ≠ 값`
  if (bars.some(b => kstDate(b.t) > anchor)) return `야후 값 시각 ${md(anchor)} 뒤 봉 있음`
  return null
}

type DailyClose = { date: string; close: number } // date = 거래일 'YYYY-MM-DD'

/**
 * 거래일 종가 목록(오름차순)에서 값의 직전 거래일 종가를 찾는다.
 * 값과 같은 종가가 있으면 그날을 값의 날짜로 본다(값 시각이 늦게 갱신돼도 흔들리지 않게). 장중이면 값 시각의 날짜.
 */
export function prevCloseFromDaily(rows: DailyClose[], price: number, anchorDate: string): DailyClose | null {
  const same = [...rows].reverse().find(r => Math.abs(r.close - price) < 0.005)
  const valueDate = same?.date ?? anchorDate
  let found: DailyClose | null = null
  for (const r of rows) if (r.date < valueDate) found = r
  return found
}

// 네이버 증권 지수 일별 시세. 한국거래소 거래일 그대로라 휴장일이 빠져 있다. 야후가 의심스러울 때만 부른다(2026-10-24)
async function fetchNaverDaily(code: 'KOSPI' | 'KOSDAQ'): Promise<DailyClose[] | null> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/index/${code}/price?pageSize=10&page=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!Array.isArray(json)) return null
    const rows = (json as { localTradedAt?: string; closePrice?: string }[])
      .map(r => ({ date: String(r?.localTradedAt ?? ''), close: parseFloat(String(r?.closePrice ?? '').replace(/,/g, '')) }))
      .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && !isNaN(r.close))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

/**
 * 환율의 「하루 전 같은 시각」 값을 시간봉에서 찾는다.
 *
 * ⚠️ 환율에 일봉 기준(chartPreviousClose)을 쓰지 말 것 — 2026-10-19 실측.
 *    야후 외환의 하루 경계는 KST 08:00(런던 자정)이라, 9:07 발행 때 「직전 종가」는 1시간 전 값이다.
 *    그래서 저장된 환율 등락률이 +0.01% · −0.02% · 0.00%처럼 사실상 최근 1시간 변동이었다
 *    (9/22 저장 −0.37% ↔ 24시간 기준 −1.75%). 9/25 감사 「환율 ▲▼가 사이트 전날 값과 반대」의 원인.
 * 방법: 값이 찍힌 시각(regularMarketTime)에서 24시간 전 이전에 끝난 마지막 시간봉의 종가.
 *       주말엔 금요일 마감값으로 떨어지므로 토·일은 금요일 하루 변동, 월요일은 금요일 마감 대비가 된다.
 */
export function priceHoursAgo(bars: Bar[], anchorSec: number, hours: number, barSec = 60 * 60): { close: number; t: number } | null {
  const target = anchorSec - hours * 60 * 60
  let found: Bar | null = null
  for (const b of bars) if (b.t + barSec <= target) found = b
  return found ? { close: found.close, t: found.t + barSec } : null
}

async function fetchIndexQuote(symbol: string, naverCode: 'KOSPI' | 'KOSDAQ', digits: number): Promise<Quote | null> {
  const chart = await fetchChart(symbol, '1d', '10d')
  if (!chart) return null
  const { meta, bars } = chart
  const anchor = meta.regularMarketTime ?? Math.floor(Date.now() / 1000)
  const prev = prevCloseByDate(bars, anchor)
  if (prev) {
    const price = meta.regularMarketPrice
    const yahooBasis = `${md(prev.date)} 종가 ${prev.close.toFixed(digits)}`
    const why = suspectIndexBasis(bars, anchor, price, prev.date)
    if (!why) return { price, prev: prev.close, basis: yahooBasis }
    // 의심 → 네이버 거래일로 판정. 같은 날이면(휴장 등) 야후 그대로, 봉이 빠졌으면 네이버 종가, 네이버도 못 받으면 등락률을 안 낸다.
    // 판정 이유는 basis(DB)에 남긴다 — Vercel 로그는 금방 사라진다
    const rows = await fetchNaverDaily(naverCode)
    const n = rows ? prevCloseFromDaily(rows, price, kstDate(anchor)) : null
    console.warn(`[marketData] ${symbol} 기준 의심(${why}) → 네이버 ${n ? `${n.date} ${n.close}` : '실패'} · 야후 봉 ${bars.map(b => kstDate(b.t).slice(5)).join(',')} · 값 시각 ${new Date((anchor + 9 * 60 * 60) * 1000).toISOString().slice(0, 16)}`)
    if (!n) return { price, prev: null, basis: `확인 불가(${why} · 네이버 실패)` }
    if (n.date === prev.date) return { price, prev: prev.close, basis: `${yahooBasis}(네이버 일치 · ${why})` }
    return { price, prev: n.close, basis: `${md(n.date)} 종가 ${n.close.toFixed(digits)}(네이버 · ${why})` }
  }
  // 봉을 못 받으면 예전 방식으로라도 낸다(지표가 통째로 빠지는 것보다 낫다). 기준이 다르다는 걸 basis에 남긴다
  const fallback = meta.previousClose ?? meta.chartPreviousClose
  if (typeof fallback !== 'number') return null
  console.warn(`[marketData] ${symbol} 일봉에서 직전 종가를 못 찾음 → 야후 previousClose로 대신`)
  return { price: meta.regularMarketPrice, prev: fallback, basis: `야후 직전 종가(대체) ${fallback.toFixed(digits)}` }
}

async function fetchFxQuote(symbol: string): Promise<Quote | null> {
  const chart = await fetchChart(symbol, '1h', '5d')
  if (!chart) return null
  const { meta, bars } = chart
  const anchor = meta.regularMarketTime ?? Math.floor(Date.now() / 1000)
  const ago = priceHoursAgo(bars, anchor, 24)
  if (ago) {
    const hm = new Date((ago.t + 9 * 60 * 60) * 1000).toISOString().slice(11, 16)
    return { price: meta.regularMarketPrice, prev: ago.close, basis: `24시간 전 ${md(kstDate(ago.t))} ${hm} ${ago.close.toFixed(1)}` }
  }
  const fallback = meta.previousClose ?? meta.chartPreviousClose
  if (typeof fallback !== 'number') return null
  console.warn(`[marketData] ${symbol} 시간봉에서 24시간 전 값을 못 찾음 → 야후 previousClose로 대신`)
  return { price: meta.regularMarketPrice, prev: fallback, basis: `야후 직전 종가(대체) ${fallback.toFixed(1)}` }
}

function buildIndicator(
  name: string,
  q: Quote,
  formatter: (v: number) => string
): Omit<KeyIndicator, 'easyExplanation'> {
  const prev = q.prev
  // 기준을 믿을 수 없으면 틀린 등락률을 내느니 비워 둔다. ▲▼가 없으니 AI도 방향을 쓰지 않는다
  if (prev === null) return { name, value: formatter(q.price), change: '— 확인 불가', direction: 'flat', basis: q.basis }
  const change = q.price - prev
  const pct = prev !== 0 ? (change / prev) * 100 : 0
  // 표시 소수 2자리 기준으로 판정 → 변동이 0.00%로 떨어지면(거의 무변동) '보합'으로 통일
  const pctRounded = Math.round(pct * 100) / 100
  const arrow = pctRounded > 0 ? '▲' : pctRounded < 0 ? '▼' : '—'
  const changeStr = pctRounded === 0
    ? '— 보합'
    : `${arrow} ${pctRounded > 0 ? '+' : ''}${pctRounded.toFixed(2)}%`
  return {
    name,
    value: formatter(q.price),
    change: changeStr,
    direction: pctRounded > 0 ? 'up' : pctRounded < 0 ? 'down' : 'flat',
    basis: q.basis,
  }
}

// 스크래핑/조회 실패 또는 키 미설정 시 쓰는 비상값. 한국은행 현재 기준금리 기준으로 최신화할 것.
// (2026-08-27 금통위에서 2.75% → 3.00%로 인상. 그 전은 2026-07-16에 2.50% → 2.75%.
//  과거 3.50%는 '최종금리 전망치'였고 현재값이 아니었음)
// ⚠️ 금통위가 금리를 움직이면 여기도 같이 고칠 것. 안 고치면 ECOS가 죽은 날 옛 금리가 나간다.
const FALLBACK_BASE_RATE: Omit<KeyIndicator, 'easyExplanation'> = {
  name: '기준금리',
  value: '3.00%',
  change: '— 유지',
  direction: 'flat',
}

// 한국은행 기준금리: ECOS 공식 OpenAPI(일별 시계열)에서 최신값 사용.
// (옛 네이버 채권 페이지 스크래핑은 페이지가 404로 사라져 폐기 — 2026-06-19)
// 통계표 722Y001 / 항목 0101000(한국은행 기준금리) / 주기 D(일별), 키는 환경변수 ECOS_API_KEY.
//
// ⚠️ 날짜(TIME)를 버리지 말 것 — 2026-09-01 사고 실측.
//    ECOS 일별 금리는 며칠 늦게 올라온다(9/1에 조회하면 8/29까지 = 3일 지연).
//    값만 배열에 담고 '마지막 두 자리'로 비교하면, 금리가 바뀐 날의 값이 지연 기간 내내
//    맨 끝에 머물러 매일 아침 '▲ 인상'이 새로 찍힌다. 실제로 8/28·29·30 사흘 연속 인상으로
//    나갔고, 8/31에 지연이 풀리며 저절로 '유지'로 돌아왔다(채점기는 셋 중 8/29만 잡아냄).
//    자리는 날짜를 대신하지 못한다. 짝을 지으려면 열쇠(날짜)를 들고 있어야 한다.
//    2026-07-21에도 같은 증상을 한 번 고쳤는데, 그때 지연을 계산에 안 넣어 병이 남아 있었다.
async function fetchBaseRate(): Promise<Omit<KeyIndicator, 'easyExplanation'>> {
  const apiKey = process.env.ECOS_API_KEY
  if (!apiKey) return FALLBACK_BASE_RATE
  try {
    const ymd = (d: Date) =>
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
    const end = new Date()
    const start = new Date(end.getTime() - 60 * 24 * 60 * 60 * 1000) // 최근 60일 (데이터 며칠 지연 대비)
    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/100/722Y001/D/${ymd(start)}/${ymd(end)}/0101000`
    const res = await fetch(url, { next: { revalidate: 0 }, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return FALLBACK_BASE_RATE
    const json = await res.json()
    const rows = json?.StatisticSearch?.row
    if (Array.isArray(rows) && rows.length > 0) {
      // ECOS는 날짜 오름차순. 가끔 값이 비어 와(NaN) 비상값으로 떨어지므로 숫자로 읽히는 행만 쓴다.
      // 날짜(TIME)는 여기서 함께 들고 간다 — 위 ⚠️ 참고.
      const series = (rows as { TIME?: string; DATA_VALUE?: string }[])
        .map(r => ({ time: String(r?.TIME ?? ''), value: parseFloat(r?.DATA_VALUE ?? '') }))
        .filter(r => /^\d{8}$/.test(r.time) && !isNaN(r.value))
      if (series.length > 0) {
        const latest = series[series.length - 1]
        const round2 = (v: number) => Math.round(v * 100) / 100
        // 마지막으로 값이 '바뀐' 지점을 뒤에서부터 찾는다. 자리가 아니라 날짜를 들고 찾으므로
        // ECOS가 며칠 늦어도 "언제 바뀌었는지"는 흔들리지 않는다.
        let changedAt: { time: string; from: number } | null = null
        for (let i = series.length - 1; i > 0; i--) {
          if (round2(series[i].value) !== round2(series[i - 1].value)) {
            changedAt = { time: series[i].time, from: series[i - 1].value }
            break
          }
        }
        // 표기에 변동일을 함께 적는다(2026-09-01 사용자 결정).
        // '▲ 인상'만 적으면 지연 기간 동안 '오늘 올랐다'로 읽히지만,
        // '▲ 8/27 인상'은 언제 읽어도 참이라 오독될 수가 없다.
        const md = (t: string) => `${Number(t.slice(4, 6))}/${Number(t.slice(6, 8))}`
        const direction: KeyIndicator['direction'] =
          changedAt === null ? 'flat' : round2(latest.value) > round2(changedAt.from) ? 'up' : 'down'
        const change =
          changedAt === null
            ? '— 유지'
            : `${direction === 'up' ? '▲' : '▼'} ${md(changedAt.time)} ${direction === 'up' ? '인상' : '인하'}`
        return {
          name: '기준금리',
          value: `${latest.value.toFixed(2)}%`,
          change,
          direction,
        }
      }
    }
  } catch {}
  return FALLBACK_BASE_RATE
}

/**
 * 지표 한 줄을 AI(생성·채점)에게 넘길 때 쓰는 표기.
 * 비교 기준이 지표마다 달라서 여기 한 곳에서만 정한다.
 *
 * ⚠️ 기준금리에 '전일 대비'를 붙이지 말 것 — 2026-09-01 사고.
 *    코스피·환율·코스닥은 야후가 previousClose(직전 종가)를 함께 줘서 전일 대비가 맞다.
 *    기준금리는 ECOS가 며칠 늦게 올려주는 값이라 전일 대비가 아니고,
 *    change 안에 이미 변동일이 들어 있다("▲ 8/27 인상").
 *    '전일 대비 ▲ 8/27 인상'으로 나가면 채점기가 사실 오류로 깎는다(8/29 실제로 그랬음).
 */
export function indicatorLine(i: { name?: string; value?: string; change?: string }): string {
  return i.name === '기준금리'
    ? `- ${i.name}: ${i.value} (${i.change})`
    : `- ${i.name}: ${i.value} (전일 대비 ${i.change})`
}

export async function getMarketIndicators(): Promise<Omit<KeyIndicator, 'easyExplanation'>[]> {
  const [kospi, usdKrw, kosdaq, baseRate] = await Promise.all([
    fetchIndexQuote('^KS11', 'KOSPI', 2),
    fetchFxQuote('KRW=X'),
    fetchIndexQuote('^KQ11', 'KOSDAQ', 2),
    fetchBaseRate(),
  ])

  const results: Omit<KeyIndicator, 'easyExplanation'>[] = []

  if (kospi) results.push(buildIndicator('코스피', kospi, v => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })))
  if (usdKrw) results.push(buildIndicator('환율(원/달러)', usdKrw, v => v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '원'))
  results.push(baseRate)
  if (kosdaq) results.push(buildIndicator('코스닥', kosdaq, v => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })))

  return results
}
