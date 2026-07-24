// ── 후보 풀 관문 (2026-07-24) ──────────────────────────────────────────────
// AI(헤드라인·TOP3·분야별 선정)에게 기사 제목을 넘기기 "직전"에 한 번 거른다.
//
// 왜 여기인가:
//   - 수집 단계에서 버리면(ⓐ) DB에서 영영 사라져 뉴스 목록·복구가 불가능하다.
//   - TOP3 검문(enforceTop3Rules)에서만 막으면(ⓑ) 분야별 선정엔 안 걸린다.
//   → 그 중간(ⓒ): DB는 온전히 두고, "AI 눈앞에 놓이는 후보"만 정제한다.
//
// 무엇을 거르나(3종):
//   1) 신선도(isStale)  — 며칠 지난 기사. 2026-07-23 사고(7/16 기사 재혼입)가 이것.
//   2) 연성(isLifestyle) — 활용법·꿀팁 등 생활정보. 2026-07-22 사고(건조기 시트)가 이것.
//   3) 의견글(isOpinion) — [○○칼럼]·[일문일답] 등. 오늘(7/24) 후보 풀에서 발견.
//
// 설계 원칙(전부 "확실할 때만 버린다"):
//   - 신선도: 발행일을 모르면(null) 통과시킨다. 모르는 걸 오래됐다고 단정하지 않는다.
//   - 연성:   제목에 경제 단어가 하나라도 있으면 무조건 통과시킨다(오탐 방지 우선).
//   - 의견글: 대괄호 태그로 명시된 경우만 건드린다.
//   이 관문은 "의심스러우면 살린다". 진짜 경제 기사를 잘못 버리는 것(오탐)이
//   비경제 기사 하나를 흘리는 것(미탐)보다 훨씬 나쁘다.

export interface GateArticle {
  id: string
  title: string
  published_at: string | null
}

export interface GateOptions {
  staleDays: number   // 발행 후 이 일수를 넘기면 오래된 것으로 봄
  now?: number        // 기준 시각(ms). 테스트·시뮬레이션에서 과거 시점 주입용. 기본=현재
}

// 경제 기사임을 강하게 시사하는 단어. 하나라도 있으면 연성 필터를 면제한다.
// (연성 어미가 우연히 들어간 진짜 경제 기사를 지키기 위한 화이트리스트)
const ECON_WHITELIST = [
  '경제', '금리', '환율', '물가', '주가', '증시', '코스피', '코스닥', '부동산', '집값',
  '전세', '월세', '대출', '예금', '적금', '투자', '펀드', '채권', '수출', '수입', '무역',
  '관세', '고용', '취업', '실업', '임금', '연봉', '세금', '세제', '예산', '재정', '정책',
  '기업', '실적', '영업이익', '매출', '주식', '상장', '반도체', '배터리', '자동차',
  '요금', '가격', '인플레', '경기', '성장률', 'GDP', '한은', '한국은행', '기준금리',
  '보험', '카드', '은행', '증권', '연금', '가계부채', '소비', '내수', '유가', '달러', '원화',
  // 2026-07-24 P3 시뮬레이션에서 잡힌 오탐 방어 보강:
  // - 게임주·게임사·게임업계: 주식·산업 기사가 신호 '게임'에 걸리던 것(신호에서도 '게임' 제거)
  // - 출시·신제품·수주·증설: 기업 신제품 기사가 '세탁'·'반려' 등 신호에 걸리던 것 보호
  '게임주', '게임사', '게임업계', '출시', '신제품', '수주', '증설',
]

// 생활정보·연예·패션 성격을 드러내는 신호. 제목에 있으면 (경제 단어가 없을 때) 제외.
// ⚠️ '게임'·'뷰티'는 신호에서 뺐다(2026-07-24). 산업 이름이라
//    "게임주·게임사·K뷰티" 같은 경제 기사를 오탐으로 걸렀다(P3 시뮬레이션 실증).
//    순수 생활정보는 '활용법·다이어트·먹방' 등 표현으로 이미 잡힌다.
const LIFESTYLE_SIGNALS = [
  '활용법', '꿀팁', '레시피', '만드는 법', '만드는법', '손질법', '보관법', '세탁',
  '수납', '정리법', '청소법', '코디', '스타일링', '데일리룩', '패션템',
  '다이어트', '운동법', '홈트', '집들이', '인테리어 팁', '캠핑',
  '반려동물', '반려견', '반려묘', '애견', '애묘', '집사',  // '반려' 단독은 "영장 반려" 등 오매칭 → 동물 맥락만
  '맛집', '먹방', '레저', '여행지 추천', '웹툰', '드라마', '연예', '아이돌',
]

// 의견글·칼럼임을 드러내는 대괄호 태그. 뉴스가 아니라 필자 논평.
const OPINION_TAG = /\[[^\]]*(칼럼|사설|기고|오피니언|데스크|시론|논평|광장|일문일답|우분투|note|기자수첩|현장에서)[^\]]*\]/i

// ── 개별 판정 ────────────────────────────────────────────────────────────────

// 발행일을 모르면(null) 오래됐다고 단정하지 않는다 → 통과(false).
export function isStale(publishedAt: string | null, staleDays: number, now: number): boolean {
  if (!publishedAt) return false
  const t = new Date(publishedAt).getTime()
  if (isNaN(t)) return false
  const ageMs = now - t
  return ageMs > staleDays * 24 * 60 * 60 * 1000
}

// 경제 단어가 하나라도 있으면 무조건 통과. 없을 때만 연성 신호를 본다.
export function isLifestyle(title: string): boolean {
  if (ECON_WHITELIST.some(k => title.includes(k))) return false
  return LIFESTYLE_SIGNALS.some(k => title.includes(k))
}

export function isOpinion(title: string): boolean {
  return OPINION_TAG.test(title)
}

// ── 통합 관문 ────────────────────────────────────────────────────────────────

export type DropReason = 'stale' | 'lifestyle' | 'opinion'

export interface GateResult {
  kept: GateArticle[]
  dropped: { article: GateArticle; reason: DropReason }[]
}

// 후보 배열을 받아 통과분(kept)과 걸러진 것+사유(dropped)를 함께 돌려준다.
// dropped를 함께 반환하는 이유: 배포 전(P3) 사람이 "왜 걸렸는지"를 눈으로 감사하기 위함.
export function filterCandidatePool(articles: GateArticle[], opts: GateOptions): GateResult {
  const now = opts.now ?? Date.now()
  const kept: GateArticle[] = []
  const dropped: { article: GateArticle; reason: DropReason }[] = []

  for (const a of articles) {
    if (isStale(a.published_at, opts.staleDays, now)) {
      dropped.push({ article: a, reason: 'stale' })
    } else if (isOpinion(a.title)) {
      dropped.push({ article: a, reason: 'opinion' })
    } else if (isLifestyle(a.title)) {
      dropped.push({ article: a, reason: 'lifestyle' })
    } else {
      kept.push(a)
    }
  }

  return { kept, dropped }
}
