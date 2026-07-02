import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { runDailyBriefing } from '@/lib/runBriefing'
import { sendDailyNewsletter } from '@/lib/sendNewsletter'
import { notifyFailure } from '@/lib/notifyAdmin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // cron-job.org는 30초만 기다리고 timeout을 실패로 기록 → 연속 25회 실패 시 크론잡 자동 비활성화.
  // 그래서 "접수 완료"를 먼저 응답하고 실제 작업은 백그라운드로 이어간다 (vercel.json maxDuration 300초 안에서 완주).
  waitUntil(
    (async () => {
      try {
        const briefingResult = await runDailyBriefing()
        // 이번 실행이 실제로 브리핑을 새로 만들었을 때만 뉴스레터 발송 (하루 한 번 보장)
        if (briefingResult.generated) {
          await sendDailyNewsletter().catch(() => ({ sent: 0, skipped: '발송 오류' }))
        }
      } catch (error) {
        await notifyFailure('브리핑 생성', String(error))
      }
    })()
  )

  return NextResponse.json({ accepted: true, message: '브리핑 생성 시작됨 (백그라운드 진행, 완료까지 약 3분)' })
}
