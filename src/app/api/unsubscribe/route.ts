import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!email) {
    return new NextResponse('이메일 주소가 없어요.', { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await supabase.from('subscribers').update({ is_active: false }).eq('email', email)

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>구독 취소 완료</title>
  <style>
    body { margin: 0; padding: 0; background: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .box { background: #fff; border-radius: 16px; padding: 48px 40px; text-align: center; max-width: 440px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    h1 { margin: 0 0 12px; font-size: 22px; color: #111827; }
    p { margin: 0 0 24px; color: #6B7280; font-size: 15px; line-height: 1.7; }
    a { display: inline-block; background: #22C55E; color: #fff; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 10px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="box">
    <div style="font-size:40px;margin-bottom:16px;">👋</div>
    <h1>구독이 취소됐어요</h1>
    <p>${email} 주소로의 이메일 발송을 중단할게요.<br>언제든 다시 구독하실 수 있어요.</p>
    <a href="https://economy-translator.vercel.app">경제번역기 보러가기</a>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
