import { NextResponse } from 'next/server'
import { runDailyBriefing } from '@/lib/runBriefing'
import { sendDailyNewsletter } from '@/lib/sendNewsletter'
import { notifyFailure } from '@/lib/notifyAdmin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDailyBriefing()
    const newsletter = await sendDailyNewsletter().catch(() => ({ sent: 0, skipped: '발송 오류' }))
    return NextResponse.json({ success: true, ...result, newsletter })
  } catch (error) {
    await notifyFailure('브리핑 생성', String(error))
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
