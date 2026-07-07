import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { supabase } from '@/lib/supabase'
import { gradeDailyBriefing } from '@/lib/gradeBriefing'
import { notifyFailure } from '@/lib/notifyAdmin'

// 브리핑 자동 채점 (발행 경로와 완전 분리 — 여기가 죽어도 발행은 안 막힘)
// - GET  : 크론용 (Bearer CRON_SECRET). 접수 응답 먼저, 채점은 백그라운드 (cron-briefing과 같은 패턴)
//          ?recent=7 붙이면 채점 없이 최근 N일 점수 조회
// - POST : 수동 실행·확인용. 동기로 돌고 결과 JSON을 그대로 반환
//          body(선택): { "date": "YYYY-MM-DD", "regrade": true }

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  // 조회 모드: 최근 N일 점수 기록 (운영 리뷰용)
  const recent = searchParams.get('recent')
  if (recent) {
    const days = Math.max(1, Math.min(60, Number(recent) || 7))
    const { data, error } = await supabase
      .from('briefing_scores')
      .select('date, rubric_version, total, scores, format_pass, disqualified, issue_note')
      .order('date', { ascending: false })
      .limit(days)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, scores: data })
  }

  // 채점 모드: 접수 응답 먼저 보내고 백그라운드에서 채점 (cron-job.org 30초 timeout 대비)
  waitUntil(
    gradeDailyBriefing().catch(error => notifyFailure('브리핑 자동 채점', String(error)))
  )
  return NextResponse.json({ accepted: true, message: '오늘 브리핑 채점 시작됨 (백그라운드, 이미 채점된 날은 건너뜀)' })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await gradeDailyBriefing({
      date: typeof body?.date === 'string' ? body.date : undefined,
      regrade: body?.regrade === true,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = (error as Error).message
    const status = message.includes('브리핑이 없습니다') ? 400 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
