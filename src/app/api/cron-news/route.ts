import { NextResponse } from 'next/server'
import { notifyFailure } from '@/lib/notifyAdmin'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || 'https://economy-translator.vercel.app'

  try {
    const collectRes = await fetch(`${baseUrl}/api/collect-news`, { method: 'POST' })
    const collectData = await collectRes.json()

    if (!collectRes.ok) {
      await notifyFailure('오후 뉴스 수집', JSON.stringify(collectData))
      return NextResponse.json({ success: false, collect: collectData }, { status: 500 })
    }

    return NextResponse.json({ success: true, collect: collectData })
  } catch (error) {
    await notifyFailure('오후 뉴스 수집', String(error))
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
