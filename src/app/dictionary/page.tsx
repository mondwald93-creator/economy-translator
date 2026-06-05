'use client'

import { useState, useEffect, useCallback } from 'react'

interface Term {
  id: string
  term: string
  category: string
  explanation: string
  example: string | null
}

const CATEGORIES = ['전체', '금리', '환율', '주식', '부동산', '무역', '경기', '소비', '통화', '기타']

const CATEGORY_COLORS: Record<string, string> = {
  '금리':   'bg-blue-50 text-blue-700',
  '환율':   'bg-green-50 text-green-700',
  '주식':   'bg-purple-50 text-purple-700',
  '부동산': 'bg-orange-50 text-orange-700',
  '무역':   'bg-cyan-50 text-cyan-700',
  '경기':   'bg-red-50 text-red-700',
  '소비':   'bg-pink-50 text-pink-700',
  '통화':   'bg-yellow-50 text-yellow-700',
  '기타':   'bg-gray-50 text-gray-600',
}

export default function DictionaryPage() {
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('전체')

  // 검색어 디바운스 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const fetchTerms = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (selectedCategory !== '전체') params.set('category', selectedCategory)

    const res = await fetch(`/api/terms?${params}`)
    const data = await res.json()
    setTerms(data.terms ?? [])
    setLoading(false)
  }, [debouncedSearch, selectedCategory])

  useEffect(() => {
    fetchTerms()
  }, [fetchTerms])

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="border-l-4 border-blue-500 pl-4 py-1">
        <p className="section-label">사전</p>
        <h1 className="text-xl font-bold text-notion-text leading-snug">경제용어 사전</h1>
        <p className="text-sm text-notion-secondary mt-1">
          어렵게 느껴지는 경제 용어를 쉬운 말로 설명해드려요
        </p>
      </div>

      {/* 검색창 */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-notion-muted text-sm">🔎</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="용어 검색 (예: 금리, 환율, 인플레이션...)"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-notion-border rounded-lg text-notion-text placeholder:text-notion-muted focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
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
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-notion-secondary border-notion-border hover:bg-notion-hover'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 결과 카운트 */}
      {!loading && (
        <p className="text-xs text-notion-muted">
          {debouncedSearch || selectedCategory !== '전체'
            ? `검색 결과 ${terms.length}개`
            : `전체 ${terms.length}개`}
        </p>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-notion-border rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-notion-hover rounded w-1/3 mb-2" />
              <div className="h-3 bg-notion-hover rounded w-full mb-1.5" />
              <div className="h-3 bg-notion-hover rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {/* 결과 없음 */}
      {!loading && terms.length === 0 && (
        <div className="border border-notion-border rounded-lg p-8 text-center">
          <p className="text-notion-muted text-sm">검색 결과가 없어요</p>
          <button
            onClick={() => { setSearch(''); setSelectedCategory('전체') }}
            className="mt-2 text-xs text-blue-500 underline underline-offset-2"
          >
            전체 보기
          </button>
        </div>
      )}

      {/* 용어 카드 그리드 */}
      {!loading && terms.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {terms.map((term) => (
            <div key={term.id} className="border border-notion-border rounded-lg p-4 bg-white hover:bg-notion-hover transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-bold text-notion-text leading-snug">{term.term}</p>
                <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[term.category] ?? CATEGORY_COLORS['기타']}`}>
                  {term.category}
                </span>
              </div>
              <p className="text-xs text-notion-secondary leading-relaxed mb-2">{term.explanation}</p>
              {term.example && (
                <p className="text-[11px] text-notion-muted leading-relaxed border-l-2 border-notion-border pl-2">
                  {term.example}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
