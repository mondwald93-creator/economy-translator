'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// 폰 전용 하단 탭. 순서·구성은 GA 모바일 페이지 실측 순서(2026-05~08):
// 홈 80뷰 · 링크분석기 20 · 용어사전 19 · 달력 14. 저장(7)·지난 브리핑(4)은 상단 메뉴에 둔다.
const tabs = [
  { label: '홈', href: '/', icon: '📰' },
  { label: '링크분석', href: '/analyze', icon: '🔗' },
  { label: '용어사전', href: '/dictionary', icon: '📖' },
  { label: '달력', href: '/calendar', icon: '🗓' },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

export default function BottomTabBar() {
  const pathname = usePathname()
  // 읽는 동안(내릴 때)에는 숨겨서 세로 공간을 돌려준다. 위로 올리면 다시 나온다.
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const diff = y - lastY.current
      if (Math.abs(diff) < 8) return // 손떨림 무시
      // 맨 위 근처에서는 항상 보인다
      setHidden(diff > 0 && y > 120)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line transition-transform duration-200 ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="주요 메뉴"
    >
      <div className="flex">
        {tabs.map((tab) => {
          const on = isActive(pathname, tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10.5px] ${
                on ? 'text-[#16A34A] font-bold' : 'text-ink-subtle'
              }`}
              aria-current={on ? 'page' : undefined}
            >
              <span className="text-[17px] leading-none" aria-hidden>{tab.icon}</span>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
