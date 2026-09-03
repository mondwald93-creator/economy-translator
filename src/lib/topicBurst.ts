// ── 화제 급등 정렬 (2026-09-03) ──────────────────────────────────────────────
//
// 무엇을 고치나: AI에게 넘기는 후보 30건을 "그날 실제로 터진 사건" 순으로 채운다.
//
// 왜 필요했나 (2026-09-02 실측):
//   그날 헤드라인이 「모나미, 위기 속에서 미래를 고민해요」로 나갔다. 같은 날 후보 풀에는
//   2027년도 예산안(821조) 기사가 137건 쌓여 있었는데, AI에게 넘어간 30건 안에 0건이었다.
//   가장 앞선 예산안 기사가 52번째라 30건 컷에서 22칸 밀려 잘렸다.
//   원인은 정렬 기준이 중요도가 아니라 created_at 최신순이었던 것. 밤새 쏟아진 증시 시황
//   기사가 앞자리를 전부 차지했고, 30건 중 22건이 시황이었다. 그런데 프롬프트는 시황을
//   헤드라인·TOP3에서 쓰지 말라고 금지한다. 즉 후보의 4분의 3이 대상 밖이었다.
//   ⭐모델이 잘못 고른 게 아니라 목록에 헤드라인감이 없었다.
//
// 왜 "보도량"이 아니라 "평소 대비 배율"인가 (구현 전 14일치 시뮬레이션에서 기각):
//   1차 설계는 같은 사건 기사를 묶어 보도량 많은 순으로 올리는 것이었다. 두 군데서 깨졌다.
//   ① 예산안 137건이 부처별로 제목 단어가 전부 달라(겹침 0.12~0.40) 0.5 문턱에 못 미쳐
//      4건짜리 조각으로 흩어졌다. 제목 겹침은 중복 제거용이지 사건 묶기용이 아니다.
//   ② 보도량 1위가 매일 「코스피」였다. 그날 화제라서가 아니라 매일 50건씩 나오는 배경어다.
//      시황 비율이 44%→42%로 거의 안 줄었다.
//   그래서 묶지 않고, 단어별로 "평소 며칠 평균 대비 오늘 몇 배인가"를 잰다.
//   코스피는 매일 많아 배율이 1배 근처라 안 올라오고, 예산안은 평소 0에 가깝다가 70건이
//   터져 35.5배가 된다.
//
// 14일치 시뮬레이션 결과 (기준선 확보된 9일 기준):
//   후보 30건 중 시황 기사 46% → 22%
//   9/2 후보 1위: 모나미 기업기사 → 예산안(×35.5). 상위 8건이 전부 예산 관련으로 바뀜
//   30건에 담긴 서로 다른 화제 9~12개
//
// 알려진 흠 3가지 (승인 시 감수하기로 함, 2026-09-03):
//   ① 단어가 같을 뿐인 딴 사건이 한 화제로 묶인다(9/1 「공모」에 경제교육·AI전환·청년기업).
//   ② 해외 뉴스가 상위에 올 수 있다(8/29 잭슨홀 「워시」). FOREIGN_KEYWORDS에 없는 말이라
//      해외 후순위 규칙을 통과했다. 프롬프트의 해외 단독 금지가 최종 방어선.
//   ③ 14일 중 1일(8/25)은 시황이 오히려 늘었다. 기준선 과거 데이터가 그날만 부족했다.
//   셋 다 헤드라인을 망칠 수준은 아니다. AI가 30건 안에서 고르고 프롬프트가 시황·해외
//   단독을 금지하기 때문. 재발하면 여기 기록을 근거로 다시 잰다.

// 화제로 세지 않을 형식어. 날짜·순위·상투어라 어느 날에나 고르게 나와 사건을 가리키지 못한다.
const TOPIC_STOPWORDS = new Set([
  '내년', '올해', '지난해', '역대', '최대', '최고', '오늘', '어제', '종합', '속보', '단독',
  '포토', '클릭', '게시판', '기사', '뉴스', '전망', '기록', '발표', '추진', '확대', '증가',
  '감소', '대비', '이번', '관련', '우리', '한국', '국내', '시장', '대한', '위해', '통해',
  '다시', '계속', '정도', '상황', '가능', '필요', '중요', '지난', '앞으로', '이상', '이하',
  '이라며', '라며', '밝혔다', '말했다',
])

// 숫자로 시작하는 토막(69조·8조·213억·2027)은 화제 이름이 못 된다.
function isNumeric(word: string): boolean {
  return /^[0-9][0-9.]*[가-힣]*$/.test(word)
}

// 제목에서 화제 후보 단어를 뽑는다. titleSimilarity의 토큰화와 같은 정규화를 쓰되
// (한자 약칭 통일·기호 제거) 형식어와 숫자를 걷어낸다.
export function titleKeywords(title: string): string[] {
  const norm = title
    .replace(/韓/g, '한국')
    .replace(/美/g, '미국')
    .replace(/中/g, '중국')
    .replace(/日/g, '일본')
    .replace(/[^가-힣a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
  const seen = new Set<string>()
  for (const raw of norm.split(' ')) {
    const w = raw.trim()
    if (w.length < 2) continue
    if (TOPIC_STOPWORDS.has(w)) continue
    if (isNumeric(w)) continue
    seen.add(w)
  }
  return [...seen]
}

// 단어별 문서빈도 = 그 단어가 제목에 등장한 기사 수.
export function documentFrequency(titles: string[]): Map<string, number> {
  const df = new Map<string, number>()
  for (const t of titles) {
    for (const w of titleKeywords(t)) df.set(w, (df.get(w) ?? 0) + 1)
  }
  return df
}

// 기준선 = 직전 며칠간의 하루 평균 문서빈도.
// dailyTitles는 [1일차 제목들, 2일차 제목들, ...] 꼴. 빈 배열이면 빈 기준선(전부 신규 화제 취급).
export function buildBaseline(dailyTitles: string[][]): Map<string, number> {
  const days = dailyTitles.filter(d => d.length > 0)
  if (days.length === 0) return new Map()
  const sum = new Map<string, number>()
  for (const titles of days) {
    for (const [w, n] of documentFrequency(titles)) sum.set(w, (sum.get(w) ?? 0) + n)
  }
  const base = new Map<string, number>()
  for (const [w, n] of sum) base.set(w, n / days.length)
  return base
}

export interface BurstOptions {
  /** 화제로 인정할 최소 오늘 기사 수. 1~2건짜리 잡음이 배율만 높게 나오는 것을 막는다. */
  minArticles?: number
  /** 한 화제가 후보를 독식하지 못하게 하는 상한. TOP3는 서로 다른 주제여야 한다. */
  maxPerTopic?: number
}

export interface BurstRanked<T> {
  article: T
  /** 평소 대비 배율. 1에 가까우면 매일 나오는 배경어. */
  score: number
  /** 이 기사를 대표하는 화제어. 로그·감사용. */
  topic: string
}

// 기사 하나의 급등 점수 = 제목 단어 중 가장 크게 튄 것의 배율.
// (오늘 df + 1) / (기준선 + 1) — 분모가 0인 새 화제를 나눗셈 오류 없이 최고점으로 올린다.
function burstScore(
  title: string,
  today: Map<string, number>,
  baseline: Map<string, number>,
  minArticles: number
): { score: number; topic: string } {
  let best = { score: 0, topic: '' }
  for (const w of titleKeywords(title)) {
    const n = today.get(w) ?? 0
    if (n < minArticles) continue
    const ratio = (n + 1) / ((baseline.get(w) ?? 0) + 1)
    if (ratio > best.score) best = { score: ratio, topic: w }
  }
  return best
}

// 후보를 급등 순으로 재배열한다. 정렬만 하고 아무것도 버리지 않는다.
// 걸러내기(중복·화제 상한·30건 자르기)는 호출부가 기존 로직으로 이어서 한다.
export function rankByBurst<T extends { title: string }>(
  articles: T[],
  baseline: Map<string, number>,
  opts: BurstOptions = {}
): BurstRanked<T>[] {
  const minArticles = opts.minArticles ?? 5
  const today = documentFrequency(articles.map(a => a.title))
  return articles
    .map(a => {
      const { score, topic } = burstScore(a.title, today, baseline, minArticles)
      return { article: a, score, topic }
    })
    .sort((x, y) => y.score - x.score)
}
