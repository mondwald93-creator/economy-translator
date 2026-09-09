import type { Metadata } from 'next'

/**
 * /analyze 는 'use client' 라 페이지에서 metadata를 못 내보낸다.
 * canonical(대표 주소)을 자기 주소로 잡으려고 레이아웃을 덧씌운다.
 * 없으면 루트 layout.tsx의 기본값(홈 주소)을 물려받아 홈과 중복 페이지로 잡힌다.
 * 2026-09-09 신설 — 뉴스 상세와 같은 원인.
 */
export const metadata: Metadata = {
  title: '링크분석기',
  description: '경제 뉴스 링크를 넣으면 무슨 일인지, 왜 생겼는지, 나에게 어떤 영향이 있는지 쉬운 말로 풀어드려요.',
  alternates: { canonical: 'https://economytranslator.com/analyze' },
  openGraph: {
    title: '링크분석기 | 경제번역기',
    description: '경제 뉴스 링크를 넣으면 쉬운 말로 풀어드려요.',
    url: 'https://economytranslator.com/analyze',
  },
}

export default function AnalyzeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
