export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import BookmarkButton from '@/components/BookmarkButton'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  )
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const db = getDb()
  const { data: article } = await db
    .from('news_articles')
    .select('title, summary')
    .eq('id', params.id)
    .single()

  if (!article) return {}

  const description = article.summary
    ? `${article.summary.slice(0, 120)}...`
    : undefined

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      url: `https://economy-translator.vercel.app/news/${params.id}`,
    },
  }
}

const STEP_LABELS: Record<string, { label: string; icon: string }> = {
  whatHappened: { label: '무슨 일이야?', icon: '📰' },
  whyHappened: { label: '왜 이런 일이 생겼어?', icon: '🔍' },
  myImpact: { label: '나한테 어떤 영향이 있어?', icon: '🙋' },
  outlook: { label: '앞으로 어떻게 될까?', icon: '🔭' },
  conclusion: { label: '한 줄 결론', icon: '✅' },
}

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  const db = getDb()
  const { data: article } = await db
    .from('news_articles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!article) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-brand-green-dark hover:underline">
          ← 홈으로
        </Link>
        <div className="editorial-card">
          <p className="text-ink-muted">기사를 찾을 수 없어요.</p>
        </div>
      </div>
    )
  }

  const fullAnalysis = article.full_analysis as Record<string, string> | null

  return (
    <div className="space-y-4 max-w-2xl">
      <Link href="/" className="text-sm text-brand-green-dark hover:underline">
        ← 홈으로
      </Link>
      <div className="editorial-card space-y-4">
        <div>
          <p className="text-xs text-brand-green font-semibold mb-2">{article.source}</p>
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-lg font-bold text-ink leading-relaxed">{article.title}</h1>
            <BookmarkButton id={params.id} title={article.title} source={article.source} />
          </div>
        </div>

        {fullAnalysis?.oneline && (
          <div className="bg-[#111827] rounded-[14px] px-4 py-3 text-center">
            <p className="text-sm font-bold text-[#22C55E]">{fullAnalysis.oneline}</p>
          </div>
        )}

        {fullAnalysis && (
          <div className="space-y-3">
            {(['whatHappened', 'whyHappened', 'myImpact', 'outlook', 'conclusion'] as const).map(key => {
              const val = fullAnalysis[key]
              if (!val) return null
              const meta = STEP_LABELS[key]
              return (
                <div key={key} className="bg-[#F9FAFB] rounded-[14px] p-4 border border-[#E5E7EB]">
                  <p className="text-xs font-bold text-ink-subtle mb-1">{meta.icon} {meta.label}</p>
                  <p className="text-sm text-ink leading-relaxed">{val}</p>
                </div>
              )
            })}
          </div>
        )}

        {!fullAnalysis && article.summary && (
          <div className="bg-[#F0FDF4] rounded-[14px] p-4 border border-[#BBF7D0]">
            <p className="text-xs font-semibold text-brand-green uppercase tracking-widest mb-2">
              쉬운 설명
            </p>
            <p className="text-sm text-ink-muted leading-relaxed">{article.summary}</p>
          </div>
        )}

        {!fullAnalysis && !article.summary && (
          <div className="bg-[#F9FAFB] rounded-[14px] p-4 border border-[#E5E7EB] text-center space-y-1">
            <p className="text-sm text-ink-muted">이 기사는 AI 분석이 아직 준비되지 않았어요.</p>
            <p className="text-xs text-ink-subtle">원본 기사를 직접 확인해 보세요.</p>
          </div>
        )}

        {article.original_url && (
          <a
            href={article.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-[14px] bg-[#111827] text-white text-sm font-semibold hover:bg-[#1F2937] transition-colors"
          >
            원본 기사 보기 →
          </a>
        )}
      </div>
    </div>
  )
}
