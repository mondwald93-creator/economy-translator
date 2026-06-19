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

// 스크래핑 실패 시 쓰는 비상값. 한국은행 현재 기준금리 기준으로 최신화할 것.
// (2026-06 현재 2.50% 동결 — 8회 연속. 과거 3.50%는 '최종금리 전망치'였고 현재값이 아니었음)
const FALLBACK_BASE_RATE: Omit<KeyIndicator, 'easyExplanation'> = {
  name: '기준금리',
  value: '2.50%',
  change: '— 동결',
  direction: 'flat',
}

async function fetchBaseRate(): Promise<Omit<KeyIndicator, 'easyExplanation'>> {
  try {
    const res = await fetch('https://finance.naver.com/bond/bondDeal.naver', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://finance.naver.com/',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return FALLBACK_BASE_RATE
    const buffer = await res.arrayBuffer()
    const html = new TextDecoder('euc-kr').decode(buffer)
    const match = html.match(/기준금리[^0-9]*([0-9]+\.[0-9]{2})/)
    if (match?.[1]) {
      return {
        name: '기준금리',
        value: `${match[1]}%`,
        change: '— 동결',
        direction: 'flat',
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
