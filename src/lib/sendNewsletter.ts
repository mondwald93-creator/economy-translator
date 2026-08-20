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

  const batchEmails = subscribers.map(sub => {
    const q = encodeURIComponent(sub.email)
    // 사람이 누르는 링크 = 안내 화면이 있는 페이지 / 지메일이 자동으로 POST하는 주소 = API 라우트
    const unsubscribeUrl = `https://economytranslator.com/unsubscribe?email=${q}`
    const unsubscribeApi = `https://economytranslator.com/api/unsubscribe?email=${q}`
    return {
      from: fromAddress,
      to: sub.email,
      subject: `📰 ${dateLabel} 오늘의 경제 브리핑`,
      // 구독 해지를 메일 헤더에도 넣는다 (2026-08-20 추가).
      // 왜: 본문 링크만으로는 부족하다. 지메일·야후가 2024년부터 대량 발송자에게 이 헤더를 요구하고,
      //     없으면 스팸 점수가 올라간다. 첫 발송(8/20 환영 메일)이 스팸함으로 갔을 때 넣었다
      //     (그때 SPF·DKIM·DMARC는 전부 PASS였고, 남은 개선점이 이것과 도메인 평판뿐이었다).
      // One-Click = 지메일이 메일 위에 '구독 취소' 버튼을 직접 띄우고, 누르면 저 주소로 POST를 보낸다.
      //     unsubscribe 페이지가 GET만 받으므로 POST도 받게 열어두었다(route.ts 참조).
      headers: {
        'List-Unsubscribe': `<${unsubscribeApi}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      html: buildNewsletterHtml({
        date: dateLabel,
        headline: briefing.headline,
        summary: briefing.summary ?? '',
        dailyTerm,
        unsubscribeUrl,
      }),
    }
  })

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
