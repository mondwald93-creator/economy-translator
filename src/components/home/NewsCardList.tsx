'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import BookmarkButton from '@/components/BookmarkButton'

interface Article {
  id: string | number
  title: string
  source: string
  category?: string
  categoryIcon?: string
}

interface Props {
  articles: Article[] | null
  updatedAt?: string | null
}

export default function NewsCardList({ articles, updatedAt }: Props) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('readArticles') || '[]')
      setReadIds(new Set(stored))
    } catch {}
  }, [])

  function markRead(id: string) {
    setReadIds(prev => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('readArticles', JSON.stringify([...next]))
      return next
    })
  }

  if (!articles || articles.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold text-ink-subtle uppercase tracking-widest">분야별 핵심 뉴스</h2>
        <div className="rounded-card border border-line text-center py-10">
          <p className="text-ink-muted text-sm">오늘의 뉴스를 불러오는 중이에요</p>
        </div>
      </section>
    )
  }

  const readCount = articles.filter(a => readIds.has(String(a.id))).length
  const dotCount = Math.min(articles.length, 6)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-ink flex items-center gap-2">
          분야별 핵심 뉴스
          <div className="flex gap-[5px]">
            {Array.from({ length: dotCount }).map((_, i) => (
              <span
                key={i}
                className={`w-5 h-1 rounded-sm transition-colors ${
                  i < readCount ? 'bg-brand-green' : 'bg-line'
                }`}
              />
            ))}
          </div>
        </h2>
        <span className="text-xs text-ink-muted">
          <span className="hidden sm:inline">{updatedAt && <span className="mr-2 text-[#9CA3AF]">{updatedAt} 업데이트 ·</span>}</span>
          {articles.length}개 중 {readCount}개 읽었어요
        </span>
      </div>

      <div className="space-y-2.5">
        {articles.map((article, idx) => {
          const id = String(article.id)
          const isRead = readIds.has(id)
          return (
            <div key={article.id} className="rounded-card bg-white border border-line py-[22px] px-6 grid grid-cols-[36px_1fr_auto] gap-4 items-start hover:shadow-sm hover:border-[#D1FAE5] transition-all">
              <span className="text-2xl font-black text-[#E5E7EB] leading-none pt-0.5">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <Link
                href={`/news/${article.id}`}
                className="min-w-0"
                onClick={() => markRead(id)}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  {article.category && (
                    <span className="text-[10px] font-bold text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] inline-block px-2 py-0.5 rounded">
                      {article.categoryIcon} {article.category}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-[#16A34A] bg-[#F0FDF4] inline-block px-2 py-0.5 rounded">{article.source}</span>
                </div>
                <p className={`text-[15px] font-bold leading-snug transition-colors ${
                  isRead ? 'text-ink-subtle' : 'text-ink'
                }`}>
                  {article.title}
                </p>
              </Link>
              <BookmarkButton
                id={id}
                title={article.title}
                source={article.source}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
