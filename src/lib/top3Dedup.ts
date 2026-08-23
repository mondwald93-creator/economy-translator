import { openai } from './openai'
import { isUnfitForTop3 } from './generateBriefing'
import { titleTokenSet, isNearDuplicate } from './titleSimilarity'

// ── C안: TOP3 세 기사가 독자에게 겹쳐 읽히는지 AI에게 한 번 더 묻는 검문 ────────
// 단어 겹침(titleSimilarity)만으로는 표현이 다른 같은 사안을 못 잡는다.
// 계기 = 2026-08-23 라이브: "복잡해진 금리 방정식…한은의 고심, 또 인상? 매파적 동결?" 과
// "[금통위폴] 7월 이어 8월도 금리 인상?… 전문가 전망 반반으로 갈렸다" 가 겹침 0.25로
// 후보풀(0.5)·최종검문(0.35)을 둘 다 통과해 TOP3에 나란히 실렸다.
// 의미 유사도(embedding)로도 못 잡는다 — 그날 값 0.374는 47일 중앙값 0.314보다 조금 높을 뿐이고
// 같은 날 다른 사건 쌍(0.390)이 더 높았다. 숫자 임계값으로 풀 문제가 아니라 판단이 필요해서 AI를 쓴다.
const JUDGE_MODEL = 'gpt-5.4-mini'

// ⚠️ 모델과 프롬프트 문구는 과거 60일 브리핑으로 재보고 정한 것이다. 바꾸려면 그 검증을 다시 돌릴 것.
// 실측(정답 9일 = 사람이 매긴 중복 5일·정상 4일):
//   4o-mini + 이 프롬프트 → 60일 중 58일 발동. 멀쩡한 날 0/4. 사실상 매일 교체라 못 쓴다.
//   5.4-mini + "보수적으로 판정하라" 문구 → 발동 2%. 중복 1/5만 잡음. 너무 안 잡는다.
//   5.4-mini + 아래 문구 → 발동 12%(7일). 중복 5/5 잡고 멀쩡한 날 4/4 안 잘랐다. ← 채택
// 기준을 "같은 사건인가"가 아니라 "독자가 두 번째에서 새로 알게 되는 게 있는가"로 바꾼 게 핵심이었다.
function judgePrompt(titles: string[]): string {
  return `경제 브리핑 TOP3로 뽑힌 기사 제목 3개입니다. 한 브리핑에 나란히 싣기에 내용이 겹치는 쌍이 있는지 판정하세요.

먼저 각 기사가 다루는 사안을 한 줄로 적으세요. 제목에 나온 범위 안에서만 적습니다.
그 다음 이 질문에 답하세요: "독자가 이 둘을 연달아 읽었을 때, 두 번째 기사에서 새로 알게 되는 게 있는가?"
거의 없다면 겹치는 쌍입니다.

[겹친다]
하나의 같은 사안을 다룬 기사입니다. 초점이나 각도가 달라도 사안이 하나면 겹칩니다.
- 같은 회의·결정·발표를 다룬 기사 둘 (전망과 결과, 기관의 고심과 전문가 의견 모두 포함)
- 같은 기업의 같은 이슈를 다룬 기사 둘
- 같은 통계·같은 수치를 다룬 기사 둘
- 같은 대상의 시세를 시장만 달리해 전한 기사 둘

[안 겹친다]
사안 자체가 다르면 안 겹칩니다.
- 분야만 같고 주체나 사안이 다른 경우 (한은의 기준금리 결정 / 카드사의 조달금리 부담)
- 한쪽이 원인이고 다른 쪽이 그 영향인 경우 (유가가 올랐다 / 그래서 대형주가 내렸다)
- 같은 배경 상황을 공유할 뿐 다루는 대상이 다른 경우 (고환율 속 중소기업 / 고환율 속 자영업)
- 같은 기업이 등장해도 사안이 다른 경우
- 시장 상황이 같을 뿐 서로 다른 종목·다른 현상을 다룬 경우

제목:
${titles.map((t, i) => `${i}. ${t}`).join('\n')}

JSON으로만 응답하세요:
{"events": ["기사0이 다루는 사안", "기사1이 다루는 사안", "기사2가 다루는 사안"], "duplicates": [[0,1]], "reason": "왜 겹치는지 한 줄"}
겹치는 쌍이 없으면 duplicates를 빈 배열로 두세요.`
}

interface Verdict {
  events: string[]
  duplicates: [number, number][]
  reason: string
}

// 판정 1회. 실패하면 null (브리핑 발행은 절대 막지 않는다)
async function judge(titles: string[]): Promise<Verdict | null> {
  try {
    const res = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [{ role: 'user', content: judgePrompt(titles) }],
      response_format: { type: 'json_object' },
      // gpt-5 계열은 temperature 고정이라 보내지 않는다
    })
    const parsed = JSON.parse(res.choices[0].message.content ?? '{}')
    const pairs = Array.isArray(parsed.duplicates) ? parsed.duplicates : []
    return {
      events: Array.isArray(parsed.events) ? parsed.events.map(String) : [],
      // 자리 번호(0~2)만 남기고 잡값은 버린다
      duplicates: pairs
        .filter((p: unknown): p is [number, number] =>
          Array.isArray(p) && p.length === 2 &&
          p.every(n => Number.isInteger(n) && n >= 0 && n < titles.length) &&
          p[0] !== p[1])
        .map((p: [number, number]) => [Math.min(p[0], p[1]), Math.max(p[0], p[1])] as [number, number]),
      reason: String(parsed.reason ?? ''),
    }
  } catch (e) {
    console.error('[top3Dedup] 판정 호출 실패:', e instanceof Error ? e.message : e)
    return null
  }
}

export interface Top3DedupLog {
  model: string
  rounds: { titles: string[]; duplicates: [number, number][]; reason: string }[]
  replaced: { out: string; in: string }[]
  note?: string
}

// TOP3 인덱스를 받아 겹치는 자리를 다른 후보로 바꿔 돌려준다.
// 판정이 실패하거나 바꿀 후보가 없으면 받은 그대로 돌려준다 — 빈 브리핑·미발행이 더 나쁜 결과다.
export async function resolveTop3Overlap(
  indices: number[],
  candidates: { id: string; title: string }[]
): Promise<{ indices: number[]; log: Top3DedupLog }> {
  const log: Top3DedupLog = { model: JUDGE_MODEL, rounds: [], replaced: [] }
  let current = [...indices]

  // 첫 판정 + 교체 → 교체본으로 한 번만 재판정. 최대 2회 호출 (무한 교체 방지)
  for (let round = 0; round < 2; round++) {
    const titles = current.map(i => candidates[i]?.title ?? '')
    if (titles.filter(Boolean).length < 2) break

    const verdict = await judge(titles)
    if (!verdict) {
      log.note = '판정 호출 실패 — 원안 유지'
      break
    }
    log.rounds.push({ titles, duplicates: verdict.duplicates, reason: verdict.reason })
    if (verdict.duplicates.length === 0) break

    // 겹친 쌍에서 뒤쪽 자리를 교체 대상으로 (앞쪽 = AI가 더 중요하게 본 기사라 남긴다)
    const slotsToReplace = [...new Set(verdict.duplicates.map(p => p[1]))].sort((a, b) => a - b)
    const used = new Set(current)
    let replacedThisRound = 0

    for (const slot of slotsToReplace) {
      // 남길 기사들의 단어 집합 — 교체분이 이들과 또 겹치면 안 된다
      const keptTokens = current
        .filter((_, i) => i !== slot)
        .map(i => titleTokenSet(candidates[i]?.title ?? ''))

      const pick = candidates.findIndex((art, idx) =>
        !!art && !used.has(idx) && !isUnfitForTop3(art.title) &&
        !isNearDuplicate(titleTokenSet(art.title), keptTokens, 0.35))

      if (pick === -1) continue // 쓸 만한 교체 후보가 없으면 그 자리는 그대로 둔다
      log.replaced.push({ out: candidates[current[slot]]?.title ?? '', in: candidates[pick].title })
      used.delete(current[slot])
      used.add(pick)
      current[slot] = pick
      replacedThisRound++
    }

    if (replacedThisRound === 0) {
      log.note = '겹침 판정됐으나 교체할 후보가 없어 원안 유지'
      break
    }
  }

  return { indices: current, log }
}
