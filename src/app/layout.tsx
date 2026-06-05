import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import Sidebar from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: '경제번역기',
  description: '매일 경제 뉴스를 초보자도 이해할 수 있게 쉽게 정리해드려요',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white">
        {/* 모바일 상단 헤더 */}
        <header className="lg:hidden sticky top-0 z-10 bg-white border-b border-notion-border px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-notion-text">경제번역기</span>
          <span className="text-xs text-notion-muted">
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </span>
        </header>

        <div className="flex min-h-screen">
          {/* 데스크탑 사이드바 */}
          <div className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0">
            <Sidebar />
          </div>

          {/* 메인 콘텐츠 */}
          <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
            <main className="flex-1 px-4 py-6 lg:px-12 lg:py-10">
              <div className="max-w-2xl">
                {children}
              </div>
            </main>
            <footer className="px-4 lg:px-12 py-6 text-xs text-notion-muted border-t border-notion-border">
              © 경제번역기 · 매일 경제를 쉽게
            </footer>
          </div>
        </div>
      </body>
    </html>
  )
}
