import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import TopBar from '@/components/layout/TopBar'
import GNB from '@/components/layout/GNB'
import { supabase } from '@/lib/supabase'

export const metadata: Metadata = {
  metadataBase: new URL('https://economy-translator.vercel.app'),
  title: {
    default: '경제번역기 — 매일 경제를 쉽게',
    template: '%s | 경제번역기',
  },
  description: '주식·환율·금리 등 경제를 전혀 몰라도 OK. 매일 한국 경제 뉴스를 초보자 언어로 쉽게 정리해드려요.',
  keywords: ['경제번역기', '경제 쉽게', '경제 초보', '금리', '환율', '주식', '경제 뉴스', '한국 경제', '경제용어'],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://economy-translator.vercel.app',
    siteName: '경제번역기',
    title: '경제번역기 — 매일 경제를 쉽게',
    description: '주식·환율·금리 등 경제를 전혀 몰라도 OK. 매일 한국 경제 뉴스를 초보자 언어로 쉽게 정리해드려요.',
  },
  twitter: {
    card: 'summary',
    title: '경제번역기 — 매일 경제를 쉽게',
    description: '주식·환율·금리 등 경제를 전혀 몰라도 OK. 매일 한국 경제 뉴스를 초보자 언어로.',
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
      <body className="min-h-screen bg-surface text-ink">
        <TopBar updatedAt={updatedAt} />
        <GNB updatedAt={updatedAt} />
        <main className="max-w-[900px] mx-auto px-6 py-10">
          {children}
        </main>
        <footer className="max-w-[900px] mx-auto px-6 py-8 text-xs text-ink-subtle border-t border-line mt-4">
          © 경제번역기 · 매일 경제를 쉽게
        </footer>
      </body>
    </html>
  )
}
