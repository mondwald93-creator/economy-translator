'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const navItems = [
  { label: '홈', href: '/' },
  { label: '지난 브리핑', href: '/briefing' },
  { label: '링크분석기', href: '/analyze' },
  { label: '용어사전', href: '/dictionary' },
  { label: '달력', href: '/calendar' },
  { label: '북마크', href: '/bookmarks' },
]

/** 하위 페이지(/dictionary/기준금리, /briefing/2026-07-26)에서도 해당 메뉴를 켜둔다. */
function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

function UpdateChip({ updatedAt }: { updatedAt?: string | null }) {
  const text = updatedAt ? '오늘 브리핑 완료 ✓' : '매일 아침 9시 브리핑'
  return (
    <span className="hidden lg:inline-flex items-center gap-[6px] text-[11px] font-semibold text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] whitespace-nowrap flex-shrink-0" style={{ borderRadius: 20, padding: '5px 12px' }}>
      <span className="w-[6px] h-[6px] rounded-full bg-[#22C55E] inline-block flex-shrink-0" />
      {text}
    </span>
  )
}

export default function GNB({ updatedAt }: { updatedAt?: string | null }) {
  const pathname = usePathname()

  // 메뉴가 옆으로 더 있음을 알리는 힌트(페이드+화살표). 끝까지 밀면 숨긴다.
  const navRef = useRef<HTMLElement>(null)
  const [moreRight, setMoreRight] = useState(false)

  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const update = () => setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-line">
      {/* 모바일: 로고(auto) + 네비(1fr) / 데스크탑: 1fr + 네비(auto) + 1fr */}
      <div className="px-4 sm:px-12 h-[60px] grid grid-cols-[auto_1fr] sm:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-0">
        <Link href="/" className="justify-self-start flex-shrink-0">
          <span className="text-[17px] font-black text-ink whitespace-nowrap" style={{ letterSpacing: '-0.8px' }}>
            경제번역기<span className="text-brand-green">.</span>
          </span>
        </Link>

        <div className="relative min-w-0 sm:justify-self-center">
          <nav ref={navRef} className="flex items-center gap-[6px] overflow-x-auto scrollbar-hide">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-shrink-0 px-[14px] py-1.5 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                  isActive(pathname, item.href)
                    ? 'bg-[#F0FDF4] text-[#16A34A] font-bold'
                    : 'text-ink-muted hover:text-ink hover:bg-surface'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {moreRight && (
            <div className="pointer-events-none absolute right-0 top-0 h-full flex items-center lg:hidden">
              <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-white via-white/80 to-transparent" />
              <span className="relative text-ink-muted text-[15px] font-bold pr-0.5" aria-hidden>
                ›
              </span>
            </div>
          )}
        </div>

        <div className="justify-self-end hidden sm:block">
          <UpdateChip updatedAt={updatedAt} />
        </div>
      </div>
    </header>
  )
}
