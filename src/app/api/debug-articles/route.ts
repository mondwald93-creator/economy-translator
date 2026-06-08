import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('news_articles')
    .select('id, title, source, created_at')
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(5)

  return NextResponse.json({ today, count: data?.length ?? 0, error: error?.message ?? null, sample: data?.slice(0,2) ?? [] })
}
