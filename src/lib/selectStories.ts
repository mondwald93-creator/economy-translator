// ── 고르기: 본문을 보고 TOP3와 분야 대표를 한 번에 고른다 (2026-10-19 신설) ────────────
//
// 왜: 10/13에 「쓰기」만 Opus로 바꾸고 「고르기」는 gpt-4o-mini가 제목만 보고 하던 그대로였다.
//     10/13~10/19 7일 실측 = TOP3에 같은 사람 3건(10/13·10/15), 농협 회장 기념품 해명(10/17),
//     「'이 기업' 저가매수 기회」 종목 추천 글(10/19), 본문 못 받은 기사(TOP3 20건 중 8건이 빈칸).
//     분야 대표도 「고용」 자리에 대통령 지지율, 「부동산」 자리에 학교 착공 등 18건 중 5~6건이 분야와 안 맞았다.
//     채점기(v3.1)는 형식을 재서 이 7일 내내 4점이었다 — 「읽을 가치」를 재는 장치가 없었다.
//
// 하는 일:
//   ① 후보의 본문을 먼저 받아, 본문 못 받은 기사는 후보에서 뺀다(해설이 「기사에서 따로 밝히지 않았어요」×3이 되는 원인)
//   ② 시황·해외·낚시 제목(isUnfitForTop3)은 TOP3 후보에서 뺀다
//   ③ 남은 후보의 제목 + 본문 앞부분을 Opus에게 주고 TOP3 3개 + 분야 대표 6개를 한 번에 고르게 한다
//   ④ 분야는 분명히 맞는 기사가 없으면 비운다(억지로 채우지 않음)
//
// 실패하면 ok:false(이유는 log.note)를 돌려주고 runBriefing이 옛 경로(gpt-4o-mini 제목 고르기)로 간다 — 발행은 절대 막지 않는다.
// 결과는 briefings.top3_dedup.selection에 남긴다(관측, 규칙 14-6).
import { anthropic } from './anthropic'
import { SYSTEM_PROMPT } from './openai'
import { isUnfitForTop3, NEWS_CATEGORIES } from './generateBriefing'
import type { ArticleBody } from './articleBody'

export const SELECT_MODEL = process.env.SELECT_MODEL || 'claude-opus-5-5'
const EXCERPT_CHARS = 350       // 본문 앞부분. 30~50건 × 350자 ≈ 1만 5천자 → 한 번 호출에 들어간다
const SELECT_TIMEOUT_MS = 75_000 // 발행 전체 한도 300초 중 고르기에 허용하는 몫. 넘기면 옛 경로

export interface SelectInput {
  id: string
  title: string
  body?: ArticleBody
  // 분야 대표로 써도 되나. 홈 분야 카드는 `date = 오늘`(발행일 KST) 기사만 보여주므로(page.tsx),
  // 어제 발행분을 분야 대표로 고르면 해설만 쓰고 화면엔 안 뜬다. 기본 true, runBriefing이 발행일로 채운다.
  categoryOk?: boolean
}

export interface SelectionLog {
  model: string
  ms: number
  pool: { top3: number; category: number }           // 넘겨받은 후보 수
  eligible: { top3: number; category: number }       // 적격 검사 통과 수
  excluded: { title: string; reason: string }[]      // 뺀 기사와 이유
  top3: { title: string; why: string }[]
  categories: { category: string; title: string | null; why: string }[]
  note?: string
}

export type SelectionResult =
  | { ok: true; top3Indices: number[]; categories: { id: string; title: string; category: string }[]; log: SelectionLog }  // top3Indices = top3Pool 안의 자리 번호
  | { ok: false; log: SelectionLog }   // 실패 사유는 log.note. 호출하는 쪽이 옛 경로로 간다

// 분야 대표 후보 보강 (2026-10-19 12일 재실행에서 「고용」이 8일 비어서). 화제 급등 순 30건 + 국내 우선 20건만으로는
// 조용한 분야(고용·물가)의 기사가 아예 후보에 안 들어온다. 분야마다 제목에 그 분야 단어가 있는 기사를 몇 건씩 더 넣는다.
// 넓은 단어는 일부러 뺐다('값'·'가격'은 주가·집값에 걸리고, '소비'는 소비자물가에 걸린다) — 못 채우는 것보다 엉뚱한 걸 넣는 게 더 나쁘다.
const CATEGORY_KEYWORDS: Record<(typeof NEWS_CATEGORIES)[number], RegExp> = {
  물가: /물가|인플레|생활비|장바구니|밥상|식탁|요금 인상|공공요금|농산물 가격|기름값|유가/,
  소비: /소비자|소비 심리|내수|유통업|백화점|대형마트|편의점|배달앱|외식|온라인쇼핑|카드 결제|지출/,
  수출: /수출|무역|관세|통상|FTA|수입 규제|해외 판매|수주/,
  고용: /고용|취업|일자리|실업|채용|임금|최저임금|노동|근로|정규직|구직|퇴직/,
  부동산: /부동산|집값|아파트|전세|월세|청약|주택|분양|재건축|임대차|LTV|DSR/,
  금융: /금리|대출|은행|금융|보험|카드사|예금|적금|가계부채|코픽스|연체/,
}
export function categoryKeywordExtras<T extends { id: string; title: string }>(
  pool: T[], exclude: Set<string>, perCategory = 4
): T[] {
  const out: T[] = []
  const taken = new Set(exclude)
  for (const cat of NEWS_CATEGORIES) {
    let n = 0
    for (const a of pool) {
      if (n >= perCategory) break
      if (taken.has(a.id) || !CATEGORY_KEYWORDS[cat].test(a.title)) continue
      taken.add(a.id); out.push(a); n++
    }
  }
  return out
}

function excerpt(b?: ArticleBody): string {
  if (!b?.ok || !b.text) return '(본문 없음)'
  return b.text.slice(0, EXCERPT_CHARS).replace(/\s+/g, ' ')
}

function buildPrompt(items: { n: number; title: string; body?: ArticleBody; top3Ok: boolean; categoryOk: boolean }[]): string {
  const tag = (it: { top3Ok: boolean; categoryOk: boolean }) =>
    it.top3Ok && it.categoryOk ? '[T]' : it.top3Ok ? '[T·TOP3만]' : '[분야만]'
  const list = items
    .map(it => `${it.n}. ${tag(it)} ${it.title}\n   ${excerpt(it.body)}`)
    .join('\n\n')
  return `당신은 경제 초보자를 위한 아침 5분 브리핑의 편집장입니다. 오늘 후보 기사의 제목과 본문 앞부분을 보고 두 가지를 고르세요.

## 후보 (번호. [표시] 제목 / 본문 앞부분)
[T] = TOP3·분야 대표 둘 다 가능, [T·TOP3만] = TOP3에만 가능(어제 발행분이라 분야 카드엔 안 뜸), [분야만] = 분야 대표로만 가능
${list}

## 1. 오늘의 TOP3 (반드시 [T] 기사 중에서 3개)
판단 질문: "오늘 한국에서 보통 사람이 가장 알아야 하고 체감할 경제 뉴스는?" 파급(영향받는 사람 수)·체감(내 지갑에 닿는 정도)·사건성(오늘 새로 터진 일인가)·규모를 함께 저울질하세요. 큰 사건이 터진 날은 사건성이, 잔잔한 날은 생활 밀접 뉴스가 1위가 되는 게 정상입니다.
- 세 기사는 반드시 **서로 다른 사안**이어야 합니다. 같은 통계·같은 기업·같은 정책·같은 사람의 같은 자리 발언을 각도만 바꾼 기사는 하나로 칩니다. 독자가 둘을 연달아 읽었을 때 두 번째에서 새로 알게 되는 게 거의 없으면 같은 사안입니다.
- 고르지 말 것: 특정 종목·업종을 사라고 권하는 글(「저가매수 기회」「이 주식 살까」류) · 인물의 발언·해명·소감 자체가 내용인 기사(경제 정책·실적·사건이 뒤따르지 않으면) · 국회 공방·정치 기사 · 지수·환율의 단순 등락과 「이번 주 전망」류 주간 시황 · 「'이것' 모르면」「'이 동네'」처럼 제목이 답을 숨기는 낚시 · 본문이 제목과 다른 기사
- ⭐해외 단독 기사는 고르지 마세요. 외국 기업의 실적·발표(오픈AI·ASML 등), 외국 중앙은행 인사의 발언, 외국 정부 정책은 본문에 한국 경제·한국 기업·한국 소비자에게 미치는 영향이 구체적으로 적혀 있을 때만 후보가 됩니다. 제목에 「미국」이 없어도 내용이 해외 단독이면 해외 기사입니다.
- 같은 코너(제목 끝 [○○] 꼬리표가 같은 기사)에서 2개 이상 고르지 마세요. 주말 기획·칼럼류보다 그날 일어난 사건 보도를 앞에 두세요.
- 1번이 그날 가장 큰 뉴스입니다. 순서에 뜻이 있습니다.

## 2. 분야 대표 (물가·소비·수출·고용·부동산·금융 각 1개)
- 그 분야 기사가 후보에 있으면 **반드시 채우세요**. 후보 뒤쪽의 [분야만] 기사는 분야별로 일부러 모아 둔 것이니 끝까지 살펴보세요. 분야 안에서는 그날 가장 중요한 것을 고릅니다.
- 다만 그 분야가 아닌 기사를 억지로 끼우지는 마세요. 「고용」에 지지율 기사, 「부동산」에 학교 착공 기사는 안 됩니다. 정말 맞는 기사가 없을 때만 null로 두세요.
- 해외 단독 기사는 분야 대표로도 고르지 마세요(TOP3와 같은 기준). [T·TOP3만] 기사도 분야 대표로는 쓰지 마세요.
- 한 기사를 두 분야에 넣지 마세요. TOP3로 고른 기사를 분야 대표로 또 써도 됩니다. 그 분야에 맞는 다른 기사가 없으면 TOP3 기사를 쓰세요(비우는 것보다 낫습니다).

JSON으로만 응답하세요:
{"top3": [{"n": 번호, "why": "고른 이유 한 줄"}, {"n": 번호, "why": "…"}, {"n": 번호, "why": "…"}],
 "categories": [{"category": "물가", "n": 번호 또는 null, "why": "한 줄"}, {"category": "소비", "n": …}, {"category": "수출", "n": …}, {"category": "고용", "n": …}, {"category": "부동산", "n": …}, {"category": "금융", "n": …}]}`
}

/**
 * top3Pool = 화제 급등 순 후보 30건(TOP3는 여기서만), categoryPool = 분야 대표에만 쓸 추가 후보.
 * 둘 다 body가 붙어 있어야 한다(없으면 그 기사는 「본문 없음」으로 제외된다).
 */
export async function selectStoriesWithBody(
  top3Pool: SelectInput[],
  categoryPool: SelectInput[] = []
): Promise<SelectionResult> {
  const t0 = Date.now()
  const excluded: { title: string; reason: string }[] = []
  const items: { n: number; id: string; title: string; body?: ArticleBody; top3Ok: boolean; categoryOk: boolean; top3Index: number }[] = []
  const seen = new Set<string>()

  top3Pool.forEach((a, idx) => {
    if (seen.has(a.id)) return
    if (!a.body?.ok) { excluded.push({ title: a.title, reason: `본문 없음(${a.body?.reason ?? '안 받음'})` }); return }
    seen.add(a.id)
    const unfit = isUnfitForTop3(a.title)
    if (unfit) excluded.push({ title: a.title, reason: 'TOP3 부적합(시황·해외·낚시) → 분야만' })
    items.push({ n: items.length, id: a.id, title: a.title, body: a.body, top3Ok: !unfit, categoryOk: a.categoryOk ?? true, top3Index: idx })
  })
  for (const a of categoryPool) {
    if (seen.has(a.id)) continue
    if (a.categoryOk === false) continue   // 분야 전용 후보인데 분야에 못 쓰면 넣을 이유가 없다
    if (!a.body?.ok) { excluded.push({ title: a.title, reason: `본문 없음(${a.body?.reason ?? '안 받음'})` }); continue }
    seen.add(a.id)
    items.push({ n: items.length, id: a.id, title: a.title, body: a.body, top3Ok: false, categoryOk: true, top3Index: -1 })
  }

  const log: SelectionLog = {
    model: SELECT_MODEL, ms: 0,
    pool: { top3: top3Pool.length, category: categoryPool.length },
    eligible: { top3: items.filter(i => i.top3Ok).length, category: items.length },
    excluded, top3: [], categories: [],
  }

  if (!anthropic) { log.note = 'Claude 키 없음'; log.ms = Date.now() - t0; return { ok: false, log } }
  if (log.eligible.top3 < 3) { log.note = `TOP3 적격 후보 ${log.eligible.top3}건뿐`; log.ms = Date.now() - t0; return { ok: false, log } }

  try {
    const res = await anthropic.messages.create({
      model: SELECT_MODEL,
      max_tokens: 3000,
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(items) }],
    }, { timeout: SELECT_TIMEOUT_MS })
    if (res.stop_reason !== 'end_turn') throw new Error(`stop_reason=${res.stop_reason}`)
    const text = res.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as {
      top3?: { n: number; why?: string }[]
      categories?: { category: string; n: number | null; why?: string }[]
    }

    // TOP3: [T] 기사만, 서로 다른 기사만, 3개
    const top3Indices: number[] = []
    for (const r of parsed.top3 ?? []) {
      const it = items[Number(r.n)]
      if (!it || !it.top3Ok || top3Indices.includes(it.top3Index)) continue
      top3Indices.push(it.top3Index)
      log.top3.push({ title: it.title, why: String(r.why ?? '') })
      if (top3Indices.length === 3) break
    }
    if (top3Indices.length < 3) throw new Error(`TOP3가 ${top3Indices.length}개만 유효`)

    // 분야: 이름이 맞는 것만, 한 기사는 한 분야만
    const usedForCategory = new Set<string>()
    const categories: { id: string; title: string; category: string }[] = []
    for (const r of parsed.categories ?? []) {
      const category = String(r.category ?? '')
      if (!(NEWS_CATEGORIES as readonly string[]).includes(category)) continue
      if (categories.some(c => c.category === category)) continue
      const it = r.n === null || r.n === undefined ? undefined : items[Number(r.n)]
      if (!it || usedForCategory.has(it.id) || !it.categoryOk) {
        log.categories.push({ category, title: null, why: it && !it.categoryOk ? `(오늘 발행분 아니라 비움: ${it.title.slice(0, 30)}) ` + String(r.why ?? '') : String(r.why ?? '') })
        continue
      }
      usedForCategory.add(it.id)
      categories.push({ id: it.id, title: it.title, category })
      log.categories.push({ category, title: it.title, why: String(r.why ?? '') })
    }

    log.ms = Date.now() - t0
    return { ok: true, top3Indices, categories, log }
  } catch (e) {
    log.note = `${SELECT_MODEL} 실패: ${String((e as Error).message ?? e).slice(0, 120)}`
    log.ms = Date.now() - t0
    console.error(`[selectStories] ${log.note} → 옛 경로(gpt-4o-mini 제목 고르기)로 진행`)
    return { ok: false, log }
  }
}
