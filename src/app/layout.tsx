import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'

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
      <body className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-lg font-extrabold text-gray-900">경제번역기</h1>
            <span className="text-sm text-gray-400">
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="text-center py-8 text-xs text-gray-400">
          © 경제번역기 · 매일 경제를 쉽게
        </footer>
      </body>
    </html>
  )
}
