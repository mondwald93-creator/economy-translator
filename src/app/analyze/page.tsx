'use client'

import { useState } from 'react'

interface Analysis {
  title: string
  oneline: string
  whatHappened: string
  whyHappened: string
  myImpact: string
  outlook: string
  conclusion: string
}

const STEPS: { key: keyof Omit<Analysis, 'title' | 'oneline' | 'conclusion'>; label: string }[] = [
  { key: 'whatHappened', label: '무슨 일이야?' },
  { key: 'whyHappened', label: '왜 이런 일이?' },
  { key: 'myImpact', label: '나한테 영향은?' },
  { key: 'outlook', label: '앞으로 어떻게?' },
]

export default function AnalyzePage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const res = await fetch('/api/analyze-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error ?? '분석 중 문제가 생겼어요.')
      } else {
        setAnalysis(data.analysis)
      }
    } catch {
      setError('네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 헤더 */}
      <div className="border-l-4 border-blue-500 pl-4 py-1">
        <p className="section-label">도구</p>
        <h1 className="text-xl font-bold text-notion-text leading-snug">뉴스 링크 분석기</h1>
        <p className="text-sm text-notion-secondary mt-1">
          경제 뉴스 링크를 붙여넣으면 AI가 6단계로 쉽게 풀어드려요
        </p>
      </div>

      {/* 입력창 */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://news.naver.com/..."
            className="flex-1 text-sm border border-notion-border rounded-lg px-4 py-2.5 text-notion-text placeholder:text-notion-muted focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-5 py-2.5 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? '분석 중...' : '분석하기'}
          </button>
        </div>
        <p className="text-xs text-notion-muted">
          네이버 뉴스, 한겨레, 조선일보, 중앙일보 등 대부분의 경제 뉴스 링크 지원
        </p>
      </form>

      {/* 로딩 */}
      {loading && (
        <div className="border border-notion-border rounded-lg p-6 text-center">
          <p className="text-sm text-notion-secondary animate-pulse-soft">기사를 읽고 분석하는 중이에요...</p>
          <p className="text-xs text-notion-muted mt-1">약 10~15초 소요됩니다</p>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 분석 결과 */}
      {analysis && (
        <div className="border border-notion-border rounded-lg overflow-hidden animate-slide-in-up">
          {/* 카드 헤더 */}
          <div className="px-4 py-3 bg-notion-hover border-b border-notion-border">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5 text-base leading-none">📰</span>
              <div>
                <p className="text-sm font-semibold text-notion-text leading-snug">{analysis.title}</p>
                <p className="text-xs text-notion-muted mt-1">한 마디로: <span className="font-semibold text-blue-600">{analysis.oneline}</span></p>
              </div>
            </div>
          </div>

          {/* 6단계 분석 */}
          <div className="divide-y divide-notion-border">
            {STEPS.map(({ key, label }) => (
              <div key={key} className="flex gap-3 px-4 py-3">
                <span className="flex-shrink-0 text-[11px] font-semibold text-notion-muted w-[88px] pt-0.5">
                  {label}
                </span>
                <p className="text-xs text-notion-secondary leading-relaxed flex-1">
                  {analysis[key]}
                </p>
              </div>
            ))}
          </div>

          {/* 결론 */}
          <div className="px-4 py-3 bg-blue-50 border-t border-notion-border">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-widest">한 줄 결론</span>
              <span className="text-sm font-bold text-blue-700">{analysis.conclusion}</span>
            </div>
          </div>
        </div>
      )}

      {/* 다시 분석 버튼 */}
      {analysis && (
        <button
          onClick={() => { setAnalysis(null); setUrl('') }}
          className="text-sm text-notion-muted hover:text-notion-secondary underline underline-offset-2"
        >
          다른 기사 분석하기
        </button>
      )}
    </div>
  )
}
