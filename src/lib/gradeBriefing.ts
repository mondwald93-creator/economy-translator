import { supabaseAdmin as supabase } from './supabaseAdmin'
import { openai } from './openai'
import { notifyFailure } from './notifyAdmin'
import { titleTokenSet, isNearDuplicate } from './titleSimilarity'

// ── 브리핑 자동 채점기 (P1+P2) ───────────────────────────────────────────────
// 기준표 원본: docs/브리핑_채점기준표.md (v2.4)
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

export const RUBRIC_VERSION = 'v3.1'

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
// 하드/소프트 2단계 (v2.2, 2026-07-12 첫 주 리뷰 결정):
//  hard = 독자 화면이 깨지거나 내용이 누락되는 것 → 하나라도 실패면 그날 형식 탈락(format_pass=false)
//  soft = 글자수·문단수 소폭 이탈 → 경고로 기록만 하고 탈락시키지 않음
//  (계기: 7/11 헤드라인 1자 초과가 빈 제목 사고와 똑같이 그날 전체 ❌로 찍힘)
interface FormatCheck { name: string; pass: boolean; detail: string; severity: 'hard' | 'soft' }

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
    severity: 'hard',
  })
  // v2.2: 18자→20자 완화 (7/11 19자 사례 — 생성기는 안 고치고 채점 기준을 느슨하게, 사용자 결정)
  checks.push({
    name: '헤드라인 첫 줄 20자 이내',
    pass: (headlineLines[0] ?? '').length > 0 && (headlineLines[0] ?? '').length <= 20,
    detail: `${(headlineLines[0] ?? '').length}자`,
    severity: 'soft',
  })
  const shareCard = String(briefing.share_card ?? '')
  checks.push({
    name: 'shareCard 20~40자',
    pass: shareCard.length >= 20 && shareCard.length <= 40,
    detail: `${shareCard.length}자`,
    severity: 'soft',
  })
  const summary = String(briefing.summary ?? '')
  const paragraphs = countParagraphs(summary)
  checks.push({
    name: 'summary 3~5문단',
    pass: paragraphs >= 3 && paragraphs <= 5,
    detail: `${paragraphs}문단`,
    severity: 'soft',
  })
  const top3 = Array.isArray(briefing.top3_analysis) ? briefing.top3_analysis : []
  checks.push({
    name: 'TOP3 정확히 3개',
    pass: top3.length === 3,
    detail: `${top3.length}개`,
    severity: 'hard',
  })
  // 2026-07-08 사고: AI가 UUID를 한 글자 빠뜨려 제목이 ''로 저장됨 — 빈 제목을 형식 탈락으로 잡는다
  const emptyTitles = top3.filter(
    (t: { title?: string }) => !String(t?.title ?? '').trim()
  ).length
  checks.push({
    name: 'TOP3 제목 빈칸 없음',
    pass: top3.length > 0 && emptyTitles === 0,
    detail: emptyTitles === 0 ? '빈 제목 0개' : `빈 제목 ${emptyTitles}개`,
    severity: 'hard',
  })
  const healthCheck = Array.isArray(briefing.health_check) ? briefing.health_check : []
  const filledHealth = healthCheck.filter(
    (h: { category?: string; summary?: string }) => h?.category && String(h?.summary ?? '').trim()
  )
  checks.push({
    name: 'healthCheck 분야 최소 4개',
    pass: filledHealth.length >= 4,
    detail: `${filledHealth.length}개 채워짐`,
    severity: 'hard',
  })
  // JSON 필드 안 깨짐·빈 칸 없음
  let dailyTermOk = false
  try {
    const t = typeof briefing.daily_term === 'string' ? JSON.parse(briefing.daily_term) : briefing.daily_term
    dailyTermOk = Boolean(t?.term && t?.explanation)
  } catch { dailyTermOk = false }
  const indicators = Array.isArray(briefing.indicators) ? briefing.indicators : []
  const fieldsOk = Boolean(headline.trim() && summary.trim() && dailyTermOk && indicators.length > 0)
  // 존댓말 일관성 (v2.4 — 옛 '톤' 점수 항목의 기계 검사 가능한 부분만 코드로 이동)
  // ⚠️ TOP3 해설(steps)은 의도적으로 반말체라 검사 대상이 아니다. 존댓말 영역만 본다.
  const politeTargets = [headline, summary, String(briefing.share_card ?? '')].join(' ')
  const sentences = politeTargets
    .split(/[.!?\n]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 6)
  const casual = sentences.filter(t => !/(요|죠|니다|습니다|입니다|네요|데요|세요|까요)$/.test(t))
  checks.push({
    name: '존댓말 일관 (반말 혼입 없음)',
    pass: casual.length === 0,
    detail: casual.length === 0 ? '반말 문장 0개' : `반말 의심 ${casual.length}개: ${casual.slice(0, 2).map(t => t.slice(0, 20)).join(' / ')}`,
    severity: 'soft',
  })
  checks.push({
    name: '필드 안 깨짐·빈 칸 없음',
    pass: fieldsOk,
    detail: `헤드라인 ${headline.trim() ? 'O' : 'X'} / 요약 ${summary.trim() ? 'O' : 'X'} / 용어 ${dailyTermOk ? 'O' : 'X'} / 지표 ${indicators.length}개`,
    severity: 'hard',
  })
  return checks
}

// ── AI 채점 (기준표 2. 점수 항목) ─────────────────────────────────────────────
// v3.0 최종 구성 — **점수 항목은 이해도·사실 2개(만점 4점)뿐이다.**
//   2026-07-20 사람 정답지(13일×4항목) 대조로 항목별 신뢰도를 실측한 결과:
//     이해도 69% · 사실 75~88%  → 점수로 관리 (사람 판단과 맞음)
//     선정   사람이 13일 전부 1점(변별력 0)        → 관측 전용
//     다양성 눈금을 양쪽 끝으로 다 잡아봐도 38%   → 관측 전용
//     톤     8일 내내 2점(변별력 0)               → 폐기, 존댓말만 코드 검사
//   원칙: **AI가 잘하는 것만 AI에게 시킨다.** 못 재는 항목을 점수에 넣으면 총점이 부풀어
//   "좋아 보이지만 틀린 숫자"가 된다 — 2026-07-16 오보가 10점 만점을 받은 게 그 결과였다.
interface ItemScore { score: number | null; reason: string }
interface AIGradeResult {
  comprehension: ItemScore
  factual: ItemScore
  selection: ItemScore
  diversity: ItemScore
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
  candidates: { title: string }[],
  rateNote = ''
): Promise<AIGradeResult> {
  const dailyTerm = (() => {
    try {
      return typeof briefing.daily_term === 'string' ? JSON.parse(briefing.daily_term) : briefing.daily_term
    } catch { return null }
  })()
  const indicators = (Array.isArray(briefing.indicators) ? briefing.indicators : []) as
    { name?: string; value?: string; change?: string }[]
  const top3 = (Array.isArray(briefing.top3_analysis) ? briefing.top3_analysis : []) as
    { title?: string; steps?: { oneline?: string; conclusion?: string; whatHappened?: string } }[]
  const healthCheck = Array.isArray(briefing.health_check) ? briefing.health_check : []
  const connections = Array.isArray(briefing.connections) ? briefing.connections : []

  // 모든 항목이 공유하는 대조 자료 + 채점 대상 (항목별 호출에 매번 붙인다)
  const context = `## 대조 자료 (ground truth)
### 실측 지표 (직전 거래일 마감, 코드가 시세 API에서 수집한 실제 값)
${indicators.map(i => `- ${i.name}: ${i.value} (전일 대비 ${i.change})`).join('\n') || '- 없음'}
${rateNote}

### 그날 후보 기사 제목 풀 (브리핑 생성에 쓰인 후보 ${candidates.length}건)
${candidates.map((a, i) => `${i}. ${a.title}`).join('\n') || '- 없음'}

## 채점 대상 브리핑
- 헤드라인: ${JSON.stringify(String(briefing.headline ?? ''))}
- 전체 요약: ${JSON.stringify(String(briefing.summary ?? ''))}
- 오늘의 한 줄(shareCard): ${JSON.stringify(String(briefing.share_card ?? ''))}
- 오늘의 용어: ${JSON.stringify(dailyTerm)}
- TOP3 기사 제목: ${JSON.stringify(top3.map(t => t.title ?? ''))}
- TOP3 해설 요지(윗칸과 모순되는지 대조용): ${JSON.stringify(
    top3.map((t, i) => `${i + 1}번: ${t.steps?.oneline ?? ''} / ${t.steps?.conclusion ?? ''} / ${t.steps?.whatHappened ?? ''}`)
  )}
- 분야별 건강진단: ${JSON.stringify(healthCheck)}
- 핵심 흐름(connections): ${JSON.stringify(connections)}`

  // ── 항목별 개별 호출 (v2.4) ────────────────────────────────────────────────
  // 옛 방식은 5항목을 한 번에 채점시켜, 한 항목의 강한 감점이 나머지를 오염시켰다(halo).
  // 2026-07-09 사고 때 "항목별 독립 채점" 지시를 프롬프트에 넣었지만 7/20 검증에서
  // 사실 0점이 나오자 이해도·톤이 동반 하락 — 지시만으로는 안 지켜짐이 실증됐다.
  // → 아예 호출을 분리해 심사위원이 다른 항목의 판단을 볼 수 없게 한다(구조로 차단).
  // ⚠️ 항목별 모델 (v2.6): 사실 정확성만 상위 모델을 쓴다.
  //   근거(2026-07-20 13일치 실측): gpt-4o-mini는 인용은 시키면 하지만 추론이 헛돈다 —
  //   "기준금리 2.75% ▲인상"을 근거로 인용해놓고 "인상 서술이 대조 자료와 불일치"라 하고
  //   (7/17), "하락한 것이 맞음에도 불구하고 일치하지 않음"(7/20)처럼 자기모순 문장을 쓴다.
  //   코드 가드는 "인용이 실제로 존재하는가"까지만 검증할 수 있고 추론의 타당성은 못 본다.
  //   → 판단 난이도가 가장 높은 사실 항목만 모델을 올린다. 하루 1회 호출이라 비용 영향 미미.
  async function gradeOne(criterion: string, outputSpec: string, model = 'gpt-4o-mini'): Promise<Record<string, unknown>> {
    const res = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '당신은 꼼꼼하고 엄격한 품질 심사위원입니다. 주어진 대조 자료에 근거해서만 판단하고, 근거 없이 추측하지 않습니다. 지금 요청받은 항목 하나만 채점하고, 다른 품질 문제는 판단하지 마세요.',
        },
        {
          role: 'user',
          content: `당신은 경제 브리핑 품질 심사위원입니다. 아래 브리핑을 대조 자료와 비교해 **아래 한 가지 항목만** 채점하세요.

${context}

## 채점 항목 (0~2점: 2=충족, 1=보통, 0=미달)
${criterion}

## 출력 (JSON만, 다른 텍스트 없이)
${outputSpec}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0, // 재현성 우선 — 같은 브리핑을 다시 채점해도 값이 흔들리지 않게
    })
    try {
      return JSON.parse(res.choices[0].message.content ?? '{}')
    } catch {
      return {}
    }
  }

  const asItem = (o: Record<string, unknown>): ItemScore => ({
    score: clampScore((o as { score?: unknown })?.score),
    reason: String((o as { reason?: unknown })?.reason ?? ''),
  })

  const [rawComprehension, rawFactual, rawSelection, rawDiversity] = await Promise.all([
    gradeOne(
      `① 이해도 — 경제 초보자가 바로 이해되는가 (요약·용어 설명 기준)
   **채점 눈금 (사람 정답지 기준으로 보정 — 2026-07-20):**
   - **2점 = 기본값.** 요약이 '~해요'체로 쉽게 풀어써 있고, 어려운 용어가 나와도 그 자리에서 설명되거나 '오늘의 용어'로 보완되면 2점입니다. 전문 용어가 한두 개 등장하는 것만으로는 감점하지 마세요.
   - 1점 = 설명 없이 등장한 용어 때문에 **초보자가 문단 전체의 뜻을 놓칠 정도**일 때만.
   - 0점 = 전문 용어를 그대로 나열해 무슨 말인지 모를 때.
   ⚠️ 사람 채점자는 13일 중 11일을 2점으로 봤습니다. **"일부 용어가 설명 없이 나옴"을 이유로 습관적으로 1점을 주지 마세요** — 그 용어 때문에 실제로 이해가 막히는지를 보고 판단하세요.
   ⚠️ 문장이 읽기 쉬운가만 보세요. 내용이 사실인지·중요한 기사를 골랐는지는 **다른 심사위원이 따로 채점하므로 절대 고려하지 마세요.**`,
      `{"score": 0, "reason": "한두 문장 근거"}`
    ),
    gradeOne(
      `② 사실 정확성 — 숫자·오르내림 방향·인과가 위 [대조 자료]와 맞는가 (2=대조 가능한 것 모두 정확 / 1=사소하게 부정확·모호 / 0=숫자 틀림·방향 반대·대조 자료에 전혀 근거 없는 사실 서술)
   ⚠️ 대조 자료(제목·지표)로 확인할 수 없는 서술은 감점하지 말고 reason에 "확인 불가: ..."로만 남기세요. "~할 전망", "~로 보여요" 같은 전망·예측·해석 서술은 사실 오류로 처리하지 마세요(확인 불가로만).
   ⚠️ **먼저 시제 검사부터 하고, 통과한 뒤에 숫자 대조를 하세요.**
   ⛔ **실측 지표의 함정(반드시 읽을 것)**: 지표의 기준금리 '— 유지' / '▲ 인상' 표시는 **직전 거래일 대비 변화**일 뿐, **오늘 금융통화위원회가 내린 결정이 아닙니다.** 금통위 발표는 브리핑 발행(오전 9시경) 뒤에 나오므로, 발표 당일 아침 지표는 **결정 전 값**입니다. 따라서 후보 풀에 "오늘 기준금리 결정" 기사가 있는 날에는 **지표의 '유지' 표시를 브리핑이 맞다는 근거로 쓸 수 없습니다.** 이 경우 지표는 "아직 발표 전"이라는 뜻입니다.
   ⚠️ **시제 검사** — 아래 **세 조건을 모두** 만족할 때만 적용합니다(하나라도 아니면 시제 위반이 아닙니다):
     (a) 후보 기사 풀에 그 사안을 "오늘 결정한다 / 결정 예정 / 발표 앞두고 / 여부 주목"처럼 **아직 안 정해진 일**로 쓴 제목이 실제로 있고,
     (b) 브리핑이 그 결과를 "○○했어요 / ○○로 결정됐어요"처럼 **완료형으로 단정**했고,
     (c) **실측 지표가 아직 그 변화를 반영하지 않았다.**
     → 세 조건이 다 맞으면 사실 0점 + fabrication 검토, tenseViolation을 true로 하고 tenseEvidence를 채우세요.
     ⛔ **지표가 이미 그 변화를 반영하고 있으면(예: 기준금리가 이미 2.75%로 인상 표시) 그 사건은 이미 일어난 것이므로 시제 위반이 아닙니다.** 어제 일어난 일을 오늘 브리핑이 서술하는 것은 정상입니다.
     ⛔ "대조 자료로 확인이 안 된다"는 것은 시제 위반의 근거가 **아닙니다**. 확인 불가는 감점 사유가 아니라 '확인 불가'로만 남깁니다.
   ⚠️ **내부 일관성 검사(필수)**: 헤드라인·요약·shareCard와 [TOP3 해설 요지]가 서로 반대로 말하고 있으면(예: 윗칸은 "동결", 해설은 "또 올랐다") 둘 중 하나는 반드시 틀린 것이므로 **1점 이하**로 채점하고 reason에 모순 지점을 그대로 적으세요.

   ⚠️ **감점(1점 이하) 시 근거 지목 필수**: 브리핑의 어느 서술이(claim) 대조 자료의 무엇과(evidence) 어긋나는지 적으세요. evidence는 **실측 지표의 이름·값** 또는 **후보 기사 제목을 그대로** 인용해야 하며, 코드가 대조 자료와 맞춰 검증합니다. 지목하지 못하면 감점하지 말고 2점을 주세요(확인 불가는 감점 사유가 아닙니다).

## 안전선 (점수와 무관, 하나라도 true면 그날 브리핑 실격)
- investmentAdvice: "사라/팔아라/투자해라" 같은 투자 조언·권유 문구가 있는가
- fabrication: 대조 자료 어디에도 근거가 없는 구체적 사실(수치·사건)을 지어낸 정황이 뚜렷한가 (쉬운 비유는 해당 없음. 뚜렷한 정황이 없으면 false)
- 실격을 true로 하면 issueNote에도 그 사유를 한 줄로 쓰세요.`,
      `{"score": 0, "reason": "대조한 항목과 결과를 구체적으로", "claim": "감점 시 문제가 된 브리핑 서술 그대로, 감점 아니면 null", "evidence": "감점 시 그와 어긋나는 대조 자료(지표 이름·값 또는 후보 기사 제목)를 그대로, 감점 아니면 null", "tenseViolation": false, "tenseEvidence": "시제 위반이면 '아직 안 정해진 일'로 쓴 후보 기사 제목 그대로, 아니면 null", "disqualify": {"investmentAdvice": false, "fabrication": false, "reason": ""}, "issueNote": "오늘 브리핑에서 눈에 띈 문제 한 줄 (없으면 '특이사항 없음')"}`,
      'gpt-4o'
    ),
    gradeOne(
      `③ 선정 판단 (⚠️ 이 항목은 현재 **관측 전용** — 점수는 총점에 반영되지 않습니다. 판단 근거를 남기는 게 목적이니 평소대로 채점하세요) — 후보 풀에서 그날 가장 중요한 이슈를 헤드라인·TOP3로 골랐는가. 판단 축: 파급(영향받는 사람 수)·체감(내 지갑에 닿는 정도)·사건성(오늘 새로 터졌나)·규모(변화 크기)를 종합 (2=가장 중요한 이슈를 1등으로 / 1=무난하나 더 중요한 걸 놓침 / 0=사소한 것을 1등으로, 또는 단순 시황·해외 단독을 올림)
   ⚠️ 감점(1점 이하) 조건: 위 [후보 기사 제목 풀]에서 브리핑이 놓친 더 중요한 기사를 찾아 missedTitle에 **제목을 한 글자도 바꾸지 말고 그대로** 적으세요. 구체적으로 지목할 기사가 없으면 감점하지 말고 2점을 주세요 ("놓쳤을 여지가 있다" 같은 막연한 감점 금지). 단순 시황 기사(지수·환율이 올랐다/내렸다 자체)와 해외 단독 기사는 선정 금지 대상이므로 "놓친 기사"로 지목할 수 없습니다. **이미 TOP3에 선정된 기사는 "놓친 기사"가 아니므로 지목할 수 없습니다**(브리핑이 고른 걸 놓쳤다고 할 수 없음).
   ⚠️ 글이 쉬운지·문체가 어떤지는 다른 심사위원 몫이니 고려하지 마세요.`,
      `{"score": 0, "reason": "판단 근거", "missedTitle": "감점 시 후보 풀 제목 그대로, 감점 아니면 null"}`
    ),
    gradeOne(
      `④ 다양성 (⚠️ 이 항목은 현재 **관측 전용** — 점수는 총점에 반영되지 않습니다. 판단 근거를 남기는 게 목적이니 평소대로 채점하세요) — TOP3가 서로 다른 **사건**인가
   **채점 눈금 (사람 정답지 기준으로 보정 — 2026-07-20):**
   - **2점 = 기본값.** 세 기사가 서로 다른 사건이면 2점입니다. **같은 분야(둘 다 증시·둘 다 정부 정책·둘 다 금융)라는 이유로는 절대 감점하지 마세요.**
   - 1점 = 두 기사가 **같은 사건·같은 주체·같은 통계**를 다룰 때만. (예: 1번 "증권사 2분기 실적 역대급" ↔ 2번 "증권사 영업이익 5조 돌파" = 둘 다 증권사 2분기 실적 = 1점)
   - 0점 = **같은 사건을 다른 언론사가 제목만 바꿔 쓴 수준**으로 사실상 같은 기사가 2개 이상일 때만. 웬만하면 0점은 나오지 않습니다.
   ⚠️ **겹침 판정을 남발하지 마세요.** 직전 채점에서 "중동 유가 급등" ↔ "산업은행 정책금융"을 겹친다며 0점을 준 오판이 있었습니다. 소재가 둘 다 경제라는 건 겹침이 아닙니다.
   ⚠️ 사람 채점자는 13일 중 **5일을 2점, 8일을 1점**으로 봤고 **0점은 한 번도 없었습니다.**
   ⚠️ 감점(1점 이하) 조건: TOP3 중 어느 두 개가 겹치는지 overlapPair에 번호(0~2) 두 개를 적으세요(overlapTopic은 있으면 좋지만 필수는 아닙니다). 어느 둘이 겹치는지 특정하지 못하면 감점하지 말고 2점을 주세요.
   ⚠️ **판단을 미루지 마세요.** 사람 채점자는 같은 자료로 13일 전부 판단했습니다. 제목 3개를 읽고 "서로 다른 사건인가"만 보면 되는 일이므로, 확신이 부족해도 번호를 지목해 판단을 내리세요.
   ⚠️ **"금융"·"경제"·"주식 시장"처럼 넓은 범주로 묶지 마세요.** 겹친다고 하려면 **같은 사건·같은 주체·같은 통계**를 다루고 있어야 합니다(예: 둘 다 '증권사 2분기 실적'). 서로 다른 사건이면 같은 분야라도 겹침이 아닙니다.
   ⚠️ 사실 정확성·글의 쉬움은 다른 심사위원 몫이니 고려하지 마세요.`,
      `{"score": 0, "reason": "", "overlapPair": null, "overlapTopic": "감점 시 겹치는 주제, 감점 아니면 null"}`
    ),
  ])

  const comprehension = asItem(rawComprehension)

  // 제목 비교용 정규화 (사실·선정 가드가 모두 쓰므로 맨 위에서 선언 — 선언 전 사용 시 런타임 TDZ 에러)
  const norm = (s: string) => s.replace(/\s+/g, '')

  // ── 사실 감점 근거 검증 가드 (v2.5) ────────────────────────────────────────
  // v2.4에서 시제 검사를 넣자 심사위원이 이를 "지표로 확인 안 되면 0점"으로 뭉개 적용해
  // 13일 중 9일이 사실 0점이 됐다(7/17·7/18은 이미 일어난 인상을 '발표 전 단정'이라 하고,
  // 7/12는 전망 서술을, 7/15는 확인 불가를 0점 처리 — 전부 프롬프트가 금지한 것).
  // → 선정·다양성에 쓴 원칙을 사실에도 적용: **감점에는 코드가 대조 가능한 지목이 따라야 한다.**
  const factual = asItem(rawFactual)
  if (factual.score !== null && factual.score < 2) {
    const evidence = String((rawFactual as { evidence?: unknown })?.evidence ?? '').trim()
    // 대조 자료 원문(지표 + 후보 제목)에 evidence의 핵심 단어가 실제로 있는지 확인
    const haystack = [
      ...indicators.map(i => `${i.name} ${i.value} ${i.change}`),
      ...candidates.map(c => c.title),
    ].join(' ')
    const hayTokens = titleTokenSet(haystack)
    const evTokens = [...titleTokenSet(evidence)]
    const hit = evTokens.length > 0 && evTokens.filter(t => hayTokens.has(t)).length / evTokens.length >= 0.6

    const tenseClaimed = Boolean((rawFactual as { tenseViolation?: unknown })?.tenseViolation)
    const tenseTitle = String((rawFactual as { tenseEvidence?: unknown })?.tenseEvidence ?? '').trim()
    // 시제 위반 주장은 ⓐ지목한 제목이 후보 풀에 실제로 있고 ⓑ그 제목이 '아직 안 정해진 일'
    // 어투일 때만 인정한다. (7/17·7/18 오판 = 지목 없이 시제 위반을 주장한 경우)
    const tenseTitleInPool = Boolean(tenseTitle) && candidates.some(c => norm(c.title) === norm(tenseTitle))
    const tenseWordOk = /결정|예정|전망|여부|앞두고|주목|앞둔|열린다|연다/.test(tenseTitle)
    const tenseOk = tenseClaimed && tenseTitleInPool && tenseWordOk

    if (tenseClaimed && !tenseOk) {
      factual.reason = `[시제 위반 주장 무효 → 판정 불가] 후보 풀에서 '아직 안 정해진 일'로 쓴 기사를 지목하지 못함${tenseTitle ? ` (지목: "${tenseTitle}")` : ''} (원 사유: ${factual.reason})`
      factual.score = null
    } else if (!hit) {
      factual.reason = `[근거 지목 실패 → 판정 불가] 어긋나는 대조 자료를 지목하지 못함${evidence ? ` (지목: "${evidence}")` : ''} (원 사유: ${factual.reason})`
      factual.score = null
    } else {
      factual.reason = `근거 지목: "${evidence}" — ${factual.reason}`
    }
  }

  // ── 지목 검증 가드 (v2.3, 2026-07-20 오판 3·4호 리뷰 결정) ────────────────
  // v2.2에서 "감점에는 코드가 검증 가능한 지목이 따라야 한다"를 도입했으나 양방향으로 뚫려 있었다:
  //   ⓐ 지목 실패 → 자동 2점 = 판정 불가가 '만점'으로 기록됨 (7/12·7/19)
  //   ⓑ 지목 성공 시 내용 무검증 → 이미 TOP3에 있는 기사를 "놓쳤다"고 지목해도 통과 (7/20)
  // 원칙 수정: 지목을 못 하거나 지목이 무효면 그건 '잘했다'가 아니라 '판정 불가(null)'다.
  // 모르는 것을 잘한 것으로 적으면 데이터가 쌓일수록 판단이 나빠진다.
  const top3Titles = new Set(top3.map(t => norm(String(t.title ?? ''))))

  const selection = asItem(rawSelection)
  if (selection.score !== null && selection.score < 2) {
    const missed = String((rawSelection as { missedTitle?: unknown })?.missedTitle ?? '').trim()
    const inPool = Boolean(missed) && candidates.some(c => norm(c.title) === norm(missed))
    const alreadyPicked = Boolean(missed) && top3Titles.has(norm(missed))
    if (inPool && !alreadyPicked) {
      selection.reason = `놓친 기사 지목: "${missed}" — ${selection.reason}`
    } else if (alreadyPicked) {
      // 심사위원이 브리핑이 이미 고른 기사를 "놓쳤다"고 지목한 경우 = 지목 자체가 무효
      selection.reason = `[지목 무효 → 판정 불가] 지목한 "${missed}"는 이미 TOP3에 선정된 기사임 (원 사유: ${selection.reason})`
      selection.score = null
    } else {
      selection.reason = `[지목 실패 → 판정 불가] 후보 풀에서 놓친 기사를 지목하지 못함 (원 사유: ${selection.reason})`
      selection.score = null
    }
  }

  const diversity = asItem(rawDiversity)
  if (diversity.score !== null && diversity.score < 2) {
    const pair = (rawDiversity as { overlapPair?: unknown })?.overlapPair
    const topic = String((rawDiversity as { overlapTopic?: unknown })?.overlapTopic ?? '').trim()
    const validPair = Array.isArray(pair) && pair.length === 2
      && pair.every((n: unknown) => Number.isInteger(n) && Number(n) >= 0 && Number(n) < top3.length)
      && pair[0] !== pair[1]
    if (validPair) { // v2.8: topic은 선택 — 번호 지목만 되면 인정 (사람은 13일 전부 판단하는데 AI만 8일 기권)
      const [a, b] = pair as [number, number]
      diversity.reason = `겹침 지목: TOP3 ${a + 1}번 "${top3[a]?.title ?? ''}" ↔ ${b + 1}번 "${top3[b]?.title ?? ''}"${topic ? ` (주제: ${topic})` : ''} — ${diversity.reason}`
    } else {
      diversity.reason = `[지목 실패 → 판정 불가] 어느 두 개가 겹치는지 특정하지 못함 (원 사유: ${diversity.reason})`
      diversity.score = null
    }
  }

  const dq = (rawFactual as { disqualify?: { investmentAdvice?: unknown; fabrication?: unknown; reason?: unknown } })?.disqualify
  return {
    comprehension,
    factual,
    selection,
    diversity,
    disqualify: {
      investmentAdvice: Boolean(dq?.investmentAdvice),
      fabrication: Boolean(dq?.fabrication),
      reason: String(dq?.reason ?? ''),
    },
    issueNote: String((rawFactual as { issueNote?: unknown })?.issueNote ?? ''),
  }
}

// ── 기준금리 표시 보정 (v2.8) ────────────────────────────────────────────────
// 지표 라벨('▲ 인상'/'— 유지')은 전일 대비이지만, 금통위 발표 당일 아침은 값이 아직 안 바뀌어
// '유지'로 뜰 수 있다. 과거 브리핑의 기준금리 값을 거슬러 '며칠째 같은 값인지'를 계산해 붙인다.
async function buildRateNote(targetDate: string, briefing: Record<string, unknown>): Promise<string> {
  const getRate = (row: Record<string, unknown>): string | null => {
    const list = Array.isArray(row.indicators) ? row.indicators : []
    const hit = (list as { name?: string; value?: string }[]).find(i => i.name === '기준금리')
    return hit?.value ?? null
  }
  const today = getRate(briefing)
  if (!today) return ''
  try {
    const { data } = await supabase
      .from('briefings')
      .select('date, indicators')
      .lt('date', targetDate)
      .order('date', { ascending: false })
      .limit(40)
    let sameSince = targetDate
    let days = 1
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      if (getRate(row) !== today) break
      sameSince = String(row.date)
      days++
    }
    if (days <= 1) {
      return `※ 기준금리 ${today}: 직전 브리핑과 값이 다릅니다(이번에 바뀐 값).`
    }
    return `※ 기준금리 ${today}는 ${sameSince}부터 ${days}일째 **같은 값**입니다(지표 표시는 '유지'). "오늘 금리가 새로 결정됐다"는 뜻이 아니므로, 브리핑이 이미 반영된 금리 변화를 서술하는 것은 사실 오류가 아닙니다.`
  } catch {
    return ''
  }
}

// ── 주제 유사도 관측 (v2.4, 판정에는 쓰지 않음) ──────────────────────────────
// 다양성을 코드 검사로 옮기려 했으나, 단어 겹침으로는 "같은 주제·다른 표현"을 못 잡는다
// (7/19 증권사 실적 중복 쌍의 단어 겹침 = 0.111, 정상 날들과 구분 안 됨).
// 의미 유사도(embedding)는 그 쌍을 최고값(0.526)으로 집어냈지만 라벨 사례가 1건뿐이라
// 지금 임계값을 정하면 근거 없는 추측이 된다 → **매일 값만 쌓고 판정은 사람이 나중에.**
// 실패해도 채점 자체는 계속돼야 하므로 null 반환.
async function measureTopicSimilarity(titles: string[]): Promise<{
  maxPair: number
  pairs: { pair: [number, number]; similarity: number }[]
} | null> {
  const clean = titles.map(t => String(t ?? '').trim()).filter(Boolean)
  if (clean.length < 2) return null
  try {
    const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: clean })
    const vecs = res.data.map(d => d.embedding)
    const cos = (a: number[], b: number[]) => {
      let dot = 0, na = 0, nb = 0
      for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
      return na && nb ? dot / Math.sqrt(na * nb) : 0
    }
    const pairs: { pair: [number, number]; similarity: number }[] = []
    for (let i = 0; i < vecs.length; i++) {
      for (let j = i + 1; j < vecs.length; j++) {
        pairs.push({ pair: [i, j], similarity: Number(cos(vecs[i], vecs[j]).toFixed(3)) })
      }
    }
    return { maxPair: Math.max(...pairs.map(p => p.similarity)), pairs }
  } catch {
    return null
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
  // ⚠️ 발행 시각 이전 기사만 — 발행 후 크론이 추가 수집하면 "최신순 30개"가 통째로 새 기사로
  //    바뀌어, 심사위원이 브리핑이 못 본 기사로 대조하게 됨 (2026-07-09 전항목 0점·실격 오판 사고).
  //    기준은 고정 시각이 아니라 그날 브리핑 행의 실제 생성 시각 → 보험 크론이 발행한 날도 안전.
  const { data: articles } = await supabase
    .from('news_articles')
    .select('id, title')
    .eq('date', targetDate)
    .lte('created_at', String(briefing.created_at))
    .order('created_at', { ascending: false })
  const candidates = buildCandidatePool(articles ?? [])

  // 형식 검사 (코드) — v2.2: 탈락 여부는 하드 검사만으로, 소프트 실패는 경고로 기록
  const formatChecks = runFormatChecks(briefing)
  const formatPass = formatChecks.filter(c => c.severity === 'hard').every(c => c.pass)
  const formatWarnings = formatChecks
    .filter(c => c.severity === 'soft' && !c.pass)
    .map(c => `${c.name} (${c.detail})`)

  // AI 채점 — 기준표 3원칙 ①: 대조 자료 없으면 사실·선정은 '판정 불가'
  const inputsAvailable = candidates.length > 0
  const top3ForSim = (Array.isArray(briefing.top3_analysis) ? briefing.top3_analysis : []) as { title?: string }[]
  // 지표 라벨은 2026-07-21부터 전일 대비 방식(오른 날만 '인상', 이후 같은 값이면 '유지')으로 교정됐다.
  // 다만 금통위 발표 당일 아침은 ECOS 값이 아직 안 바뀌어 라벨이 '유지'로 뜰 수 있으므로,
  // 심사위원에게 "이 값이 며칠째 같은 값인지"를 명시해 발표 전/후를 구분하게 한다
  // (2026-07-20 정답지에서 사람도 AI도 같은 지점에서 헷갈림, 7/17 최대 불일치).
  const rateNote = await buildRateNote(targetDate, briefing)
  const [ai, topicSimilarity] = await Promise.all([
    gradeWithAI(briefing, candidates, rateNote),
    measureTopicSimilarity(top3ForSim.map(t => String(t.title ?? ''))),
  ])
  if (!inputsAvailable) {
    ai.factual = { score: null, reason: '판정 불가 — 그날 후보 기사 풀이 없어 대조 근거 없음' }
    ai.selection = { score: null, reason: '판정 불가 — 그날 후보 기사 풀이 없어 대조 근거 없음' }
  }

  // 총점 = 판정된 항목만 합산, 분모도 같이 기록 (v2.3)
  // 옛 방식은 "하나라도 판정 불가면 총점 null"이라, 판정 불가를 정직하게 표시하는 순간
  // 추세 데이터가 통째로 사라졌다. 대신 분모를 줄이고 몇 점 만점인지를 남긴다.
  // ⚠️ 날짜별 총점을 비교할 때는 반드시 scoreDenominator를 같이 볼 것 (6/10과 6/8은 다른 점수).
  // v2.8: 선정은 '관측 전용'으로 강등 — 총점·분모·경보에서 제외한다.
  //   근거(2026-07-20 사람 정답지): 사람 채점자가 13일 **전부 1점**을 줬다 = 변별력 0.
  //   AI와 100% 일치했지만 그건 "둘 다 항상 1점"이라 의미 없는 일치다(톤 항목과 같은 상태).
  //   항목 자체를 버리진 않는다 — 편집력은 서비스의 핵심이라 근거는 계속 기록한다.
  // v3.0: 다양성도 '관측 전용'으로 강등 (선정과 같은 처리).
  //   근거(2026-07-20 사람 정답지 대조): 눈금을 짜게 잡아도(8일 감점) 후하게 잡아도(12일 만점)
  //   사람과의 일치율이 **양쪽 다 38%**였다. 1점/2점을 찍기만 해도 나오는 수준보다 낮다.
  //   이해도·사실은 눈금 보정만으로 46→69%, 62→75~88%로 올라간 것과 대조된다.
  //   → 눈금 문제가 아니라 **이 구분을 AI가 못 하는 것**이므로 튜닝을 멈추고 점수에서 뺀다.
  //   버리지는 않는다 — 근거는 계속 기록해 사람이 주간 리뷰에서 눈으로 본다.
  ai.selection.reason = `[관측 전용 · 총점 미반영] ${ai.selection.reason}`
  ai.diversity.reason = `[관측 전용 · 총점 미반영] ${ai.diversity.reason}`
  const scoreValues = [ai.comprehension, ai.factual].map(s => s.score)
  const gradedValues = scoreValues.filter((s): s is number => s !== null)
  const scoreDenominator = gradedValues.length * 2
  const ungradedCount = scoreValues.length - gradedValues.length
  const total = gradedValues.length > 0
    ? gradedValues.reduce((a, b) => a + b, 0)
    : null
  const disqualified = ai.disqualify.investmentAdvice || ai.disqualify.fabrication

  // ── 경보선 (v3.1, 2026-07-21 — 역할 재설계 'A') ──────────────────────────────
  // LLM 채점 항목(이해도·사실)을 '관측 전용'으로 강등하고 자동 경보 권한을 회수한다.
  //   근거: 2026-07-20 사람 정답지 재검증에서 사실 88%·이해도 77% — 자동 '경보/실격'을 낼
  //   만큼 믿을 수준이 아니었다. 결정타 = 2026-07-21 오판 5호: 코스피 '이틀 10% 하락'(사실)을
  //   하루치 지표(-4.46%)와 대조해 0점 처리 → 멀쩡한 브리핑을 나쁜 날로 찍었다(후보 풀에
  //   '이틀 새 10% 빠진 코스피' 제목이 있었는데도 못 씀). 오탐 경보는 도구가 없느니만 못하다.
  //   → 진짜 품질 판정은 매주 사람 리뷰가 맡는다. 자동 경보는 '코드로 확실히 잡히는 것'만.
  //   이해도·사실 점수는 계속 계산·기록한다(관측 신호 + 주간 리뷰용). 경보 조건에서만 뺀다.
  //   ⚠️ 금요일 브리핑 세션에서 이 방향 유지 vs 본문 수집(B)으로 전환할지 재검토 예정.
  const alertReasons: string[] = []
  if (disqualified) alertReasons.push('실격(투자권유·날조)') // 안전선: 놓치는 쪽(false negative)이 더 위험해 유지
  if (!formatPass) {
    const failedHard = formatChecks.filter(c => c.severity === 'hard' && !c.pass).map(c => c.name)
    alertReasons.push(`하드 형식 탈락(${failedHard.join('·')})`)
  }
  // ⛔ v3.1에서 경보에서 제외: '사실 0점' · '총점 절반 이하' · '판정 불가 2항목' — 전부 LLM 점수 기반.
  //    이 값들(이해도·사실·총점·분모·판정불가)은 issue_note/시트에 계속 기록돼 사람이 주간 리뷰에서 본다.
  //    존댓말은 여전히 soft 경고(경보 아님) — 코드 검사지만 오탐이 있어(예: '1,477' 숫자) 승격 보류.
  const alert = alertReasons.length > 0
  // 경보·소프트 경고는 사용자가 실제로 보는 곳(점수 행 → 시트)에 박제. 메일은 보조 채널.
  const warnNote = formatWarnings.length > 0 ? ` | ⚠️ 형식 경고: ${formatWarnings.join(', ')}` : ''
  // 총점을 볼 때 분모가 다르다는 걸 시트에서 바로 알 수 있게 박제 (v2.3)
  const denomNote = ungradedCount > 0 ? ` | ⚖️ ${total}/${scoreDenominator}점 만점 (판정 불가 ${ungradedCount}항목)` : ''
  const issueNote = (alert ? `🚨 경보: ${alertReasons.join(' · ')} | ${ai.issueNote}` : ai.issueNote) + warnNote + denomNote
  if (alert) {
    await notifyFailure(
      '브리핑 품질 경보 (P2)',
      `${targetDate} 자동 경보 — ${alertReasons.join(' · ')}\n(v3.1: 경보는 실격·하드 형식 등 코드 검증 항목만. 이해도·사실은 관측 전용이라 경보에서 제외.) 상세는 briefing_scores 또는 점수 시트 확인.`
    )
  }

  const row = {
    date: targetDate,
    rubric_version: RUBRIC_VERSION,
    total,
    scores: {
      이해도: ai.comprehension,
      사실: ai.factual,
      선정: ai.selection,
      다양성: ai.diversity,
    },
    format_pass: formatPass,
    format_checks: formatChecks,
    disqualified,
    disqualify_reason: disqualified ? ai.disqualify.reason : null,
    issue_note: issueNote,
    inputs: {
      topicSimilarity, // TOP3 제목 의미 유사도 관측 (v2.4, 판정 미사용 — 임계값 정할 데이터 축적용)
      scoreDenominator, // 총점의 만점 — 판정 불가 항목이 있으면 10보다 작다 (v2.3, 날짜 비교 시 필수)
      ungradedCount,
      candidateCount: candidates.length,
      candidateTitles: candidates.map(c => c.title),
      indicators: briefing.indicators ?? [],
      factualBasis: '기사 제목 풀 + 실측 지표 (본문 아님 — 확인 불가 서술은 감점하지 않음)',
      poolCutoff: briefing.created_at, // 대조 자료 = 이 시각(발행) 이전 기사만
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
    formatWarnings,
    formatChecks,
    disqualified,
    alert,
    alertReasons,
    issueNote,
    candidateCount: candidates.length,
  }
}
