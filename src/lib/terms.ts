export interface Term {
  id: string
  term: string
  category: string
  explanation: string
  example: string | null
}

export const CATEGORIES = ['전체', '금리', '환율', '주식', '부동산', '무역', '경기', '소비', '통화', '기타']

export const CATEGORY_COLORS: Record<string, string> = {
  '금리':   'bg-blue-50 text-blue-700',
  '환율':   'bg-green-50 text-green-700',
  '주식':   'bg-purple-50 text-purple-700',
  '부동산': 'bg-orange-50 text-orange-700',
  '무역':   'bg-cyan-50 text-cyan-700',
  '경기':   'bg-red-50 text-red-700',
  '소비':   'bg-pink-50 text-pink-700',
  '통화':   'bg-yellow-50 text-yellow-700',
  '기타':   'bg-gray-50 text-gray-600',
}

/**
 * 용어명 → 주소 이름표.
 * 괄호는 하이픈으로 펴고(기업공개(IPO) → 기업공개-IPO), 공백도 하이픈, URL 예약문자는 제거.
 * 2026-07-26 기준 용어 252개 전부 충돌 없음(검사 완료). 새 용어 추가 시 충돌 나면 여기 규칙을 손볼 것.
 */
export function slugifyTerm(term: string): string {
  return term
    .trim()
    .replace(/\(/g, '-')
    .replace(/\)/g, '')
    .replace(/[/\\?#%&+]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}
