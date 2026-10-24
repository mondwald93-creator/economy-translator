// 지표 등락률 기준(marketData.ts, 2026-10-19) 점검. DB에는 아무것도 쓰지 않는다.
//
//   npx tsx scripts/indicator_check.mts          합성 데이터 단위 검사 + 지금 시세로 한 번 실행
//   npx tsx scripts/indicator_check.mts db 20    + 최근 20일 저장 지표를 야후 일별 종가로 검산(코스닥이 전날 기준인지)
//
// 쓴 날: 2026-10-19(코스닥 이틀 전 기준 · 환율 1시간 변동 수정). 2026-10-24: 중간 봉 누락 · 값 시각 지연 · 휴장 판정 + 검산에 코스피 추가.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { prevCloseByDate, priceHoursAgo, getMarketIndicators, weekdaysBetween, suspectIndexBasis, prevCloseFromDaily } = await import('../src/lib/marketData.ts')

let fail = 0
const ok = (name: string, cond: boolean, got: unknown) => {
  console.log(`${cond ? '✅' : '❌'} ${name} → ${JSON.stringify(got)}`)
  if (!cond) fail++
}
// KST 날짜·시각 → 초(UTC)
const kst = (ymd: string, hm = '09:00') => Math.floor(new Date(`${ymd}T${hm}:00+09:00`).getTime() / 1000)

// 1) 지수: 일봉 = 그날 09:00 KST에 찍힌다(야후 실측)
const bars = [
  { t: kst('2026-10-13'), close: 837.03 },
  { t: kst('2026-10-14'), close: 823.88 },
  { t: kst('2026-10-15'), close: 760.82 },
]
// 10/16 아침 9:07: 값은 10/15 종가, 마감 시각 10/15 15:30. 10/15 봉이 있든 없든 직전 종가 = 10/14
ok('전날 봉이 있음 → 10/14 종가', prevCloseByDate(bars, kst('2026-10-15', '15:30'))?.date === '2026-10-14', prevCloseByDate(bars, kst('2026-10-15', '15:30')))
ok('전날 봉이 늦게 올라옴(10/15 봉 없음) → 그래도 10/14 종가', prevCloseByDate(bars.slice(0, 2), kst('2026-10-15', '15:30'))?.date === '2026-10-14', prevCloseByDate(bars.slice(0, 2), kst('2026-10-15', '15:30')))
// 월요일 아침: 값은 금요일 종가(10/16 15:30). 주말 봉 없음 → 직전 종가 = 목요일(10/15)
const weekBars = [...bars, { t: kst('2026-10-16'), close: 794.78 }]
ok('월요일 아침(값 = 금요일 종가) → 목요일 종가', prevCloseByDate(weekBars, kst('2026-10-16', '15:30'))?.date === '2026-10-15', prevCloseByDate(weekBars, kst('2026-10-16', '15:30')))
// 장중(값 시각 = 오늘 10:00) → 직전 종가 = 어제
ok('장중 → 어제 종가', prevCloseByDate(weekBars, kst('2026-10-17', '10:00'))?.date === '2026-10-16', prevCloseByDate(weekBars, kst('2026-10-17', '10:00')))
ok('봉이 하나도 없음 → null', prevCloseByDate([], kst('2026-10-17')) === null, null)

// 1-2) 기준 의심 판정(2026-10-24). 네이버 거래일 = 실제 10/7~10/22 코스닥(10/9 한글날 휴장)
const naver = [
  ['2026-10-07', 898.43], ['2026-10-08', 892.27], ['2026-10-12', 849.19], ['2026-10-13', 837.03], ['2026-10-14', 823.88],
  ['2026-10-15', 760.82], ['2026-10-16', 794.78], ['2026-10-19', 808.89], ['2026-10-20', 781.97], ['2026-10-21', 792.76], ['2026-10-22', 764.10],
].map(([date, close]) => ({ date: date as string, close: close as number }))
const yb = (dates: string[]) => naver.filter(r => dates.includes(r.date)).map(r => ({ t: kst(r.date), close: r.close }))
ok('평일 간격: 금→월 = 0', weekdaysBetween('2026-10-16', '2026-10-19') === 0, weekdaysBetween('2026-10-16', '2026-10-19'))
ok('평일 간격: 10/20→10/22 = 1', weekdaysBetween('2026-10-20', '2026-10-22') === 1, weekdaysBetween('2026-10-20', '2026-10-22'))
// 평소: 값 = 10/22 종가. 10/22 봉이 아직 없거나, 있고 종가가 값과 같으면 의심 없음
ok('평소(값 날짜 봉 아직 없음) → 의심 없음', suspectIndexBasis(yb(['2026-10-20', '2026-10-21']), kst('2026-10-22', '15:30'), 764.10, '2026-10-21') === null, null)
ok('평소(값 날짜 봉 있음, 종가 = 값) → 의심 없음', suspectIndexBasis(yb(['2026-10-21', '2026-10-22']), kst('2026-10-22', '15:30'), 764.10, '2026-10-21') === null, null)
// 10/23 재현 A: 10/21 봉이 빠짐 → 야후 기준 10/20 → 의심 → 네이버로 10/21
const barsA = yb(['2026-10-16', '2026-10-19', '2026-10-20', '2026-10-22'])
const pA = prevCloseByDate(barsA, kst('2026-10-22', '15:30'))!
const whyA = suspectIndexBasis(barsA, kst('2026-10-22', '15:30'), 764.10, pA.date)
ok('10/23 재현 A(중간 봉 누락) → 의심', pA.date === '2026-10-20' && whyA !== null, whyA)
ok('10/23 재현 A → 네이버 직전 = 10/21 792.76', prevCloseFromDaily(naver, 764.10, '2026-10-22')?.date === '2026-10-21', prevCloseFromDaily(naver, 764.10, '2026-10-22'))
// 10/23 재현 B: 값은 10/22 종가인데 값 시각이 10/21에 멈춤 → 야후 기준 10/20 → 의심 → 네이버는 종가로 값 날짜(10/22)를 찾음
const barsB = yb(['2026-10-19', '2026-10-20', '2026-10-21'])
const pB = prevCloseByDate(barsB, kst('2026-10-21', '15:30'))!
const whyB = suspectIndexBasis(barsB, kst('2026-10-21', '15:30'), 764.10, pB.date)
ok('10/23 재현 B(값 시각 지연) → 의심', pB.date === '2026-10-20' && whyB !== null, whyB)
ok('10/23 재현 B → 네이버 직전 = 10/21', prevCloseFromDaily(naver, 764.10, '2026-10-21')?.date === '2026-10-21', prevCloseFromDaily(naver, 764.10, '2026-10-21'))
// 휴장: 10/12 값의 야후 기준 = 10/8(10/9 휴장) → 평일 빔이라 의심 → 네이버도 10/8 = 야후 그대로
const barsH = yb(['2026-10-07', '2026-10-08', '2026-10-12'])
const pH = prevCloseByDate(barsH, kst('2026-10-12', '15:30'))!
ok('휴장 다음 날 → 의심', suspectIndexBasis(barsH, kst('2026-10-12', '15:30'), 849.19, pH.date) !== null, pH)
ok('휴장 다음 날 → 네이버 직전 = 야후와 같은 10/8', prevCloseFromDaily(naver, 849.19, '2026-10-12')?.date === pH.date, prevCloseFromDaily(naver, 849.19, '2026-10-12'))
// 장중(값이 어떤 종가와도 다름) → 값 시각 날짜의 직전 거래일
ok('장중 → 네이버 직전 = 어제', prevCloseFromDaily(naver, 770.00, '2026-10-22')?.date === '2026-10-21', prevCloseFromDaily(naver, 770.00, '2026-10-22'))

// 2) 환율: 시간봉(1시간). 24시간 전 이전에 끝난 마지막 봉
const hourly: { t: number; close: number }[] = []
for (let h = 0; h < 72; h++) hourly.push({ t: kst('2026-10-14', '00:00') + h * 3600, close: 1340 + h * 0.1 })
const anchor = kst('2026-10-16', '09:07')
const ago = priceHoursAgo(hourly, anchor, 24)
ok('평일 9:07 → 하루 전 9:00에 끝난 봉', ago !== null && new Date((ago.t + 9 * 3600) * 1000).toISOString().slice(0, 16) === '2026-10-15T09:00', ago)
// 주말: 금요일 06:00(KST 토) 이후 봉 없음. 일요일 9:07의 값 시각 = 토 06:00 → 24시간 전 = 금 06:00
const fri = [] as { t: number; close: number }[]
for (let h = 0; h < 30; h++) fri.push({ t: kst('2026-10-16', '00:00') + h * 3600, close: 1340 - h * 0.2 }) // 금 00:00 ~ 토 05:00
const satAnchor = kst('2026-10-17', '06:00')
const w = priceHoursAgo(fri, satAnchor, 24)
ok('주말(값 시각 = 토 06:00) → 금 06:00 무렵 값', w !== null && new Date((w.t + 9 * 3600) * 1000).toISOString().slice(0, 13) === '2026-10-16T06', w)

// 3) 지금 시세로 한 번
const live = await getMarketIndicators()
console.log('\n지금 시세:')
for (const i of live) console.log(`  ${i.name}: ${i.value} ${i.change}  [기준 ${i.basis ?? '-'}]`)
ok('지표 4개', live.length === 4, live.map(i => i.name))

// 4) 저장 지표 검산(선택)
if (process.argv[2] === 'db') {
  const n = Number(process.argv[3] ?? 20)
  const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY }
  const rows = (await (await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/briefings?select=date,indicators&order=date.desc&limit=${n}`, { headers })).json()).reverse()
  for (const [name, symbol] of [['코스닥', '%5EKQ11'], ['코스피', '%5EKS11']]) {
    const y = await (await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json()
    const r = y.chart.result[0]
    const closes = (r.timestamp as number[]).map((t, i) => ({ d: new Date((t + 9 * 3600) * 1000).toISOString().slice(0, 10), c: r.indicators.quote[0].close[i] as number })).filter(x => x.c != null)
    console.log(`\n저장된 ${name} 검산(값 = 그날 종가, 기준 = 바로 앞 거래일 종가여야 함):`)
    for (const row of rows) {
      const k = (row.indicators ?? []).find((i: { name: string }) => i.name === name)
      if (!k) continue
      const v = Number(String(k.value).replace(/,/g, ''))
      const idx = closes.findIndex(x => Math.abs(x.c - v) < 0.02)
      if (idx < 1) { console.log(`  ${row.date} ${k.value} ${k.change} → 종가 못 찾음`); continue }
      const right = ((closes[idx].c / closes[idx - 1].c - 1) * 100).toFixed(2)
      const shown = (String(k.change).match(/[+-]?\d+\.\d+/) ?? ['0'])[0]
      const sign = String(k.change).includes('▼') && !shown.startsWith('-') ? '-' + shown : shown
      console.log(`  ${row.date} ${k.value} 저장 ${k.change} · 맞는 값 ${Number(right) > 0 ? '+' : ''}${right}% ${Math.abs(Number(sign) - Number(right)) < 0.02 ? '✅' : '🔴'}${k.basis ? ` [${k.basis}]` : ''}`)
    }
  }
}

console.log(fail === 0 ? '\n단위 검사 전부 통과' : `\n❌ 실패 ${fail}건`)
process.exit(fail === 0 ? 0 : 1)
