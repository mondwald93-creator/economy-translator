import { NextResponse } from 'next/server'
import { openai, SYSTEM_PROMPT } from '@/lib/openai'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

export async function POST() {
  const { count } = await supabase.from('terms').select('*', { count: 'exact', head: true })

  if (count && count >= 30) {
    return NextResponse.json({ success: false, error: `이미 초기 데이터가 있어요. (현재 ${count}개)` })
  }

  const prompt = `경제를 전혀 모르는 초보자를 위한 경제용어 40개를 JSON으로 만들어주세요.

카테고리는 다음 중 하나만 사용: 금리, 환율, 주식, 부동산, 무역, 경기, 소비, 통화

다음 JSON 형식으로만 응답하세요:
{
  "terms": [
    {
      "term": "기준금리",
      "category": "금리",
      "explanation": "초등학생도 이해할 수 있는 2~3문장 쉬운 설명",
      "example": "예를 들어, 기준금리가 오르면 은행 대출 이자도 함께 올라요."
    }
  ]
}

반드시 포함할 용어: 기준금리, 인플레이션, 환율, 코스피, GDP, 무역수지, 경상수지, 양적완화, 통화량, 소비자물가지수, 채권, 주식, 가계부채, 디플레이션, 스태그플레이션, 내수, 수출, 외환보유고, 금리인하, 경기침체, 경기부양, 기업공개(IPO), 시가총액, 배당금, 환차익, 국채, 회사채, 레버리지, 부채비율, 유동성, 경기선행지수, 재정적자, 국가부채, 물가안정목표제, 통화스와프, 무역적자, 공급망, 금융위기, 구매력, 잠재성장률`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  })

  const { terms } = JSON.parse(res.choices[0].message.content ?? '{"terms":[]}') as {
    terms: { term: string; category: string; explanation: string; example: string }[]
  }

  const { error } = await supabase.from('terms').upsert(terms, { onConflict: 'term' })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, inserted: terms.length })
}
