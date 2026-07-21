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
// (2026-06 현재 2.50% 동결 — 8회 연속. 과거 3.50%는 '최종금리 전망치'였고 현재값이 아니었음)
const FALLBACK_BASE_RATE: Omit<KeyIndicator, 'easyExplanation'> = {
  name: '기준금리',
  value: '2.50%',
  change: '— 유지',
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
        // 바로 전날(직전 거래일) 값과만 비교 — 실제로 오른/내린 날만 인상/인하로,
        // 이후 같은 값이 이어지는 날은 '유지'로 표기한다.
        // (옛 방식은 '최신값과 다른 값'을 뒤로 찾아 비교해, 인상 며칠 뒤에도 계속 '인상'으로
        //  굳어 "오늘 인상"으로 오독됐다 → 2026-07-21 사용자 결정으로 전일 대비 방식으로 교정)
        const prev = values.length >= 2 ? values[values.length - 2] : null
        const direction = prev === null || latest === prev ? 'flat' : latest > prev ? 'up' : 'down'
        const change = direction === 'flat' ? '— 유지' : direction === 'up' ? '▲ 인상' : '▼ 인하'
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
