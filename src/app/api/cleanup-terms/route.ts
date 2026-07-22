import { NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

type Term = { id: string; term: string; category: string; explanation: string; example: string | null }

const VALID_CATEGORIES = ['금리', '환율', '주식', '부동산', '무역', '경기', '소비', '통화', '기타']

export async function POST() {
  // 1. 전체 용어 가져오기
  const { data: allTerms, error: fetchError } = await supabase
    .from('terms')
    .select('id, term, category, explanation, example')
    .order('term')

  if (fetchError || !allTerms) {
    return NextResponse.json({ success: false, error: fetchError?.message }, { status: 500 })
  }

  // 2. 중복 찾기 (공백 제거 후 동일한 것, 또는 완전히 동일한 것)
  const seen = new Map<string, Term>()
  const duplicateIds: string[] = []

  for (const term of allTerms) {
    const normalized = term.term.replace(/\s+/g, '').toLowerCase()
    if (seen.has(normalized)) {
      // 공백 있는 버전을 삭제 (공백 없는 버전 유지)
      const existing = seen.get(normalized)!
      const termHasSpace = term.term.includes(' ')
      const existingHasSpace = existing.term.includes(' ')
      if (termHasSpace && !existingHasSpace) {
        duplicateIds.push(term.id)
      } else if (!termHasSpace && existingHasSpace) {
        duplicateIds.push(existing.id)
        seen.set(normalized, term)
      } else {
        // 둘 다 공백 없거나 둘 다 공백 있으면 나중 것 삭제
        duplicateIds.push(term.id)
      }
    } else {
      seen.set(normalized, term)
    }
  }

  // 3. 중복 삭제
  let deletedCount = 0
  if (duplicateIds.length > 0) {
    const { error: delError } = await supabase.from('terms').delete().in('id', duplicateIds)
    if (!delError) deletedCount = duplicateIds.length
  }

  // 4. 기타 카테고리 용어 재분류 (GPT)
  const etcTerms = allTerms
    .filter(t => t.category === '기타' && !duplicateIds.includes(t.id))

  let recategorized = 0

  if (etcTerms.length > 0) {
    const termList = etcTerms.map(t => `"${t.term}"`).join(', ')

    const prompt = `아래 경제용어들을 가장 적합한 카테고리로 분류해주세요.

카테고리 목록: 금리, 환율, 주식, 부동산, 무역, 경기, 소비, 통화, 기타

카테고리 기준:
- 금리: 금리, 채권, 대출, 신용, 이자, 유동성, 통화정책 관련
- 환율: 환율, 외환, 달러, 환전, 국제통화 관련
- 주식: 주식, 펀드, ETF, 투자상품, 자산운용, 증권, 파생상품 관련
- 부동산: 부동산, 아파트, 임대, 토지, 재산세 관련
- 무역: 수출, 수입, 무역, 관세, 글로벌경제, 국제무역 관련
- 경기: 경제성장, GDP, 경기순환, 고용, 산업, 거시경제, 금융위기 관련
- 소비: 소비, 지출, 세금(소득세), 생활비, 가계경제 관련
- 통화: 통화량, 화폐, 통화스와프, 중앙은행 발행 관련
- 기타: 위의 어느 카테고리에도 명확히 속하지 않는 것

용어 목록:
${termList}

JSON 형식으로만 응답:
{
  "results": [
    { "term": "용어명", "category": "카테고리" }
  ]
}`

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    })

    const { results } = JSON.parse(res.choices[0].message.content ?? '{"results":[]}') as {
      results: { term: string; category: string }[]
    }

    // 카테고리 변경이 필요한 것만 업데이트
    const toUpdate = results.filter(r =>
      VALID_CATEGORIES.includes(r.category) && r.category !== '기타'
    )

    for (const item of toUpdate) {
      await supabase
        .from('terms')
        .update({ category: item.category })
        .eq('term', item.term)
        .eq('category', '기타')
      recategorized++
    }
  }

  // 5. 최종 카운트
  const { count } = await supabase.from('terms').select('*', { count: 'exact', head: true })

  return NextResponse.json({
    success: true,
    deleted_duplicates: deletedCount,
    recategorized,
    total: count,
  })
}
