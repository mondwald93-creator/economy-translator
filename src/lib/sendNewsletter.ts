import { Resend } from 'resend'
import { supabaseAdmin as supabase } from './supabaseAdmin'
import { buildNewsletterHtml } from './emailTemplate'

export async function sendDailyNewsletter(): Promise<{ sent: number; skipped: string }> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return { sent: 0, skipped: 'RESEND_API_KEY 없음' }

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: briefing } = await supabase
    .from('briefings')
    .select('headline, summary, daily_term')
    .eq('date', today)
    .single()

  if (!briefing?.headline) return { sent: 0, skipped: '오늘 브리핑 없음' }

  const { data: subscribers } = await supabase
    .from('subscribers')
    .select('email')
    .eq('is_active', true)

  if (!subscribers || subscribers.length === 0) return { sent: 0, skipped: '활성 구독자 없음' }

  let dailyTerm: { term: string; explanation: string } | null = null
  try {
    dailyTerm = typeof briefing.daily_term === 'string'
      ? JSON.parse(briefing.daily_term)
      : briefing.daily_term
  } catch { /* ignore */ }

  const dateLabel = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })

  const resend = new Resend(resendKey)
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  const batchEmails = subscribers.map(sub => ({
    from: fromAddress,
    to: sub.email,
    subject: `📰 ${dateLabel} 오늘의 경제 브리핑`,
    html: buildNewsletterHtml({
      date: dateLabel,
      headline: briefing.headline,
      summary: briefing.summary ?? '',
      dailyTerm,
      unsubscribeUrl: `https://economy-translator.vercel.app/unsubscribe?email=${encodeURIComponent(sub.email)}`,
    }),
  }))

  // Resend는 한 번에 최대 100건 배치 발송 가능
  const chunks = []
  for (let i = 0; i < batchEmails.length; i += 100) {
    chunks.push(batchEmails.slice(i, i + 100))
  }

  let totalSent = 0
  for (const chunk of chunks) {
    const { data, error } = await resend.batch.send(chunk)
    if (!error && data) totalSent += data.length ?? chunk.length
  }

  return { sent: totalSent, skipped: '' }
}
