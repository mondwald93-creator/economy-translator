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
      { next: { revalidate: 0 } }
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

const BASE_RATE_INDICATOR: Omit<KeyIndicator, 'easyExplanation'> = {
  name: '기준금리',
  value: '3.50%',
  change: '— 동결',
  direction: 'flat',
}

export async function getMarketIndicators(): Promise<Omit<KeyIndicator, 'easyExplanation'>[]> {
  const [kospi, usdKrw, kosdaq] = await Promise.all([
    fetchQuote('^KS11'),
    fetchQuote('KRW=X'),
    fetchQuote('^KQ11'),
  ])

  const results: Omit<KeyIndicator, 'easyExplanation'>[] = []

  if (kospi) results.push(buildIndicator('코스피', kospi, v => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })))
  if (usdKrw) results.push(buildIndicator('환율(원/달러)', usdKrw, v => v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '원'))
  results.push(BASE_RATE_INDICATOR)
  if (kosdaq) results.push(buildIndicator('코스닥', kosdaq, v => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })))

  return results
}
