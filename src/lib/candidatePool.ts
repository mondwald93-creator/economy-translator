import { fetchBriefingPool } from './briefingPool'
import { filterCandidatePool } from './articleGate'
import { buildBaseline, rankByBurst } from './topicBurst'
import { titleTokenSet, isNearDuplicate } from './titleSimilarity'

// ── AI에게 넘길 후보 30건 만들기 (발행·채점 공용) ────────────────────────────
//
// 왜 따로 뺐나 (2026-09-07):
//   채점기(gradeBriefing)가 이 로직을 복사해 갖고 있었다. 9/3에 발행만 「화제 급등 순」으로
//   고치고 복사본은 안 고쳤다(주석엔 "generateBriefing.ts 쪽이 바뀌면 여기도 맞출 것"이라
//   적혀 있었지만 사람 기억에 기댄 방식이라 깨졌다).
//   결과 = 9/4·9/6·9/7 채점기가 받은 30건은 옛 최신순 그대로라 증시·환율로 도배됐고,
//   정작 그날 브리핑이 1면으로 뽑은 기사(공공기관 통폐합·정의선 8조·전세 4700만원)가
//   그 안에 하나도 없었다. DB의 inputs.candidateTitles로 실측 확인.
//   → 「사실」 축은 근거를 못 찾아 3일 연속 판정 불가, 「선정」 축은 이미 TOP3인 기사를
//     "놓쳤다"고 지목해 무효. 발행은 멀쩡했고 재는 자만 옛날 세계를 보고 있었다.
//   CLAUDE.md ⛔표의 "발행·채점이 다른 풀을 보면 심사위원이 브리핑이 못 본 기사로 채점"이
//   풀 자체(briefingPool)가 아니라 「풀에서 30건 고르는 방식」에서 재발한 것이다.
//
// ⭐이제 복사본이 없다. 여기를 고치면 발행·채점이 같이 움직인다.
//   손잡이(GATE_STALE_DAYS·BASELINE_DAYS·TOPIC_*)를 바꾸면 12일 검증부터 다시 돌릴 것.

// 관문 신선도 기준(발행 후 이 일수 초과 시 후보 제외).
// ⚠️ 잠정값 — published_at 실데이터가 며칠 쌓이면 실분포 보고 확정(2026-07-24).
export const GATE_STALE_DAYS = 3

// 화제 급등 기준선을 며칠치로 잡을지 (2026-09-03).
// 5일 = 시뮬레이션에서 쓴 값. 짧으면 기준선이 흔들리고, 길면 서서히 커지는 화제를 놓친다.
const BASELINE_DAYS = 5

// 화제 급등 정렬 손잡이 2개 (2026-09-03 시뮬레이션에서 정한 값. 근거 = topicBurst.ts 머리말)
const TOPIC_MIN_ARTICLES = 5   // 이만큼 안 나온 단어는 화제로 안 침 (1~2건 잡음의 배율 폭주 방지)
const TOPIC_MAX_PER_TOPIC = 4  // 한 화제가 30칸 중 최대 4칸 (9~12개 화제가 고르게 들어옴)

// 직전 BASELINE_DAYS일의 하루 평균 단어빈도를 만든다. 오늘 기사는 넣지 않는다 — 오늘이 분자다.
//
// ⭐과거도 "그날 아침의 후보 풀"을 그대로 재현해서 센다(같은 24시간 창 + 같은 관문).
//    분모와 분자를 같은 잣대로 재야 배율이 뜻을 갖는다.
//    ⚠️ 2026-09-03 최초 구현은 date 컬럼 하루치 전체(관문 전)를 기준선으로 썼는데,
//    기사 수가 훨씬 많아 기준선이 부풀고 배율 대비가 흐려졌다. 그 결과 14일 검증에서
//    「신형 아반떼 타봤어요」·「GV90 가봤어요」 같은 시승기가 1위 화제로 올라왔다.
//    같은 잣대로 맞추자 사라졌다. 잣대를 바꾸려면 이 검증부터 다시 돌릴 것.
//
// 인자가 날짜 하나뿐이라 언제 불러도 같은 값이 나온다(과거 컷오프가 고정 09:07 KST).
// 채점기가 하루 뒤에 불러도 발행 때와 같은 기준선을 재현할 수 있는 이유다.
export async function buildTopicBaseline(today: string, tag = 'runBriefing'): Promise<Map<string, number>> {
  const dailyTitles: string[][] = []

  for (let back = 1; back <= BASELINE_DAYS; back++) {
    const d = new Date(new Date(today + 'T00:00:00Z').getTime() - back * 24 * 60 * 60 * 1000)
    const date = d.toISOString().split('T')[0]
    // 그날 발행 시각(09:07 KST = 00:07 UTC)을 컷오프로 써서 당시 풀을 그대로 되살린다.
    const cutoff = new Date(date + 'T00:07:30Z')
    const pool = await fetchBriefingPool({ date, cutoff })
    const gated = filterCandidatePool(
      pool.map(a => ({ id: a.id, title: a.title, published_at: a.published_at ?? null })),
      { staleDays: GATE_STALE_DAYS, now: cutoff.getTime() }
    )
    if (gated.kept.length > 0) dailyTitles.push(gated.kept.map(a => a.title))
  }

  const baseline = buildBaseline(dailyTitles)
  console.log(`[${tag}] 화제 기준선: ${dailyTitles.length}일치 · 단어 ${baseline.size}개`)
  return baseline
}

export interface GateInputArticle {
  id: string
  title: string
  published_at?: string | null
}

// 후보 풀 관문: AI(헤드라인·TOP3·분야별)에게 넘기기 전에 오래된·연성·의견글 기사를 거른다.
// 여기가 generateMainBriefing과 generateCategoryNews "둘 다"의 상류라 한 곳에서 막힌다.
//
// ⚠️ now는 반드시 "그 브리핑이 발행된 시각"이어야 한다. 채점은 하루 뒤에 도는데 기본값
//    (지금)으로 재면 발행 때 3일 이내였던 기사가 3일 초과로 잘려 풀이 달라진다.
export function gateCandidates(
  articles: GateInputArticle[],
  { now, tag = 'runBriefing' }: { now?: number; tag?: string } = {}
): { inputs: { id: string; title: string }[]; keptCount: number; useGated: boolean } {
  const gate = filterCandidatePool(
    articles.map(a => ({ id: a.id, title: a.title, published_at: a.published_at ?? null })),
    { staleDays: GATE_STALE_DAYS, now }  // now 없으면 filterCandidatePool이 Date.now()를 쓴다
  )
  // 안전장치: 관문이 과하게 걸러 후보가 부족하면(데이터 이상 등) 원본을 그대로 쓴다 — 빈 브리핑 방지.
  const useGated = gate.kept.length >= 30
  const inputs = (useGated ? gate.kept : articles).map(a => ({ id: a.id, title: a.title }))
  console.log(`[${tag}] 후보 관문: ${articles.length}건 → 통과 ${gate.kept.length}건 (제외 ${gate.dropped.length}건: ` +
    `신선도 ${gate.dropped.filter(d => d.reason === 'stale').length}·` +
    `연성 ${gate.dropped.filter(d => d.reason === 'lifestyle').length}·` +
    `의견글 ${gate.dropped.filter(d => d.reason === 'opinion').length}·` +
    `비경제 ${gate.dropped.filter(d => d.reason === 'noneconomic').length})` +
    (useGated ? '' : ' ⚠️통과<30 → 원본 사용'))
  return { inputs, keptCount: gate.kept.length, useGated }
}

// 한국 경제 관련 기사 우선 정렬 (외신·미국 뉴스는 뒤로)
const FOREIGN_KEYWORDS = ['미국', '미 ', '美 ', '美국', '연준', 'Fed ', '중국', '中 ', '일본', '日 ', '유럽', '월가', '나스닥', '다우', 'S&P', '뉴욕증시']

// 관문을 통과한 기사에서 AI에게 넘길 30건을 고른다.
//
// ⭐후보 순서 = ①국내 먼저 ②그 안에서 화제 급등 순 (2026-09-03 신설, topicBurst.ts 참조).
// 예전엔 ②가 없어 created_at 최신순이었고, 밤새 쌓인 증시 시황이 30칸을 채워
// 9/2 예산안(137건)이 통째로 잘렸다. 급등 배율로 재면 예산안이 ×35.5로 1위가 된다.
export function selectCandidatePool<T extends { title: string }>(
  articles: T[],
  topicBaseline: Map<string, number>
): { candidates: T[]; picked: { article: T; score: number; topic: string | null }[] } {
  const isForeign = (title: string) => FOREIGN_KEYWORDS.some(k => title.includes(k)) ? 1 : 0

  const burstRanked = rankByBurst(articles, topicBaseline, { minArticles: TOPIC_MIN_ARTICLES })
  const ordered = burstRanked
    .map((r, i) => ({ ...r, tiebreak: i }))  // 동점이면 급등 정렬이 준 순서 유지
    .sort((a, b) => isForeign(a.article.title) - isForeign(b.article.title) || a.tiebreak - b.tiebreak)

  // 같은 사건을 제목만 바꿔 쓴 중복 기사를 후보 단계에서 제거 (TOP3에 같은 뉴스 3개 방지)
  // + 한 화제가 30칸을 독식하지 못하게 상한을 건다 (TOP3는 서로 다른 주제여야 하므로).
  const acceptedTokenSets: Set<string>[] = []
  const topicCount = new Map<string, number>()
  const picked: typeof ordered = []
  for (const r of ordered) {
    if (picked.length >= 30) break
    const tokens = titleTokenSet(r.article.title)
    if (isNearDuplicate(tokens, acceptedTokenSets)) continue
    if (r.topic) {
      const used = topicCount.get(r.topic) ?? 0
      if (used >= TOPIC_MAX_PER_TOPIC) continue
      topicCount.set(r.topic, used + 1)
    }
    acceptedTokenSets.push(tokens)
    picked.push(r)
  }
  return { candidates: picked.map(r => r.article), picked }
}
