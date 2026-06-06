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

function UpdateChip() {
  return (
    <span className="hidden lg:inline-flex items-center gap-[6px] text-[11px] font-semibold text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] whitespace-nowrap flex-shrink-0" style={{ borderRadius: 20, padding: '5px 12px' }}>
      <span className="w-[6px] h-[6px] rounded-full bg-[#22C55E] inline-block flex-shrink-0" />
      오늘 오전 8:01 업데이트
    </span>
  )
}

export default function GNB() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-line">
      <div className="px-12 h-[60px] flex items-center justify-between">
        <Link href="/" className="flex-shrink-0">
          <span className="text-[17px] font-black text-ink" style={{ letterSpacing: '-0.8px' }}>
            경제번역기<span className="text-brand-green">.</span>
          </span>
        </Link>

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

        <UpdateChip />
      </div>
    </header>
  )
}
