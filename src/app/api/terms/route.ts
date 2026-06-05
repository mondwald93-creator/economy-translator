import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const category = searchParams.get('category')?.trim()

  let query = supabase
    .from('terms')
    .select('id, term, category, explanation, example')
    .order('term', { ascending: true })
    .limit(200)

  if (q) {
    query = query.or(`term.ilike.%${q}%,explanation.ilike.%${q}%`)
  }

  if (category && category !== '전체') {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, terms: data ?? [] })
}
