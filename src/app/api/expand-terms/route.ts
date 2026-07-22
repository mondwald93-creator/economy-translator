import { NextResponse } from 'next/server'
import { openai, SYSTEM_PROMPT } from '@/lib/openai'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

type Term = { term: string; category: string; explanation: string; example: string }

const BATCH_TOPICS = [
  '금리, 채권, 중앙은행, 통화정책, 금융시장 관련 심화 용어',
  '주식, 펀드, ETF, 투자, 자산관리 관련 용어',
  '부동산, 대출, 가계부채, 생활경제, 소비 관련 용어',
  '무역, 환율, 글로벌경제, 경기지표, 국제금융 관련 용어',
]

async function generateBatch(existingNames: string[], batchIndex: number): Promise<Term[]> {
  const prompt = `경제를 전혀 모르는 초보자를 위한 경제용어 40개를 JSON으로 만들어주세요.
주제 영역: ${BATCH_TOPICS[batchIndex]}

아래 용어는 이미 있으니 제외해주세요:
${existingNames.join(', ')}

카테고리는 다음 중 하나만 사용: 금리, 환율, 주식, 부동산, 무역, 경기, 소비, 통화, 기타

다음 JSON 형식으로만 응답하세요:
{
  "terms": [
    {
      "term": "용어명",
      "category": "카테고리",
      "explanation": "초등학생도 이해할 수 있는 2~3문장 쉬운 설명",
      "example": "예를 들어 ... 와 같아요."
    }
  ]
}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const parsed = JSON.parse(res.choices[0].message.content ?? '{"terms":[]}') as { terms: Term[] }
  return parsed.terms ?? []
}

export async function POST() {
  const { data: existing } = await supabase.from('terms').select('term')
  const existingNames = (existing ?? []).map((t: { term: string }) => t.term)

  const allNew: Term[] = []

  for (let i = 0; i < 4; i++) {
    const usedNames = [...existingNames, ...allNew.map(t => t.term)]
    const batch = await generateBatch(usedNames, i)
    allNew.push(...batch)
    console.log(`배치 ${i + 1}/4 완료 — ${batch.length}개 생성`)
  }

  const deduped = Array.from(new Map(allNew.map(t => [t.term, t])).values())
  const { error } = await supabase.from('terms').upsert(deduped, { onConflict: 'term' })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const { count } = await supabase.from('terms').select('*', { count: 'exact', head: true })

  return NextResponse.json({ success: true, added: allNew.length, total: count })
}
