// ── 건강진단: 분야 대표·TOP3 기사의 본문으로 6칸을 따로 판단한다 (2026-10-20 신설) ────────────
//
// 왜: 건강진단은 gpt-4o-mini가 헤드라인·요약·TOP3·연결관계와 한 번에 만들면서 후보 30건 「제목」만 봤다.
//     후보 30건은 TOP3용이라 큰 화제 몇 개로 차기 쉽다. 10/20은 국감·금감원·은행 기사로 30건이 차서
//     6칸 중 5칸이 「오늘 뉴스에선 뚜렷한 변화가 안 보여요」였는데, 같은 홈의 분야 카드엔 유가 100달러·월세 비중 50%가 떠 있었다.
//     분야 대표를 같은 프롬프트에 붙여 줘 봤지만(4일 × 2회 재실행) 「변화 없음」이 평균 4.1칸 → 3.75칸뿐이고
//     근거 번호도 엉뚱하게 붙었다(10/17 「고용」 근거 = 동대문구 아파트). 큰 프롬프트의 한 칸이라 지시를 안 따른다.
//
// 하는 일: 본문 기반 고르기(selectStories.ts)가 고른 분야 대표 + TOP3의 본문 앞부분과 지표만 주고 6칸만 판단하게 한다.
//          근거는 코드가 확인한다 = 그 분야의 분야 대표 또는 TOP3만 인정(다른 분야 대표는 버림). 분야 대표가 있으면 근거에 꼭 넣는다.
//
// 실패하면 ok:false를 돌려주고 runBriefing이 generateMainBriefing의 건강진단을 그대로 쓴다. 발행은 막지 않는다.
// 결과 기록 = briefings.top3_dedup.selection.health(모델·소요·실패 사유).
import { anthropic } from './anthropic'
import { SYSTEM_PROMPT } from './openai'
import { indicatorLine } from './marketData'
import { NEWS_CATEGORIES } from './generateBriefing'
import type { ArticleBody } from './articleBody'
import type { HealthCheckItem, KeyIndicator } from '@/types'

export const HEALTH_MODEL = process.env.HEALTH_MODEL || 'claude-opus-5-5'
const EXCERPT_CHARS = 600        // 기사 9건 × 600자 ≈ 5천자. 상태(좋음·보통·주의)를 정하려면 고르기(350자)보다 조금 더 본다
const HEALTH_TIMEOUT_MS = 60_000 // 발행 전체 한도 300초. generateMainBriefing과 동시에 돌아서 발행 시간을 거의 안 늘린다
const QUIET = '오늘 뉴스에선 뚜렷한 변화가 안 보여요.'

export interface HealthArticle {
  title: string
  body?: ArticleBody
  category?: string   // 분야 대표면 그 분야. 없으면 TOP3
}

export type HealthResult =
  | { ok: true; items: HealthCheckItem[]; log: { model: string; ms: number } }
  | { ok: false; log: { model: string; ms: number; note: string } }

function buildPrompt(articles: HealthArticle[], indicators: Omit<KeyIndicator, 'easyExplanation'>[]): string {
  const indicatorList = indicators.length > 0 ? indicators.map(indicatorLine).join('\n') : '- (지표 없음)'
  const list = articles.map((a, n) => {
    const excerpt = a.body?.ok ? a.body.text.replace(/\s+/g, ' ').slice(0, EXCERPT_CHARS) : '(본문 없음)'
    return `${n}. [${a.category ? `분야 대표: ${a.category}` : 'TOP3'}] ${a.title}\n   본문: ${excerpt}`
  }).join('\n')

  return `오늘 한국 경제의 분야별 건강진단 6칸(물가·소비·수출·고용·부동산·금융)을 매겨 주세요. 아래 기사 본문과 지표만 근거로 씁니다.

## 지표 (직전 거래일 마감 기준)
${indicatorList}

## 오늘 기사 (번호. [자리] 제목 / 본문 앞부분)
${list}

## 판단 기준
- 보통 사람의 생활·지갑 기준으로 봅니다. 그 분야 소식이 생활에 부담·위험이면 "warning", 나아지는 소식이면 "good", 어느 쪽도 아니거나 좋고 나쁜 게 엇갈리면 "normal"입니다.
- [분야 대표: ○○] 기사가 있는 분야는 그 기사 번호를 evidence에 반드시 넣고, summary에 그 기사의 핵심(무슨 일인지, 숫자가 있으면 숫자)을 담습니다. 이 분야에는 "변화가 안 보인다"고 쓰지 마세요.
- [TOP3] 기사가 어떤 분야의 이야기이면 그 분야 evidence에 넣어도 됩니다. 다른 분야의 [분야 대표] 기사는 넣지 마세요.
- 분야 대표도 없고 TOP3에도 그 분야 기사가 없으면 evidence는 []로 둡니다(그 칸은 코드가 채웁니다).
- 숫자·사건은 위 본문과 지표에 있는 것만 씁니다. 지어내지 마세요.
- 금융은 지표도 근거입니다. 코스피·코스닥이 올랐다/내렸다고 쓸 때는 위 지표의 ▲▼ 방향과 같아야 합니다.
- summary는 "~해요/~예요" 말투의 한 문장, 50자 안팎으로 씁니다. 「기사에 따르면」「본문」 같은 말은 쓰지 마세요.

JSON만 답하세요(다른 글 없이). 6개를 물가·소비·수출·고용·부동산·금융 순서로:
{"healthCheck": [{"category": "분야 이름", "evidence": [기사 번호], "status": "good 또는 normal 또는 warning", "summary": "한 문장"}]}`
}

export async function judgeHealthCheck(
  articles: HealthArticle[],
  indicators: Omit<KeyIndicator, 'easyExplanation'>[]
): Promise<HealthResult> {
  const t0 = Date.now()
  const fail = (note: string): HealthResult => ({ ok: false, log: { model: HEALTH_MODEL, ms: Date.now() - t0, note } })
  if (!anthropic) return fail('Claude 키 없음')
  if (!articles.some(a => a.category)) return fail('분야 대표 없음')

  try {
    const res = await anthropic.messages.create({
      model: HEALTH_MODEL,
      max_tokens: 2000,
      output_config: { effort: 'medium' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(articles, indicators) }],
    }, { timeout: HEALTH_TIMEOUT_MS })
    if (res.stop_reason !== 'end_turn') throw new Error(`stop_reason=${res.stop_reason}`)
    const text = res.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as {
      healthCheck?: { category?: string; evidence?: unknown; status?: string; summary?: string }[]
    }

    const VALID_STATUS = new Set(['good', 'normal', 'warning'])
    const items: HealthCheckItem[] = NEWS_CATEGORIES.map(category => {
      const r = (parsed.healthCheck ?? []).find(h => h.category === category)
      const pickIdx = articles.findIndex(a => a.category === category)
      // 근거로 인정 = 이 분야의 분야 대표 + TOP3. 분야 대표는 모델이 빠뜨려도 넣는다(카드에 이미 떠 있는 기사)
      const allowed = (n: number) => articles[n] && (!articles[n].category || articles[n].category === category)
      const idx = (Array.isArray(r?.evidence) ? r.evidence : []).filter((n): n is number => Number.isInteger(n) && allowed(n))
      const evidence = [...new Set(pickIdx >= 0 ? [pickIdx, ...idx] : idx)].slice(0, 3).map(n => articles[n].title.slice(0, 60))
      const summary = String(r?.summary ?? '').trim()
      // 근거 기사가 없으면 「변화 없음」. 단 금융은 지표도 근거라 모델이 쓴 문장을 둔다
      if (!r || !summary || (evidence.length === 0 && category !== '금융')) {
        return { category, status: 'normal', summary: QUIET, evidence: [] }
      }
      return { category, status: (VALID_STATUS.has(r.status ?? '') ? r.status : 'normal') as HealthCheckItem['status'], summary, evidence }
    })
    return { ok: true, items, log: { model: HEALTH_MODEL, ms: Date.now() - t0 } }
  } catch (e) {
    const note = `${HEALTH_MODEL} 실패: ${String((e as Error).message ?? e).slice(0, 120)}`
    console.error(`[healthCheck] ${note} → generateMainBriefing의 건강진단 그대로`)
    return fail(note)
  }
}
