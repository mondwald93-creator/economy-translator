// 같은 사건을 여러 언론사가 제목만 바꿔 쓴 "거의 같은 중복" 기사를 잡기 위한 유틸.
// 제목 앞 20자 비교만으로는 "한국 상장사…" vs "韓 상장사…" vs "국내 상장사…"를
// 서로 다른 기사로 흘려보내는 구멍이 있어, 핵심 단어 겹침 정도로 같은 사건을 판별한다.

// 제목을 핵심 단어 집합으로 변환 (한자 약칭 정규화 + 기호·조사성 잡음 제거)
export function titleTokenSet(title: string): Set<string> {
  const norm = title
    .replace(/韓/g, '한국')
    .replace(/美/g, '미국')
    .replace(/中/g, '중국')
    .replace(/日/g, '일본')
    .replace(/[^가-힣a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
  return new Set(
    norm
      .split(' ')
      .map(w => w.trim())
      .filter(w => w.length >= 2)
  )
}

// 겹침 계수(작은 집합 기준): 같은 사건이면 짧은 제목의 핵심 단어 대부분이 긴 제목에도 들어 있다.
export function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  if (small.size === 0) return 0
  let shared = 0
  for (const w of small) if (big.has(w)) shared++
  return shared / small.size
}

// 이미 채택한 제목들의 단어 집합 중 하나라도 임계값 이상 겹치면 같은 사건으로 본다.
export function isNearDuplicate(
  tokens: Set<string>,
  acceptedTokenSets: Set<string>[],
  threshold = 0.5
): boolean {
  if (tokens.size === 0) return false
  return acceptedTokenSets.some(s => overlapCoefficient(s, tokens) >= threshold)
}
