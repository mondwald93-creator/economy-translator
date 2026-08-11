'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CATEGORIES, CATEGORY_COLORS, slugifyTerm, type Term } from '@/lib/terms'

/**
 * 검색·필터는 브라우저에서 처리한다(용어 252개 규모라 서버 왕복이 불필요).
 * 초기 목록은 서버가 이미 그려서 내려주므로 검색엔진도 전체 용어와 링크를 본다.
 */
export default function DictionaryList({ terms }: { terms: Term[] }) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('전체')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return terms.filter((t) => {
      if (selectedCategory !== '전체' && t.category !== selectedCategory) return false
      if (!q) return true
      return (
        t.term.toLowerCase().includes(q) ||
        t.explanation.toLowerCase().includes(q)
      )
    })
  }, [terms, search, selectedCategory])

  return (
    <>
      {/* 검색창 */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm">🔎</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="용어 검색 (예: 금리, 환율, 인플레이션...)"
          /* text-base(16px): 16px보다 작으면 아이폰이 입력할 때 화면을 멋대로 확대한다 */
          className="w-full pl-9 pr-4 py-2.5 text-base sm:text-sm border border-line rounded-[14px] text-ink placeholder:text-ink-subtle focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green bg-white"
        />
      </div>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              selectedCategory === cat
                ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0] font-bold'
                : 'bg-white text-ink-muted border-line hover:bg-surface'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 결과 카운트 */}
      <p className="text-xs text-ink-subtle">
        {search || selectedCategory !== '전체'
          ? `검색 결과 ${filtered.length}개`
          : `전체 ${filtered.length}개`}
      </p>

      {/* 결과 없음 */}
      {filtered.length === 0 && (
        <div className="border border-line rounded-[14px] p-8 text-center bg-white">
          <p className="text-ink-subtle text-sm">검색 결과가 없어요</p>
          <button
            onClick={() => { setSearch(''); setSelectedCategory('전체') }}
            className="mt-2 text-xs text-brand-green-dark underline underline-offset-2"
          >
            전체 보기
          </button>
        </div>
      )}

      {/* 용어 카드 그리드 */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((term) => (
            <Link
              key={term.id}
              href={`/dictionary/${slugifyTerm(term.term)}`}
              className="block border border-line rounded-[14px] p-4 bg-white hover:bg-surface transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[15px] sm:text-sm font-bold text-ink leading-snug">{term.term}</p>
                <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[term.category] ?? CATEGORY_COLORS['기타']}`}>
                  {term.category}
                </span>
              </div>
              {/* 폰에서는 2줄까지만. 설명을 다 펼쳐 보여주면 목록에서 끝나 상세로 들어갈 이유가 없다(2026-08-11) */}
              <p className="text-[13px] sm:text-xs text-ink-muted leading-relaxed mb-2 line-clamp-2 sm:line-clamp-3">{term.explanation}</p>
              {/* 예문은 폰에서 감춘다 — 상세 페이지에서 본다 */}
              {term.example && (
                <p className="hidden sm:block text-[11px] text-ink-subtle leading-relaxed border-l-2 border-line pl-2 line-clamp-2">
                  {term.example}
                </p>
              )}
              <span className="sm:hidden text-[13px] font-bold text-[#16A34A]">자세히 보기 →</span>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
