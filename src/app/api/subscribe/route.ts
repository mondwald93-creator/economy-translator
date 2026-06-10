import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildWelcomeHtml } from '@/lib/emailTemplate'

export async function POST(request: Request) {
  let email: string
  try {
    const body = await request.json()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: '올바른 이메일 주소를 입력해주세요.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: existing } = await supabase
    .from('subscribers')
    .select('id, is_active')
    .eq('email', email)
    .single()

  if (existing?.is_active) {
    return NextResponse.json({ message: '이미 구독 중인 이메일이에요 😊' })
  }

  if (existing && !existing.is_active) {
    const { error } = await supabase
      .from('subscribers')
      .update({ is_active: true, subscribed_at: new Date().toISOString() })
      .eq('email', email)
    if (error) return NextResponse.json({ error: '구독 신청에 실패했어요. 다시 시도해주세요.' }, { status: 500 })
  } else {
    const { error } = await supabase.from('subscribers').insert({ email })
    if (error) return NextResponse.json({ error: '구독 신청에 실패했어요. 다시 시도해주세요.' }, { status: 500 })
  }

  // 환영 이메일 발송 (API 키 있을 때만)
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const resend = new Resend(resendKey)
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
    await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: '📰 경제번역기 구독이 완료됐어요!',
      html: buildWelcomeHtml(email),
    }).catch(() => {})
  }

  return NextResponse.json({ message: '구독 완료! 내일 아침 9시부터 브리핑을 이메일로 받아보세요 🎉' })
}
