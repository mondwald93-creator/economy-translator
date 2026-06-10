interface BriefingEmailData {
  date: string
  headline: string
  summary: string
  dailyTerm?: { term: string; explanation: string } | null
  unsubscribeUrl: string
}

export function buildNewsletterHtml(data: BriefingEmailData): string {
  const { date, headline, summary, dailyTerm, unsubscribeUrl } = data

  const summaryLines = summary
    .split(/\n+/)
    .filter(l => l.trim().length > 10)
    .slice(0, 3)
    .map(l => `<p style="margin:0 0 12px 0;color:#374151;font-size:15px;line-height:1.7;">${l.trim()}</p>`)
    .join('')

  const termBlock = dailyTerm
    ? `<div style="margin-top:28px;padding:20px 24px;background:#F0FDF4;border-left:4px solid #22C55E;border-radius:8px;">
        <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#16A34A;letter-spacing:1px;text-transform:uppercase;">오늘의 경제 단어</p>
        <p style="margin:0 0 6px 0;font-size:17px;font-weight:700;color:#111827;">${dailyTerm.term}</p>
        <p style="margin:0;font-size:14px;color:#4B5563;line-height:1.6;">${dailyTerm.explanation}</p>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${date} 경제번역기 브리핑</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

    <!-- 헤더 -->
    <div style="background:#111827;padding:28px 32px 24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <span style="color:#22C55E;font-size:13px;font-weight:700;letter-spacing:0.5px;">📰 경제번역기</span>
        <span style="color:rgba(255,255,255,0.4);font-size:12px;">${date}</span>
      </div>
      <h1 style="margin:0;color:#F9FAFB;font-size:22px;font-weight:700;line-height:1.45;letter-spacing:-0.3px;">${headline}</h1>
    </div>

    <!-- 본문 -->
    <div style="padding:28px 32px;">
      <p style="margin:0 0 18px 0;font-size:12px;font-weight:600;color:#9CA3AF;letter-spacing:1px;">오늘의 브리핑</p>
      ${summaryLines}

      ${termBlock}

      <!-- CTA 버튼 -->
      <div style="margin-top:28px;text-align:center;">
        <a href="https://economy-translator.vercel.app"
           style="display:inline-block;background:#22C55E;color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;letter-spacing:-0.2px;">
          오늘 브리핑 전체 보기 →
        </a>
      </div>
    </div>

    <!-- 푸터 -->
    <div style="padding:20px 32px;border-top:1px solid #F3F4F6;background:#FAFAFA;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.8;text-align:center;">
        매일 아침 9시, 경제 초보를 위한 5분 브리핑을 보내드립니다.<br>
        <a href="${unsubscribeUrl}" style="color:#9CA3AF;text-decoration:underline;">구독 취소하기</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

export function buildWelcomeHtml(email: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>경제번역기 구독 완료</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

    <div style="background:#111827;padding:36px 32px 28px;text-align:center;">
      <div style="font-size:40px;margin-bottom:16px;">🎉</div>
      <h1 style="margin:0;color:#F9FAFB;font-size:22px;font-weight:700;">구독이 완료됐어요!</h1>
    </div>

    <div style="padding:32px;">
      <p style="margin:0 0 16px 0;color:#374151;font-size:15px;line-height:1.7;">
        안녕하세요! <strong>${email}</strong>으로 구독 신청이 완료됐어요.
      </p>
      <p style="margin:0 0 24px 0;color:#374151;font-size:15px;line-height:1.7;">
        내일 아침 9시부터 매일 <strong>한국 경제 뉴스를 초보자도 이해할 수 있게</strong> 정리해서 보내드릴게요.
        어려운 용어 없이, 딱 5분이면 오늘 경제 흐름을 파악할 수 있어요.
      </p>

      <div style="background:#F0FDF4;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#16A34A;">경제번역기가 매일 알려드리는 것</p>
        <ul style="margin:0;padding-left:18px;color:#4B5563;font-size:14px;line-height:2;">
          <li>오늘 한국 경제에서 가장 중요한 소식</li>
          <li>코스피·코스닥·환율 지표 쉬운 설명</li>
          <li>오늘 알면 좋은 경제 단어 하나</li>
        </ul>
      </div>

      <div style="text-align:center;">
        <a href="https://economy-translator.vercel.app"
           style="display:inline-block;background:#22C55E;color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;">
          오늘 브리핑 먼저 보기 →
        </a>
      </div>
    </div>

    <div style="padding:20px 32px;border-top:1px solid #F3F4F6;background:#FAFAFA;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.8;">
        경제번역기 · 매일 5분 경제 입문 브리핑<br>
        <a href="https://economy-translator.vercel.app/unsubscribe?email=${encodeURIComponent(email)}" style="color:#9CA3AF;text-decoration:underline;">구독 취소하기</a>
      </p>
    </div>

  </div>
</body>
</html>`
}
