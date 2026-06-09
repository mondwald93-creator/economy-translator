'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: '홈', href: '/' },
  { label: '링크분석기', href: '/analyze' },
  { label: '용어사전', href: '/dictionary' },
  { label: '달력', href: '/calendar' },
  { label: '북마크', href: '/bookmarks' },
]

function UpdateChip({ updatedAt }: { updatedAt?: string | null }) {
  const text = updatedAt ? `오늘 ${updatedAt} 업데이트` : '매일 오전 9시 업데이트'
  return (
    <span className="hidden lg:inline-flex items-center gap-[6px] text-[11px] font-semibold text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] whitespace-nowrap flex-shrink-0" style={{ borderRadius: 20, padding: '5px 12px' }}>
      <span className="w-[6px] h-[6px] rounded-full bg-[#22C55E] inline-block flex-shrink-0" />
      {text}
    </span>
  )
}

export default function GNB({ updatedAt }: { updatedAt?: string | null }) {
  const pathname = usePathname()

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
          <nav className="flex items-center gap-[6px] overflow-x-auto scrollbar-hide">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-shrink-0 px-[14px] py-1.5 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                  pathname === item.href
                    ? 'bg-[#F0FDF4] text-[#16A34A] font-bold'
                    : 'text-ink-muted hover:text-ink hover:bg-surface'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent lg:hidden" />
        </div>

        <div className="justify-self-end hidden sm:block">
          <UpdateChip updatedAt={updatedAt} />
        </div>
      </div>
    </header>
  )
}
