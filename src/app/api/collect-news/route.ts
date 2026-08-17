import { NextResponse } from 'next/server'
import { collectAndSaveNews, getTodayArticles } from '@/lib/naverNews'

export async function POST() {
  try {
    const result = await collectAndSaveNews()
    const articles = await getTodayArticles()

    return NextResponse.json({
      success: true,
      saved: result.saved,
      skippedExisting: result.skippedExisting, // 이미 있어 건너뛴 URL 수 (2026-08-17 중복 저장 수정의 관측값)
      totalToday: articles.length,
      errors: result.errors,
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const articles = await getTodayArticles()
    return NextResponse.json({ success: true, articles })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}
