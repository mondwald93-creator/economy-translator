/**
 * 「오늘의 한 문장」을 고르는 규칙 — **여기 한 곳에서만 정한다.** (2026-08-21 신설)
 *
 * 홈 화면(page.tsx)과 화면 카드 그림(/api/card/sentence/<날짜>)이 같은 문장을 써야 한다.
 * 둘이 어긋나면 그림에 적힌 문장과 「텍스트 복사」로 복사되는 문장이 달라진다.
 *
 * 왜 함수로 뺐나: 8/11에 규칙이 두 곳에 복사되면서 정규식이 미세하게 갈렸다.
 *   page.tsx  [^。.!?!?]   ← 반각만 (`!?`가 중복이라 사실상 [^。.!?])
 *   옛 홈 og  [^。.!?！？] ← 전각 느낌표·물음표까지
 * 눈에 안 띄는 차이라 아무도 못 봤다. 넓은 쪽(전각 포함)으로 합친다.
 */

/** share_card가 있으면 그것, 없으면 요약의 첫 문장. */
export function pickTodaySentence(shareCard: unknown, summary: unknown): string {
  const card = typeof shareCard === 'string' ? shareCard.trim() : ''
  if (card) return card

  if (typeof summary !== 'string') return ''
  const para = summary.split(/\n+/).find(p => p.trim().length > 10) ?? ''
  return para.match(/[^。.!?！？]*[。.!?！？]+/)?.[0]?.trim() ?? para.slice(0, 60)
}

/** '2026-08-21' → '2026년 8월 21일' */
export function sentenceDateLabel(date: string): string {
  const [y, m, d] = date.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}
