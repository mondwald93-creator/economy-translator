/**
 * 주간 브리핑 — 2026-08-23 신설
 *
 * 6~7월에 4주 하다 멈춘 인스타 주간 카드뉴스를 자동화한 것이다.
 * 그때 접은 이유는 품질이 아니라 **손작업 1시간**이었다(일요일 루틴, 7/26에 회수).
 * 원본 4주치 = `마케팅/인스타_카드_2026-*주.md`. 형식은 그걸 그대로 따른다.
 *
 * ⭐ **이 파일의 핵심 규칙: 숫자는 코드가 만들고, 문장은 AI가 쓴다.**
 *
 * 왜 이렇게 나눴나. 옛 주간 카드를 만들 때 사람이 걸러낸 오류가 3건 있었는데
 * (6/22주 코스닥 +7.07% · 7/6주 코스닥 -7.33% 등) **전부 숫자였고, 전부
 * 일간 브리핑에 이미 실려 나간 뒤였다.** 채점기도 못 잡았다 — 채점기는 브리핑 글이
 * TOP3 기사와 맞는지를 보지, 지표가 실제 시세와 맞는지는 안 본다.
 *
 * 그래서 검증을 "사람이 기사를 찾아 대조"에서 **"틀릴 여지를 구조로 없앤다"**로 바꿨다.
 *   - 지표 숫자 = Yahoo/ECOS 실측을 이 파일이 직접 부른다. 일간 브리핑 값은 안 쓴다.
 *   - 변동률 = 코드가 계산한다. AI에게 계산을 시키지 않는다.
 *   - AI가 쓰는 문장 = **숫자 금지**. 넣어 오면 `stripNumbers`가 걸러낸다.
 * 원본(API)이 곧 정답이라 대조할 대상이 없어진다.
 *
 * ⚠️ 그래도 못 잡는 것: 인과 해석("반도체가 진앙이었다")이 맞는지. 기사 본문을
 *    수집하지 않아서 확인할 재료가 없다. 이건 일간 브리핑도 같은 수준이라 감수한다.
 */
import { supabaseAdmin as supabase } from './supabaseAdmin'
import { openai, SYSTEM_PROMPT } from './openai'

/** 주간 지표 한 줄. start/end는 그 주 시작 전 마지막 거래일과 주 마지막 거래일 종가다. */
export type WeeklyIndicator = {
  name: string
  /** 화면에 쓸 값 (이미 서식이 입혀진 문자열) */
  value: string
  /** 주간 변동률 문자열. 예: '▼ -7.25%' */
  change: string
  direction: 'up' | 'down' | 'flat'
}

/** 카드 2~5장에 들어가는 분야 한 개. AI가 그 주 헤드라인에서 고른다. */
export type WeeklySection = {
  /** 배지 문구. 예: '① 증시' */
  badge: string
  /** 굵은 한 줄 */
  title: string
  /** 설명 2~3줄 */
  body: string
  /** 하단 한 줄 (옛 카드의 foot 좌측) */
  foot: string
  /** ⭐ 이 분야를 고른 근거 — 어느 날 헤드라인에서 왔는지. 나중에 이상하면 추적용 */
  sourceDates: string[]
}

export type WeeklyData = {
  /** 월요일 (YYYY-MM-DD) */
  weekStart: string
  /** 일요일 (YYYY-MM-DD) */
  weekEnd: string
  /** 카드에 쓸 날짜 라벨. 예: '2026.8.17~8.23' */
  rangeLabel: string
  indicators: WeeklyIndicator[]
  /** 커버 훅 3~4줄. AI가 쓰되 숫자는 안 들어간다 */
  coverLines: string[]
  /** 커버 아래 코드가 넣는 한 줄. 예: '코스닥 -7.25%로 한 주 마감' */
  coverStat: string
  sections: WeeklySection[]
}

/** 그 주 월요일과 일요일을 구한다. 기준일이 일요일이면 그날이 weekEnd다. */
export function weekRange(baseDate: string): { weekStart: string; weekEnd: string } {
  const d = new Date(`${baseDate}T00:00:00+09:00`)
  const dow = d.getUTCDay() // 0=일
  // 일요일이면 그 주의 마지막 날. 그 외에는 이번 주 일요일까지 당긴다.
  const toSunday = dow === 0 ? 0 : 7 - dow
  const end = new Date(d.getTime() + toSunday * 86_400_000)
  const start = new Date(end.getTime() - 6 * 86_400_000)
  const fmt = (x: Date) => x.toISOString().split('T')[0]
  return { weekStart: fmt(start), weekEnd: fmt(end) }
}

function rangeLabelOf(weekStart: string, weekEnd: string): string {
  const [, sm, sd] = weekStart.split('-')
  const [y, em, ed] = weekEnd.split('-')
  return `${y}.${Number(sm)}.${Number(sd)}~${Number(em)}.${Number(ed)}`
}

type Candle = { date: string; close: number }

/**
 * Yahoo 차트에서 최근 한 달 일별 종가를 가져온다.
 * `marketData.ts`의 `fetchQuote`는 `range=1d`라 그날치만 준다. 주간 변동을 내려면
 * 지난주 종가가 필요해서 여기서 따로 부른다(같은 API, range만 다름).
 */
async function fetchCandles(symbol: string): Promise<Candle[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`,
      { cache: 'no-store', signal: AbortSignal.timeout(10_000) }
    )
    if (!res.ok) return []
    const json = await res.json()
    const r = json?.chart?.result?.[0]
    const ts: number[] = r?.timestamp ?? []
    const closes: (number | null)[] = r?.indicators?.quote?.[0]?.close ?? []
    const out: Candle[] = []
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i]
      if (c == null) continue
      // KST 날짜로 맞춘다(+9h). 종가 시각이 UTC라 그냥 쓰면 하루 밀린다.
      const date = new Date((ts[i] + 9 * 3600) * 1000).toISOString().split('T')[0]
      out.push({ date, close: c })
    }
    return out
  } catch {
    return []
  }
}

/**
 * 주간 변동을 만든다.
 * 시작 기준 = **그 주가 시작되기 전 마지막 거래일 종가**(보통 지난주 금요일).
 * 끝 기준 = 그 주 마지막 거래일 종가(보통 금요일. 주말은 휴장이라 값이 없다).
 */
function toWeeklyIndicator(
  name: string,
  candles: Candle[],
  weekStart: string,
  weekEnd: string,
  format: (v: number) => string
): WeeklyIndicator | null {
  const before = candles.filter(c => c.date < weekStart)
  const inWeek = candles.filter(c => c.date >= weekStart && c.date <= weekEnd)
  if (!before.length || !inWeek.length) return null

  const startVal = before[before.length - 1].close
  const endVal = inWeek[inWeek.length - 1].close
  const pct = startVal !== 0 ? ((endVal - startVal) / startVal) * 100 : 0
  const rounded = Math.round(pct * 100) / 100
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '—'

  return {
    name,
    value: format(endVal),
    change: rounded === 0 ? '— 보합' : `${arrow} ${rounded > 0 ? '+' : ''}${rounded.toFixed(2)}%`,
    direction: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat',
  }
}

const num2 = (v: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const won1 = (v: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '원'

/** 그 주 지표. 기준금리는 변동이 드물어 일간 브리핑의 마지막 값을 그대로 쓴다. */
async function buildIndicators(weekStart: string, weekEnd: string): Promise<WeeklyIndicator[]> {
  const [kospi, kosdaq, usdKrw] = await Promise.all([
    fetchCandles('^KS11'),
    fetchCandles('^KQ11'),
    fetchCandles('KRW=X'),
  ])

  const out: WeeklyIndicator[] = []
  const k = toWeeklyIndicator('코스피', kospi, weekStart, weekEnd, num2)
  const q = toWeeklyIndicator('코스닥', kosdaq, weekStart, weekEnd, num2)
  const f = toWeeklyIndicator('환율(원/달러)', usdKrw, weekStart, weekEnd, won1)
  if (k) out.push(k)
  if (q) out.push(q)
  if (f) out.push(f)

  // 기준금리: 그 주 마지막 브리핑에 실린 값을 쓴다. ECOS를 또 부르지 않는 이유는
  // 일간 브리핑이 이미 매일 ECOS에서 받아 저장하고 있어서다(중복 호출 회피).
  const { data } = await supabase
    .from('briefings')
    .select('indicators')
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle<{ indicators: unknown }>()

  const parsed = parseIndicators(data?.indicators)
  const base = parsed.find(i => i.name === '기준금리')
  if (base) {
    out.push({ name: '기준금리', value: base.value, change: base.change ?? '— 유지', direction: 'flat' })
  }
  return out
}

/** `indicators`는 날에 따라 객체로도, JSON 문자열로도 온다(`page.tsx:115`가 같은 방식으로 방어한다). */
function parseIndicators(raw: unknown): { name: string; value: string; change?: string }[] {
  if (!raw) return []
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/**
 * ⭐ AI가 써 온 문장에서 숫자를 걷어낸다.
 *
 * 숫자를 코드만 넣기로 했는데 프롬프트로 부탁하는 것만으로는 안 지켜진다
 * (2026-08-21 실증: 프롬프트 예시 한 줄 때문에 25일치 문장이 전부 전언체가 됐다.
 *  "프롬프트는 부탁이지 보장이 아니다"가 그때 남긴 교훈이다).
 * 그래서 코드로 막는다. 숫자가 든 문장은 통째로 버린다 — 일부만 지우면 뜻이 깨진다.
 *
 * 한글 수사(하나·둘·이틀)는 남긴다. 틀릴 수 있는 건 아라비아 숫자 쪽이다.
 */
export function hasNumber(text: string): boolean {
  return /\d/.test(text)
}

const WEEKLY_PROMPT = `당신은 경제 뉴스를 초보자에게 쉽게 옮기는 편집자입니다.
아래는 지난 한 주 동안 매일 발행된 경제 브리핑 헤드라인입니다.

이 한 주를 정리하는 인스타그램 카드뉴스 문구를 만들어 주세요.

【반드시 지킬 것】
1. **숫자를 절대 쓰지 마세요.** 아라비아 숫자(0~9)가 하나라도 들어가면 그 문장은 버려집니다.
   지수, 환율, 퍼센트, 날짜 모두 쓰지 마세요. 숫자는 별도로 코드가 정확한 실측값을 넣습니다.
   숫자 대신 "크게 떨어졌어요", "지난주보다 나아졌어요"처럼 방향과 정도로 말하세요.
2. 말끝은 '~어요/~예요'로 씁니다. '~대요/~래요/~거든요'처럼 전해 들은 말투는 쓰지 마세요.
   직접 읽고 옮겨 주는 서비스라 목소리가 갈립니다.
3. 경제를 처음 보는 사람이 읽습니다. 전문 용어를 쓰면 괄호로 한 줄 풀어 주세요.
4. 형식 예시일 뿐 내용은 따라하지 마세요.

【만들 것】
(1) cover: 이번 주를 한눈에 요약하는 훅 3~4줄. 각 줄은 짧게(15자 안팎).
    지난주와 대비되는 흐름이 있으면 그걸 살리세요.
(2) sections: 이번 주 핵심 줄기 4개. 그 주 헤드라인에 실제로 나온 주제만 고르세요.
    각각 badge(① 증시 처럼 번호+두세 글자), title(굵게 나갈 한 줄),
    body(쉬운 설명 2~3문장), foot(카드 하단에 들어갈 짧은 한 줄),
    sourceDates(이 주제가 나온 날짜들, YYYY-MM-DD 배열)

JSON으로만 답하세요:
{"cover":["...","...","..."],"sections":[{"badge":"① ...","title":"...","body":"...","foot":"...","sourceDates":["2026-08-18"]}]}`

/** 그 주 일간 브리핑을 모아 AI에게 문장을 받는다. */
async function buildNarrative(
  weekStart: string,
  weekEnd: string
): Promise<{ coverLines: string[]; sections: WeeklySection[] }> {
  const { data } = await supabase
    .from('briefings')
    .select('date, headline, summary')
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: true })

  const days = (data ?? []) as { date: string; headline: string | null; summary: string | null }[]
  const material = days
    .filter(d => d.headline)
    .map(d => `[${d.date}] ${d.headline}${d.summary ? `\n  ${String(d.summary).slice(0, 200)}` : ''}`)
    .join('\n')

  if (!material) return { coverLines: [], sections: [] }

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${WEEKLY_PROMPT}\n\n【이번 주 헤드라인】\n${material}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })
  const parsed = JSON.parse(res.choices[0].message.content ?? '{}') as {
    cover?: string[]
    sections?: WeeklySection[]
  }

  // ⭐ 숫자가 든 줄은 버린다. 프롬프트로 부탁만 하면 안 지켜지기 때문이다.
  const coverLines = (parsed.cover ?? []).filter(l => l && !hasNumber(l)).slice(0, 4)
  const sections = (parsed.sections ?? [])
    .filter(s => s?.title && s?.body && !hasNumber(s.title) && !hasNumber(s.body))
    .slice(0, 4)
    .map((s, i) => ({
      badge: s.badge || `${'①②③④'[i]} 정리`,
      title: s.title,
      body: s.body,
      foot: s.foot && !hasNumber(s.foot) ? s.foot : '경제번역기',
      sourceDates: Array.isArray(s.sourceDates) ? s.sourceDates : [],
    }))

  return { coverLines, sections }
}

/** 커버 아래 한 줄 — 숫자가 들어가는 자리라 코드가 만든다. */
function buildCoverStat(indicators: WeeklyIndicator[]): string {
  // 변동폭이 가장 큰 지표를 고른다. 그 주의 이야깃거리가 거기 있다.
  const withPct = indicators
    .filter(i => i.name !== '기준금리')
    .map(i => ({ i, abs: Math.abs(parseFloat(i.change.replace(/[^0-9.-]/g, '')) || 0) }))
    .sort((a, b) => b.abs - a.abs)
  if (!withPct.length) return ''
  const top = withPct[0].i
  const word = top.direction === 'up' ? '올랐어요' : top.direction === 'down' ? '내렸어요' : '제자리예요'
  return `${top.name.replace('(원/달러)', '')} ${top.change.replace(/[▲▼—]\s*/, '')} ${word}`
}

/** 주간 데이터 한 벌을 만든다. 저장은 하지 않는다(호출한 쪽이 정한다). */
export async function buildWeeklyData(baseDate: string): Promise<WeeklyData | null> {
  const { weekStart, weekEnd } = weekRange(baseDate)
  const [indicators, narrative] = await Promise.all([
    buildIndicators(weekStart, weekEnd),
    buildNarrative(weekStart, weekEnd),
  ])

  // 재료가 없으면 만들지 않는다. 빈 카드가 올라가는 것보다 안 올라가는 게 낫다.
  if (!indicators.length || !narrative.sections.length) return null

  return {
    weekStart,
    weekEnd,
    rangeLabel: rangeLabelOf(weekStart, weekEnd),
    indicators,
    coverLines: narrative.coverLines,
    coverStat: buildCoverStat(indicators),
    sections: narrative.sections,
  }
}
