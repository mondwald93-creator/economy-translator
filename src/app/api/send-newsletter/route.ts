import { NextResponse } from 'next/server'
import { sendDailyNewsletter } from '@/lib/sendNewsletter'

// 수동 발송 또는 cron에서 호출
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendDailyNewsletter()
  return NextResponse.json({ success: true, ...result })
}
