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
  return {
    name,
    value: formatter(meta.regularMarketPrice),
    change: (change >= 0 ? '+' : '') + formatter(change),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  }
}

export async function getMarketIndicators(): Promise<Omit<KeyIndicator, 'easyExplanation'>[]> {
  const [kospi, usdKrw, kosdaq] = await Promise.all([
    fetchQuote('^KS11'),
    fetchQuote('KRW=X'),
    fetchQuote('^KQ11'),
  ])

  const results: Omit<KeyIndicator, 'easyExplanation'>[] = []

  if (kospi) results.push(buildIndicator('코스피', kospi, v => v.toFixed(2)))
  if (usdKrw) results.push(buildIndicator('환율(원/달러)', usdKrw, v => v.toFixed(1) + '원'))
  if (kosdaq) results.push(buildIndicator('코스닥', kosdaq, v => v.toFixed(2)))

  return results
}
