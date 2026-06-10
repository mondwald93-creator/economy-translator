import { Resend } from 'resend'

// 자동화(뉴스 수집·브리핑 생성)가 실패하면 운영자에게 이메일로 알림
// RESEND_API_KEY 또는 ALERT_EMAIL이 없으면 서버 로그만 남기고 조용히 넘어감
export async function notifyFailure(title: string, detail: string) {
  const timeKST = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  console.error(`[자동화 실패] ${title} (${timeKST}): ${detail}`)

  const key = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL
  if (!key || !to) return

  try {
    const resend = new Resend(key)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
      to,
      subject: `🚨 경제번역기 자동화 실패 — ${title}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px">
          <h2 style="color:#DC2626">🚨 자동화 실패: ${title}</h2>
          <p><strong>발생 시각:</strong> ${timeKST} (한국시간)</p>
          <p><strong>오류 내용:</strong></p>
          <pre style="background:#F3F4F6;padding:12px;border-radius:8px;white-space:pre-wrap">${detail}</pre>
          <p style="color:#6B7280;font-size:13px">
            수동 복구: 터미널에서 아래 명령 실행<br/>
            <code>curl -X POST https://economy-translator.vercel.app/api/collect-news</code><br/>
            <code>curl -X POST https://economy-translator.vercel.app/api/generate-briefing</code>
          </p>
        </div>
      `,
    })
  } catch (e) {
    console.error('[알림 메일 발송 실패]', e)
  }
}
