import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Noto_Sans_KR } from 'next/font/google'
import '../styles/globals.css'

// 웹폰트 자체 호스팅 (구글 서버 왕복 제거). 가변 폰트 하나가 400~900 굵기를 전부 커버한다.
const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans-kr',
})
import TopBar from '@/components/layout/TopBar'
import GNB from '@/components/layout/GNB'
import BottomTabBar from '@/components/layout/BottomTabBar'
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
  // 구글 서치 콘솔 소유권 확인 (2026-07-26 등록). 지우면 소유권이 풀린다.
  verification: {
    google: 'GFtikU9HkXIaCbjc-P8Ib8PeaBqbiSscJ9sqTs6JKkY',
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
    <html lang="ko" className={notoSansKR.variable}>
      {/* GA는 화면이 뜬 뒤 한가할 때 로드 (첫 화면 속도 우선, 측정 자체는 동일) */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-4EX6PHFTLB"
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
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
        <footer className="max-w-[900px] mx-auto px-4 sm:px-6 py-8 pb-24 sm:pb-8 text-xs text-ink-subtle border-t border-line mt-4">
          © 경제번역기 · 매일 아침 5분, 경제 입문 브리핑
        </footer>
        <BottomTabBar />
      </body>
    </html>
  )
}
