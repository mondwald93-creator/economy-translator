import { NextResponse } from 'next/server'
import { collectAndSaveNews } from '@/lib/naverNews'
import { runDailyBriefing } from '@/lib/runBriefing'
import { sendDailyNewsletter } from '@/lib/sendNewsletter'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const collectResult = await collectAndSaveNews()
    const briefingResult = await runDailyBriefing()
    const newsletter = await sendDailyNewsletter().catch(() => ({ sent: 0, skipped: '발송 오류' }))

    return NextResponse.json({
      success: true,
      saved: collectResult.saved,
      collectErrors: collectResult.errors,
      ...briefingResult,
      newsletter,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
