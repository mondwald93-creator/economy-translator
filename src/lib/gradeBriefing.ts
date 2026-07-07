import { supabase } from './supabase'
import { openai } from './openai'
import { titleTokenSet, isNearDuplicate } from './titleSimilarity'

// ── 브리핑 자동 채점기 (P1) ─────────────────────────────────────────────────
// 기준표 원본: docs/브리핑_채점기준표.md (v2.1)
// 3원칙:
//  ① 입력 첨부 필수 — 사실·선정 채점에 그날 기사 제목 풀 + 실측 지표를 함께 넣는다.
//     첨부할 입력이 없으면 그 항목은 점수 대신 '판정 불가'(null)로 기록한다.
//  ② 버전 + 갱신 트리거 — 채점 행마다 rubric_version을 남긴다.
//  ③ 발행과 분리 — 이 모듈은 발행 경로(runBriefing)에서 절대 호출하지 않는다.
//     별도 크론/수동 호출로만 돌고, 실패해도 브리핑 발행에 영향이 없다.
//
// ⚠️ 알려진 한계(정직 표기): 기사 본문은 DB에 없어(제목+URL만 저장) '사실' 채점의
//    대조 근거 = 그날 기사 제목 풀 + 실측 지표 값이다. 제목·지표로 확인 불가한 서술은
//    감점하지 않고 reason에 '확인 불가'로 남기게 했다. inputs.factualBasis에 박제.

export const RUBRIC_VERSION = 'v2.1'

function todayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

// generateMainBriefing의 후보 풀 구성 로직과 동일 (한국 우선 정렬 → 중복 제거 → 30개).
// 발행 코드를 수정하지 않기 위해 복사해 둔 것 — generateBriefing.ts 쪽이 바뀌면 여기도 맞출 것.
const FOREIGN_KEYWORDS = ['미국', '미 ', '美 ', '美국', '연준', 'Fed ', '중국', '中 ', '일본', '日 ', '유럽', '월가', '나스닥', '다우', 'S&P', '뉴욕증시']
function buildCandidatePool(articles: { id: string; title: string }[]): { id: string; title: string }[] {
  const koreanFirst = [...articles].sort((a, b) => {
    const aForeign = FOREIGN_KEYWORDS.some(k => a.title.includes(k)) ? 1 : 0
    const bForeign = FOREIGN_KEYWORDS.some(k => b.title.includes(k)) ? 1 : 0
    return aForeign - bForeign
  })
  const acceptedTokenSets: Set<string>[] = []
  const deduped = koreanFirst.filter(a => {
    const tokens = titleTokenSet(a.title)
    if (isNearDuplicate(tokens, acceptedTokenSets)) return false
    acceptedTokenSets.push(tokens)
    return true
  })
  return deduped.slice(0, 30)
}

// ── 형식 검사 (기준표 3.①) — 개수·글자 세기는 AI가 아니라 코드로 ──────────────
interface FormatCheck { name: string; pass: boolean; detail: string }

function countParagraphs(text: string): number {
  // 빈 줄 구분이 기본, 없으면 줄바꿈 단위로 셈
  const byBlank = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
  if (byBlank.length > 1) return byBlank.length
  return text.split(/\n+/).map(s => s.trim()).filter(Boolean).length
}

// briefings 테이블 한 행(당일치)을 받아 형식 검사 목록을 돌려준다
export function runFormatChecks(briefing: Record<string, unknown>): FormatCheck[] {
  const checks: FormatCheck[] = []
  const headline = String(briefing.headline ?? '')
  const headlineLines = headline.split('\n').map(s => s.trim()).filter(Boolean)
  checks.push({
    name: '헤드라인 2줄 구조',
    pass: headlineLines.length === 2,
    detail: `${headlineLines.length}줄`,
  })
  checks.push({
    name: '헤드라인 첫 줄 18자 이내',
    pass: (headlineLines[0] ?? '').length > 0 && (headlineLines[0] ?? '').length <= 18,
    detail: `${(headlineLines[0] ?? '').length}자`,
  })
  const shareCard = String(briefing.share_card ?? '')
  checks.push({
    name: 'shareCard 20~40자',
    pass: shareCard.length >= 20 && shareCard.length <= 40,
    detail: `${shareCard.length}자`,
  })
  const summary = String(briefing.summary ?? '')
  const paragraphs = countParagraphs(summary)
  checks.push({
    name: 'summary 3~5문단',
    pass: paragraphs >= 3 && paragraphs <= 5,
    detail: `${paragraphs}문단`,
  })
  const top3 = Array.isArray(briefing.top3_analysis) ? briefing.top3_analysis : []
  checks.push({
    name: 'TOP3 정확히 3개',
    pass: top3.length === 3,
    detail: `${top3.length}개`,
  })
  const healthCheck = Array.isArray(briefing.health_check) ? briefing.health_check : []
  const filledHealth = healthCheck.filter(
    (h: { category?: string; summary?: string }) => h?.category && String(h?.summary ?? '').trim()
  )
  checks.push({
    name: 'healthCheck 분야 최소 4개',
    pass: filledHealth.length >= 4,
    detail: `${filledHealth.length}개 채워짐`,
  })
  // JSON 필드 안 깨짐·빈 칸 없음
  let dailyTermOk = false
  try {
    const t = typeof briefing.daily_term === 'string' ? JSON.parse(briefing.daily_term) : briefing.daily_term
    dailyTermOk = Boolean(t?.term && t?.explanation)
  } catch { dailyTermOk = false }
  const indicators = Array.isArray(briefing.indicators) ? briefing.indicators : []
  const fieldsOk = Boolean(headline.trim() && summary.trim() && dailyTermOk && indicators.length > 0)
  checks.push({
    name: '필드 안 깨짐·빈 칸 없음',
    pass: fieldsOk,
    detail: `헤드라인 ${headline.trim() ? 'O' : 'X'} / 요약 ${summary.trim() ? 'O' : 'X'} / 용어 ${dailyTermOk ? 'O' : 'X'} / 지표 ${indicators.length}개`,
  })
  return checks
}

// ── AI 채점 (기준표 2. 점수 5항목) ───────────────────────────────────────────
interface ItemScore { score: number | null; reason: string }
interface AIGradeResult {
  comprehension: ItemScore
  factual: ItemScore
  selection: ItemScore
  diversity: ItemScore
  tone: ItemScore
  disqualify: { investmentAdvice: boolean; fabrication: boolean; reason: string }
  issueNote: string
}

function clampScore(v: unknown): number | null {
  if (v === null || v === undefined || v === '판정 불가' || v === '판정불가') return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(2, Math.round(n)))
}

async function gradeWithAI(
  briefing: Record<string, unknown>,
  candidates: { title: string }[]
): Promise<AIGradeResult> {
  const dailyTerm = (() => {
    try {
      return typeof briefing.daily_term === 'string' ? JSON.parse(briefing.daily_term) : briefing.daily_term
    } catch { return null }
  })()
  const indicators = (Array.isArray(briefing.indicators) ? briefing.indicators : []) as
    { name?: string; value?: string; change?: string }[]
  const top3 = (Array.isArray(briefing.top3_analysis) ? briefing.top3_analysis : []) as
    { title?: string }[]
  const healthCheck = Array.isArray(briefing.health_check) ? briefing.health_check : []
  const connections = Array.isArray(briefing.connections) ? briefing.connections : []

  const prompt = `당신은 경제 브리핑 품질 심사위원입니다. 아래 [채점 대상 브리핑]을 [대조 자료]와 비교해 기준표대로 채점하세요.

## 대조 자료 (ground truth)
### 실측 지표 (직전 거래일 마감, 코드가 시세 API에서 수집한 실제 값)
${indicators.map(i => `- ${i.name}: ${i.value} (전일 대비 ${i.change})`).join('\n') || '- 없음'}

### 그날 후보 기사 제목 풀 (브리핑 생성에 쓰인 후보 ${candidates.length}건)
${candidates.map((a, i) => `${i}. ${a.title}`).join('\n') || '- 없음'}

## 채점 대상 브리핑
- 헤드라인: ${JSON.stringify(String(briefing.headline ?? ''))}
- 전체 요약: ${JSON.stringify(String(briefing.summary ?? ''))}
- 오늘의 한 줄(shareCard): ${JSON.stringify(String(briefing.share_card ?? ''))}
- 오늘의 용어: ${JSON.stringify(dailyTerm)}
- TOP3 기사 제목: ${JSON.stringify(top3.map(t => t.title ?? ''))}
- 분야별 건강진단: ${JSON.stringify(healthCheck)}
- 핵심 흐름(connections): ${JSON.stringify(connections)}

## 채점 기준 (각 0~2점: 2=충족, 1=보통, 0=미달)
① comprehension 이해도 — 경제 초보자가 바로 이해되는가 (요약·용어 설명 기준. 2=중학생도 이해, 어려운 말은 풀어씀 / 1=일부 용어가 설명 없이 나옴 / 0=전문용어를 그대로 써서 어려움)
② factual 사실 정확성 — 숫자·오르내림 방향·인과가 위 [대조 자료]와 맞는가 (2=대조 가능한 것 모두 정확 / 1=사소하게 부정확·모호 / 0=숫자 틀림·방향 반대·대조 자료에 전혀 근거 없는 사실 서술). ⚠️ 대조 자료(제목·지표)로 확인할 수 없는 서술은 감점하지 말고 reason에 "확인 불가: ..."로만 남기세요. 지어낸 정보가 의심되면 disqualify.fabrication을 검토하세요.
③ selection 선정 판단 — 후보 풀에서 그날 가장 중요한 이슈를 헤드라인·TOP3로 골랐는가. 판단 축: 파급(영향받는 사람 수)·체감(내 지갑에 닿는 정도)·사건성(오늘 새로 터졌나)·규모(변화 크기)를 종합 (2=가장 중요한 이슈를 1등으로 / 1=무난하나 더 중요한 걸 놓쳤을 여지 / 0=사소한 것을 1등으로, 또는 단순 시황·해외 단독을 올림)
④ diversity 다양성 — TOP3가 서로 다른 사건·주제이고 분야가 고른가 (2=3개 모두 다른 주제, 시황·해외 단독 없음 / 1=주제 하나가 약간 겹침 / 0=같은 사건 중복 또는 시황·해외로 채움)
⑤ tone 톤 — 존댓말·따뜻한 문체 일관, 짧고 명확한 문장, 이모지 적정 (2=일관 / 1=일부 딱딱하거나 이모지 과함 / 0=반말 혼입·문체 들쭉날쭉·이모지 남발)

## 안전선 (점수와 무관, 하나라도 true면 실격)
- investmentAdvice: "사라/팔아라/투자해라" 같은 투자 조언·권유 문구가 있는가
- fabrication: 대조 자료 어디에도 근거가 없는 구체적 사실(수치·사건)을 지어낸 정황이 뚜렷한가

## 출력 (JSON만, 다른 텍스트 없이)
{
  "comprehension": {"score": 0, "reason": "한두 문장 근거"},
  "factual": {"score": 0, "reason": "대조한 항목과 결과를 구체적으로"},
  "selection": {"score": 0, "reason": "후보 풀의 어떤 기사와 비교했는지"},
  "diversity": {"score": 0, "reason": ""},
  "tone": {"score": 0, "reason": ""},
  "disqualify": {"investmentAdvice": false, "fabrication": false, "reason": ""},
  "issueNote": "오늘 브리핑에서 눈에 띈 문제 한 줄 (없으면 '특이사항 없음')"
}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: '당신은 꼼꼼하고 엄격한 품질 심사위원입니다. 주어진 대조 자료에 근거해서만 판단하고, 근거 없이 추측하지 않습니다.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0, // 재현성 우선 — 같은 브리핑을 다시 채점해도 값이 흔들리지 않게
  })

  const parsed = JSON.parse(res.choices[0].message.content ?? '{}')
  const item = (k: string): ItemScore => ({
    score: clampScore(parsed?.[k]?.score),
    reason: String(parsed?.[k]?.reason ?? ''),
  })
  return {
    comprehension: item('comprehension'),
    factual: item('factual'),
    selection: item('selection'),
    diversity: item('diversity'),
    tone: item('tone'),
    disqualify: {
      investmentAdvice: Boolean(parsed?.disqualify?.investmentAdvice),
      fabrication: Boolean(parsed?.disqualify?.fabrication),
      reason: String(parsed?.disqualify?.reason ?? ''),
    },
    issueNote: String(parsed?.issueNote ?? ''),
  }
}

// ── 실행부: 하루 1행 기록 (멱등 — 이미 채점한 날은 다시 채점하지 않음) ─────────
export async function gradeDailyBriefing({
  date,
  regrade = false,
}: { date?: string; regrade?: boolean } = {}) {
  const targetDate = date ?? todayKST()

  if (!regrade) {
    const { data: existing } = await supabase
      .from('briefing_scores')
      .select('total, created_at')
      .eq('date', targetDate)
      .maybeSingle()
    if (existing) {
      return { date: targetDate, graded: false, skipped: '이미 채점된 날짜 (regrade로 강제 재채점 가능)' }
    }
  }

  const { data: briefing, error: briefingError } = await supabase
    .from('briefings')
    .select('*')
    .eq('date', targetDate)
    .maybeSingle()
  if (briefingError) throw new Error(briefingError.message)
  if (!briefing?.headline) {
    throw new Error(`채점할 브리핑이 없습니다 (${targetDate}). 브리핑 생성 후에 채점하세요.`)
  }

  // 사실·선정 채점용 대조 자료: 그날 기사 제목 풀 (발행 때와 같은 정렬·중복 제거로 재구성)
  const { data: articles } = await supabase
    .from('news_articles')
    .select('id, title')
    .eq('date', targetDate)
    .order('created_at', { ascending: false })
  const candidates = buildCandidatePool(articles ?? [])

  // 형식 검사 (코드)
  const formatChecks = runFormatChecks(briefing)
  const formatPass = formatChecks.every(c => c.pass)

  // AI 채점 — 기준표 3원칙 ①: 대조 자료 없으면 사실·선정은 '판정 불가'
  const inputsAvailable = candidates.length > 0
  const ai = await gradeWithAI(briefing, candidates)
  if (!inputsAvailable) {
    ai.factual = { score: null, reason: '판정 불가 — 그날 후보 기사 풀이 없어 대조 근거 없음' }
    ai.selection = { score: null, reason: '판정 불가 — 그날 후보 기사 풀이 없어 대조 근거 없음' }
  }

  const scoreValues = [ai.comprehension, ai.factual, ai.selection, ai.diversity, ai.tone].map(s => s.score)
  const total = scoreValues.every((s): s is number => s !== null)
    ? scoreValues.reduce((a, b) => a + b, 0)
    : null
  const disqualified = ai.disqualify.investmentAdvice || ai.disqualify.fabrication

  const row = {
    date: targetDate,
    rubric_version: RUBRIC_VERSION,
    total,
    scores: {
      이해도: ai.comprehension,
      사실: ai.factual,
      선정: ai.selection,
      다양성: ai.diversity,
      톤: ai.tone,
    },
    format_pass: formatPass,
    format_checks: formatChecks,
    disqualified,
    disqualify_reason: disqualified ? ai.disqualify.reason : null,
    issue_note: ai.issueNote,
    inputs: {
      candidateCount: candidates.length,
      candidateTitles: candidates.map(c => c.title),
      indicators: briefing.indicators ?? [],
      factualBasis: '기사 제목 풀 + 실측 지표 (본문 아님 — 확인 불가 서술은 감점하지 않음)',
    },
  }

  const { error: upsertError } = await supabase
    .from('briefing_scores')
    .upsert(row, { onConflict: 'date' })
  if (upsertError) throw new Error(upsertError.message)

  return {
    date: targetDate,
    graded: true,
    rubricVersion: RUBRIC_VERSION,
    total,
    scores: row.scores,
    formatPass,
    formatChecks,
    disqualified,
    issueNote: ai.issueNote,
    candidateCount: candidates.length,
  }
}
