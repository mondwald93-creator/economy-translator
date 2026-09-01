import { KeyIndicator } from '@/types'

interface YahooMeta {
  regularMarketPrice: number
  previousClose?: number
  chartPreviousClose?: number
}

async function fetchQuote(symbol: string): Promise<YahooMeta | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      { next: { revalidate: 0 }, signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta as YahooMeta | undefined
    return meta ?? null
  } catch {
    return null
  }
}

function buildIndicator(
  name: string,
  meta: YahooMeta,
  formatter: (v: number) => string
): Omit<KeyIndicator, 'easyExplanation'> {
  const prev = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice
  const change = meta.regularMarketPrice - prev
  const pct = prev !== 0 ? (change / prev) * 100 : 0
  // 표시 소수 2자리 기준으로 판정 → 변동이 0.00%로 떨어지면(거의 무변동) '보합'으로 통일
  const pctRounded = Math.round(pct * 100) / 100
  const arrow = pctRounded > 0 ? '▲' : pctRounded < 0 ? '▼' : '—'
  const changeStr = pctRounded === 0
    ? '— 보합'
    : `${arrow} ${pctRounded > 0 ? '+' : ''}${pctRounded.toFixed(2)}%`
  return {
    name,
    value: formatter(meta.regularMarketPrice),
    change: changeStr,
    direction: pctRounded > 0 ? 'up' : pctRounded < 0 ? 'down' : 'flat',
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
    fetchQuote('^KS11'),
    fetchQuote('KRW=X'),
    fetchQuote('^KQ11'),
    fetchBaseRate(),
  ])

  const results: Omit<KeyIndicator, 'easyExplanation'>[] = []

  if (kospi) results.push(buildIndicator('코스피', kospi, v => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })))
  if (usdKrw) results.push(buildIndicator('환율(원/달러)', usdKrw, v => v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '원'))
  results.push(baseRate)
  if (kosdaq) results.push(buildIndicator('코스닥', kosdaq, v => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })))

  return results
}
