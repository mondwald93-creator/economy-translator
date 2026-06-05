import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'

export async function GET() {
  const results: Record<string, string> = {}

  // Supabase 연결 확인
  try {
    const { error } = await supabase.from('briefings').select('id').limit(1)
    results.supabase = error ? `오류: ${error.message}` : '연결 성공'
  } catch {
    results.supabase = '연결 실패'
  }

  // OpenAI 연결 확인
  try {
    await openai.models.list()
    results.openai = '연결 성공'
  } catch {
    results.openai = '연결 실패'
  }

  return NextResponse.json({ status: 'ok', connections: results })
}
