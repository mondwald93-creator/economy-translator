import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import '../styles/globals.css'
import TopBar from '@/components/layout/TopBar'
import GNB from '@/components/layout/GNB'
import { supabase } from '@/lib/supabase'

export const metadata: Metadata = {
  metadataBase: new URL('https://economy-translator.vercel.app'),
  title: {
    default: '경제번역기 — 5분으로 끝내는 경제 입문',
    template: '%s | 경제번역기',
  },
  description: '경제 공부, 어디서부터 시작할지 모르겠다면? 매일 아침 5분, 한국 경제 뉴스를 쉬운 말로 풀어드려요. 투자를 시작하고 싶은 분들을 위한 무료 경제 브리핑.',
  keywords: ['경제번역기', '경제 입문', '경제 공부', '경제 쉽게', '경제 초보', '2030 경제', '투자 입문', '금리', '환율', '주식', '경제 뉴스', '한국 경제'],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://economy-translator.vercel.app',
    siteName: '경제번역기',
    title: '경제번역기 — 5분으로 끝내는 경제 입문',
    description: '경제 공부, 어디서부터 시작할지 모르겠다면? 매일 아침 5분, 한국 경제 뉴스를 쉬운 말로 풀어드려요.',
  },
  twitter: {
    card: 'summary',
    title: '경제번역기 — 5분으로 끝내는 경제 입문',
    description: '경제 공부, 어디서부터 시작할지 모르겠다면? 매일 아침 5분, 쉬운 말로 풀어드려요.',
  },
  alternates: {
    canonical: 'https://economy-translator.vercel.app',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
  const { data: briefing } = await supabase
    .from('briefings')
    .select('created_at')
    .eq('date', todayKST)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const updatedAt = briefing?.created_at
    ? new Date(briefing.created_at).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Seoul',
        hour12: false,
      })
    : null

  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-4EX6PHFTLB"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-4EX6PHFTLB');
        `}
      </Script>
      <body className="min-h-screen bg-surface text-ink">
        <TopBar updatedAt={updatedAt} />
        <GNB updatedAt={updatedAt} />
        <main className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {children}
        </main>
        <footer className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 text-xs text-ink-subtle border-t border-line mt-4">
          © 경제번역기 · 매일 아침 5분, 경제 입문 브리핑
        </footer>
      </body>
    </html>
  )
}
