import { supabaseAdmin as supabase } from './supabaseAdmin'

// 브리핑 후보 풀 = "AI가 헤드라인·TOP3·분야별 기사를 고를 때 보는 기사 목록".
// 발행(runBriefing)과 채점 대조 자료(gradeBriefing)가 **반드시 이 함수 하나**를 쓴다.
// 둘이 어긋나면 심사위원이 브리핑이 못 본 기사로 대조하게 된다(2026-07-09 전항목 0점·실격 오판 사고).
//
// 시간 창 (2026-08-17 확정, 사용자 결정 "어제 오후 것부터 보는 게 맞다"):
//   예전 = `date = 그날` 하나. 랭킹 페이지(발행 시각 없음 → 전부 '오늘'로 잡힘)를 8/14에 뺀 뒤
//          아침 9:07 풀이 오늘 0시~9시 기사만 남아 450건 → 130건으로 줄었다.
//   지금 = 발행 시각(cutoff) 기준 **지난 24시간 안에 발행된 기사**(published_at)
//          + 발행 시각을 모르는 기사(헤드라인 10건 등, published_at null·date=그날).
//          어제 아침 브리핑 이후 나온 기사가 전부 들어오고, 어제 브리핑과는 겹치지 않는다.
// 중복: 같은 URL이 여러 행 있을 수 있어(6월~8/17 중복 저장 사고의 잔재) URL 기준으로 한 행만 남긴다.
export const POOL_WINDOW_HOURS = 24

export interface PoolArticle {
  id: string
  title: string
  summary: string | null
  published_at: string | null
  original_url: string | null
  created_at: string
}

export async function fetchBriefingPool(opts: { date: string; cutoff: Date }): Promise<PoolArticle[]> {
  const { date, cutoff } = opts
  const windowStart = new Date(cutoff.getTime() - POOL_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const cutoffIso = cutoff.toISOString()

  // PostgREST는 한 번에 최대 1,000행만 준다(서버 상한, 클라이언트 limit으로 못 넘김).
  // 24시간 창은 옛 중복 행 때문에 1,000행을 넘을 수 있어 페이지를 넘기며 전부 받는다.
  const PAGE = 1000
  const rows: PoolArticle[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('news_articles')
      .select('id, title, summary, published_at, original_url, created_at')
      // (지난 24시간 안 발행) OR (발행 시각 모름 AND 그날 수집분)
      .or(`published_at.gte.${windowStart},and(published_at.is.null,date.eq.${date})`)
      // 발행 시각 이후에 들어온 기사는 제외 — 채점 대조 자료가 발행 때 풀과 같아야 함
      .lte('created_at', cutoffIso)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // 같은 시각 행이 페이지 경계에서 빠지거나 겹치지 않게
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as PoolArticle[]
    rows.push(...page)
    if (page.length < PAGE) break
  }

  const seen = new Set<string>()
  const out: PoolArticle[] = []
  for (const row of rows) {
    const key = row.original_url || row.title
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}
