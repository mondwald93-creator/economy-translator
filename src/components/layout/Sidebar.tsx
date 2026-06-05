'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { label: '오늘의 브리핑', href: '/', icon: '📰' },
  { label: '링크 분석기', href: '/analyze', icon: '🔍' },
  { label: '경제용어 사전', href: '/dictionary', icon: '📖' },
  { label: '경제 달력', href: '/calendar', icon: '📅' },
  { label: '북마크', href: '/bookmarks', icon: '🔖' },
]

const comingSoon: { label: string; icon: string }[] = []

export default function Sidebar() {
  const pathname = usePathname()
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-full bg-notion-sidebar border-r border-notion-border px-3 py-6">
      <div className="px-3 mb-8">
        <Link href="/" className="block group">
          <p className="text-sm font-bold text-notion-text group-hover:text-gray-600 transition-colors">
            경제번역기
          </p>
          <p className="text-xs text-notion-muted mt-0.5">매일 경제를 쉽게</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5">
        <p className="text-[11px] font-semibold text-notion-muted uppercase tracking-widest mb-1 px-3">
          메뉴
        </p>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              pathname === item.href
                ? 'bg-notion-hover text-notion-text font-medium'
                : 'text-notion-secondary hover:bg-notion-hover hover:text-notion-text'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}

        {comingSoon.length > 0 && (
          <div className="pt-5">
            <p className="text-[11px] font-semibold text-notion-muted uppercase tracking-widest mb-1 px-3">
              준비 중
            </p>
            {comingSoon.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-notion-muted cursor-default select-none"
              >
                <span className="text-base leading-none opacity-40">{item.icon}</span>
                <span className="opacity-40">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="px-3 pt-4 border-t border-notion-border">
        <p className="text-xs text-notion-muted">{today}</p>
      </div>
    </aside>
  )
}
