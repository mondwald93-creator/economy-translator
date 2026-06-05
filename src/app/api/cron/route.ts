import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

  try {
    // 1단계: 뉴스 수집
    const collectRes = await fetch(`${baseUrl}/api/collect-news`, { method: 'POST' })
    const collectData = await collectRes.json()

    // 2단계: 브리핑 생성
    const briefingRes = await fetch(`${baseUrl}/api/generate-briefing`, { method: 'POST' })
    const briefingData = await briefingRes.json()

    return NextResponse.json({
      success: true,
      collect: collectData,
      briefing: briefingData,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
