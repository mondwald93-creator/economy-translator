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

/**
 * 카드 2~5장에 들어가는 분야 한 개.
 * 구조는 6~7월 실물 카드를 그대로 따랐다(`마케팅/경제번역기_ins_260705/card_02.jpg`):
 *   배지 → 제목 두 줄(둘째 줄은 초록 강조 + 이모지) → 본문 문단 둘 → 하단 한 줄
 */
export type WeeklySection = {
  /** 배지 문구. 예: '① 증시' */
  badge: string
  /** 제목 첫 줄. 예: '코스피, 롤러코스터 끝에' */
  titleTop: string
  /** 제목 둘째 줄 — 통째로 강조색이 된다. 끝에 이모지 하나. 예: '8000선 회복 🎢' */
  titleAccent: string
  /** 본문 문단 둘. 안에서 `**...**`로 감싼 곳이 강조색이 된다 */
  bodyParts: string[]
  /** 하단 왼쪽 한 줄. 요약이 아니라 한마디 짚는 자리. 예: '오른 건 반도체뿐, 쏠림은 숙제' */
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
  /**
   * 커버 훅 3~4줄. `**...**`로 감싼 곳이 강조색이 된다.
   * 옛 카드가 "지난주 급락한 코스피 📉 / 이번 주는 / 롤러코스터 끝에 / **8000선 회복** 📈"처럼
   * 숫자를 문장 안에 녹여 썼다. 그래서 숫자를 막지 않고 **쓰되 대조해서 거른다**(`keepIfNumbersOk`).
   */
  coverLines: string[]
  /** 지표별 한마디. 6장에서 값 옆에 붙는다. 키는 지표 이름 */
  indicatorNotes: Record<string, string>
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
 * 스레드 글에 붙일 지표 한 줄. 여기 숫자는 전부 코드가 만든 실측값이다.
 * (인스타는 6장 카드가 이 역할을 하므로 카드에는 안 쓴다)
 */
export function indicatorSummaryLine(indicators: WeeklyIndicator[]): string {
  return indicators
    .filter(i => i.name !== '기준금리')
    .map(i => `${i.name.replace('(원/달러)', '')} ${i.value} ${i.change}`)
    .join(' · ')
}

/**
 * ⭐ AI가 쓴 문장의 숫자를 실측값과 대조한다.
 *
 * 처음엔 "숫자를 아예 쓰지 말라"고 막았는데, 그러면 옛 카드 형식이 깨진다.
 * 6~7월 실물 카드는 숫자를 문장 안에 녹여 썼다 — "장중 **7,378**까지 밀렸다가
 * 7/3 하루 **+5.76%** 반등했어요". 숫자가 빠지면 밋밋한 나열이 된다.
 * 그래서 **쓰되 거른다**: 문장에 나온 숫자가 우리가 아는 실측값에서 온 게 아니면 그 문장을 버린다.
 *
 * 판정은 자릿수 기호를 무시하고 숫자만 비교한다(8,088 → 8088).
 * 지수 앞자리를 딴 표현("8000선")도 살리려고 앞 한두 자리 일치까지 허용한다.
 */
function allowedNumbers(indicators: WeeklyIndicator[], weekStart: string, weekEnd: string): Set<string> {
  const ok = new Set<string>()
  const add = (raw: string) => {
    for (const m of raw.matchAll(/\d[\d,.]*/g)) {
      const n = m[0].replace(/[,.]/g, '')
      if (!n) continue
      ok.add(n)
      if (n.length >= 3) ok.add(n.slice(0, 2))
      if (n.length >= 4) ok.add(n.slice(0, 1))
    }
  }
  indicators.forEach(i => { add(i.value); add(i.change) })
  add(weekStart)
  add(weekEnd)
  return ok
}

/** 문장에 실측에 없는 숫자가 섞였으면 false. 그런 문장은 통째로 버린다(일부만 지우면 뜻이 깨진다). */
function keepIfNumbersOk(text: string, ok: Set<string>): boolean {
  for (const m of text.matchAll(/\d[\d,.]*/g)) {
    const n = m[0].replace(/[,.]/g, '')
    if (!n) continue
    if (ok.has(n)) continue
    if (n.length >= 2 && ok.has(n.slice(0, 2))) continue
    if (ok.has(n.slice(0, 1))) continue
    return false
  }
  return true
}

const WEEKLY_PROMPT = `당신은 경제 뉴스를 초보자에게 쉽게 옮기는 편집자입니다.
지난 한 주 경제를 정리하는 인스타그램 카드뉴스 문구를 만들어 주세요.

【말투】
- 말끝은 '~어요/~예요'로만 씁니다.
  ⚠️ '~거든요'는 쓰지 마세요. 설명조로 늘어지고 문장이 길어집니다.
  ⚠️ '~대요/~래요'처럼 전해 들은 말투도 쓰지 마세요. 직접 읽고 옮겨 주는 서비스라 목소리가 갈립니다.
- 경제를 처음 보는 사람이 읽습니다. 전문 용어는 괄호로 한 줄 풀어 주세요.
- 형식 예시일 뿐 내용은 따라하지 마세요.

【숫자】
- 지수·환율·퍼센트는 **위에 준 「이번 주 지표」에 있는 값만** 쓰세요.
- 거기 없는 숫자를 지어내면 그 문장은 통째로 버려집니다. 확신이 없으면 숫자를 빼고 쓰세요.
- 지수의 앞자리를 딴 표현("8000선 회복")은 괜찮습니다.

【강조】
- 문장에서 가장 중요한 대목을 **이렇게** 감싸면 그 부분만 초록으로 나갑니다.
- 숫자와 결론에 씁니다. 한 문장에 한두 군데만.

【만들 것】
(1) cover: 표지 3~4줄. 각 줄 12자 안팎.
    한 주 전체 흐름을 말하는 자리입니다. 개별 사건 나열은 (2)에서 하니 여기서 반복하지 마세요.
    ⚠️ **마지막 줄에는 반드시 **이렇게** 감싼 대목이 있어야 합니다.** 표지에 초록이 하나도 없으면
       밋밋해집니다. 그 주를 한마디로 맺는 말이나 숫자를 감싸세요.
    줄 끝에 어울리는 이모지를 하나씩 붙여도 좋습니다.
(2) sections: 이번 주 핵심 줄기 4개. 그 주 헤드라인에 실제로 나온 주제만.
    - badge: 번호 + 분야 이름 두세 글자. 예: "① 증시" "② 금리" "③ 은행" "④ 부동산"
      ⚠️ 넷은 서로 달라야 합니다. 회사 이름이나 사건 설명을 넣지 마세요.
    - titleTop: 제목 첫 줄 (강조 없이)
    - titleAccent: 제목 둘째 줄. **통째로 초록**이 되니 강조 표시는 붙이지 마세요.
      끝에 어울리는 이모지 하나. 예: "8000선 회복 🎢"
    - bodyParts: 본문 **문단 두 개** (배열, 반드시 두 개). 첫 문단은 무슨 일이 있었는지,
      둘째 문단은 왜 그렇게 됐는지나 내 지갑에 무슨 뜻인지.
      각 문단은 두 문장 안팎.
      ⚠️ **각 문단에서 가장 중요한 한두 대목을 반드시 **이렇게** 감싸 주세요.**
         위 지표에 있는 숫자, 또는 결론이 되는 말에 씁니다. 감싼 곳만 초록으로 나갑니다.
    - foot: 카드 하단 왼쪽 한마디(12자 안팎). **반드시 채우세요. 비우면 카드가 허전해집니다.**
      요약을 다시 하는 자리가 아니라 **한마디 짚는 자리**입니다. 살짝 삐딱해도 됩니다.
      예: "오른 건 반도체뿐, 쏠림은 숙제" / "회복은 시작, 안심은 일러요" / "지수는 멀미, 환율은 한숨 돌림"
    - sourceDates: 이 주제가 나온 날짜들 (YYYY-MM-DD 배열)
(3) indicatorNotes: 지표마다 한마디(6자 안팎). 지표 이름을 키로 하는 객체.
    예: {"코스피":"8000선 회복","환율":"주중 고점 찍고","기준금리":"동결"}

JSON으로만 답하세요:
{"cover":["...","..."],"sections":[{"badge":"① ...","titleTop":"...","titleAccent":"...","bodyParts":["...","..."],"foot":"...","sourceDates":["2026-08-18"]}],"indicatorNotes":{"코스피":"..."}}`

/** 그 주 일간 브리핑을 모아 AI에게 문장을 받는다. */
async function buildNarrative(
  weekStart: string,
  weekEnd: string,
  indicators: WeeklyIndicator[]
): Promise<{ coverLines: string[]; sections: WeeklySection[]; indicatorNotes: Record<string, string> }> {
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

  if (!material) return { coverLines: [], sections: [], indicatorNotes: {} }

  const table = indicators
    .map(i => `${i.name}: ${i.value} (한 주 ${i.change})`)
    .join('\n')

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          `${WEEKLY_PROMPT}\n\n` +
          `【이번 주 지표 — 숫자는 여기 있는 것만 쓰세요】\n${table}\n\n` +
          `【이번 주 헤드라인】\n${material}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })
  const raw = res.choices[0].message.content ?? '{}'
  // 무엇이 걸러졌는지 보려면 원본이 필요하다. 파싱 뒤엔 사라져서 추적이 안 된다.
  if (process.env.WEEKLY_DEBUG === '1') console.log('[weekly] AI 원본:', raw)
  const parsed = JSON.parse(raw) as {
    cover?: string[]
    sections?: Partial<WeeklySection>[]
    indicatorNotes?: Record<string, string>
  }

  // ⭐ 실측에 없는 숫자가 섞인 문장은 버린다. 프롬프트로 부탁만 하면 안 지켜진다
  //    (2026-08-21 실증: 예시 한 줄이 25일치 문장을 전언체로 만들었다).
  const ok = allowedNumbers(indicators, weekStart, weekEnd)
  const keep = (t?: string) => Boolean(t && keepIfNumbersOk(t, ok))

  const coverLines = (parsed.cover ?? []).filter(keep).slice(0, 4)
  const sections = (parsed.sections ?? [])
    .filter(sec => keep(sec.titleTop) && keep(sec.titleAccent))
    .slice(0, 4)
    .map((sec, i) => ({
      badge: sec.badge || `${'①②③④'[i]} 정리`,
      titleTop: sec.titleTop ?? '',
      titleAccent: sec.titleAccent ?? '',
      bodyParts: (sec.bodyParts ?? []).filter(keep).slice(0, 2),
      // AI가 자주 빠뜨리는 칸이다. 없으면 비워 둔다 —
      // '경제번역기'로 채우면 오른쪽(경제번역기 · @econ.5min)과 겹쳐 보인다.
      foot: keep(sec.foot) ? sec.foot!.trim() : '',
      sourceDates: Array.isArray(sec.sourceDates) ? sec.sourceDates : [],
    }))
    .filter(sec => sec.titleTop && sec.bodyParts.length)

  const notes: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed.indicatorNotes ?? {})) {
    if (typeof v === 'string' && keepIfNumbersOk(v, ok)) notes[k.replace('(원/달러)', '')] = v
  }

  return { coverLines, sections, indicatorNotes: notes }
}

/** 주간 데이터 한 벌을 만든다. 저장은 하지 않는다(호출한 쪽이 정한다). */
export async function buildWeeklyData(baseDate: string): Promise<WeeklyData | null> {
  const { weekStart, weekEnd } = weekRange(baseDate)
  // 지표를 먼저 만든다. 그 흐름을 AI에게 재료로 넘겨야 해서 순서가 있다.
  const indicators = await buildIndicators(weekStart, weekEnd)
  const narrative = await buildNarrative(weekStart, weekEnd, indicators)

  // 재료가 없으면 만들지 않는다. 빈 카드가 올라가는 것보다 안 올라가는 게 낫다.
  if (!indicators.length || !narrative.sections.length) return null

  return {
    weekStart,
    weekEnd,
    rangeLabel: rangeLabelOf(weekStart, weekEnd),
    indicators,
    coverLines: narrative.coverLines,
    indicatorNotes: narrative.indicatorNotes,
    sections: narrative.sections,
  }
}
