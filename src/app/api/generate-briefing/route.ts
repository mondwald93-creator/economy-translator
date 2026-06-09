import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { runDailyBriefing } from '@/lib/runBriefing'

export async function POST() {
  try {
    const result = await runDailyBriefing()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = (error as Error).message
    const status = message.includes('뉴스가 없습니다') ? 400 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function GET() {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('briefings')
    .select('*')
    .eq('date', today)
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: '오늘 브리핑이 아직 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({ success: true, briefing: data })
}
