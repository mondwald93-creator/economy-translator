import { NextResponse } from 'next/server'
import { collectAndSaveNews } from '@/lib/naverNews'
import { runDailyBriefing } from '@/lib/runBriefing'
import { sendDailyNewsletter } from '@/lib/sendNewsletter'
import { notifyFailure } from '@/lib/notifyAdmin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const collectResult = await collectAndSaveNews()
    const briefingResult = await runDailyBriefing()
    // 이번 실행이 실제로 브리핑을 새로 만들었을 때만 뉴스레터 발송 (하루 한 번 보장)
    const newsletter = briefingResult.generated
      ? await sendDailyNewsletter().catch(() => ({ sent: 0, skipped: '발송 오류' }))
      : { sent: 0, skipped: '이미 발행돼 재발송 안 함' }

    return NextResponse.json({
      success: true,
      saved: collectResult.saved,
      collectErrors: collectResult.errors,
      ...briefingResult,
      newsletter,
    })
  } catch (error) {
    await notifyFailure('오전 9시 뉴스 수집·브리핑 생성', String(error))
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
