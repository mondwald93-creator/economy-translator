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
  const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '—'
  const changeStr = change === 0
    ? '— 보합'
    : `${arrow} ${change > 0 ? '+' : ''}${pct.toFixed(2)}%`
  return {
    name,
    value: formatter(meta.regularMarketPrice),
    change: changeStr,
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  }
}

// 스크래핑/조회 실패 또는 키 미설정 시 쓰는 비상값. 한국은행 현재 기준금리 기준으로 최신화할 것.
// (2026-06 현재 2.50% 동결 — 8회 연속. 과거 3.50%는 '최종금리 전망치'였고 현재값이 아니었음)
const FALLBACK_BASE_RATE: Omit<KeyIndicator, 'easyExplanation'> = {
  name: '기준금리',
  value: '2.50%',
  change: '— 동결',
  direction: 'flat',
}

// 한국은행 기준금리: ECOS 공식 OpenAPI(일별 시계열)에서 최신값 사용.
// (옛 네이버 채권 페이지 스크래핑은 페이지가 404로 사라져 폐기 — 2026-06-19)
// 통계표 722Y001 / 항목 0101000(한국은행 기준금리) / 주기 D(일별), 키는 환경변수 ECOS_API_KEY.
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
      // ECOS는 날짜 오름차순. 가끔 가장 최근 행의 값이 비어 와(NaN) 비상값으로 떨어지므로,
      // 숫자로 읽히는 값들만 추려 그 중 최신값을 쓴다.
      const values: number[] = rows
        .map((r: { DATA_VALUE?: string }) => parseFloat(r?.DATA_VALUE ?? ''))
        .filter((v: number) => !isNaN(v))
      if (values.length > 0) {
        const latest = values[values.length - 1]
        // 최신값과 다른 직전값을 찾아 인상/인하/동결 판정
        let prev: number | null = null
        for (let i = values.length - 2; i >= 0; i--) {
          if (values[i] !== latest) { prev = values[i]; break }
        }
        const direction = prev === null ? 'flat' : latest > prev ? 'up' : 'down'
        const change = direction === 'flat' ? '— 동결' : direction === 'up' ? '▲ 인상' : '▼ 인하'
        return {
          name: '기준금리',
          value: `${latest.toFixed(2)}%`,
          change,
          direction,
        }
      }
    }
  } catch {}
  return FALLBACK_BASE_RATE
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
