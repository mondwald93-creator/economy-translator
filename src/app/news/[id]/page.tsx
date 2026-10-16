export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import BookmarkButton from '@/components/BookmarkButton'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  )
}

// 요약도 해설도 없는 기사 = 화면에 제목과 원본 링크만 뜨는 '빈 페이지'.
//  ⚠️ 2026-10-16: 구글이 이런 페이지를 Soft 404(겉은 200인데 내용이 없는 페이지)로 잡았다.
//  수집 기사 25만 건 중 해설 있는 건 1천 건뿐이라, 빈 페이지는 검색에서 뺀다(noindex). 페이지 자체는 그대로 열린다.
function isThinArticle(article: { summary?: string | null; full_analysis?: unknown }) {
  return !(article.summary ?? '').trim() && !article.full_analysis
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const db = getDb()
  const { data: article } = await db
    .from('news_articles')
    .select('title, summary, full_analysis')
    .eq('id', params.id)
    .single()

  // 없는 기사는 아래 페이지에서 notFound()로 진짜 404를 돌려준다. 메타데이터는 비워 둔다.
  if (!article) return {}

  const description = article.summary
    ? `${article.summary.slice(0, 120)}...`
    : undefined

  // ⚠️ canonical(대표 주소)을 반드시 자기 주소로 덮어쓴다.
  //  layout.tsx의 기본값이 홈 주소라, 안 덮으면 뉴스 300장이 전부 "나는 홈페이지다"라고 신고한다.
  //  2026-09-09 발견: 구글이 「중복 페이지, 사용자와 다른 표준을 선택함」으로 경고를 보냈다.
  const url = `https://economytranslator.com/news/${params.id}`

  return {
    title: article.title,
    description,
    alternates: { canonical: url },
    // 빈 기사는 검색 색인에서 뺀다. 링크는 따라가게 둔다(원본 기사 링크).
    ...(isThinArticle(article) ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: article.title,
      description,
      url,
    },
  }
}

// ⚠️ 라벨 반말 금지(사유는 Top3NewsSection.tsx 주석)
const STEP_LABELS: Record<string, { label: string; icon: string }> = {
  whatHappened: { label: '무슨 일인가요?', icon: '📰' },
  whyHappened: { label: '왜 이런 일이 생겼나요?', icon: '🔍' },
  myImpact: { label: '나에게 어떤 영향이 있나요?', icon: '🙋' },
  outlook: { label: '앞으로 어떻게 될까요?', icon: '🔭' },
  conclusion: { label: '한 줄 결론', icon: '✅' },
}

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  const db = getDb()
  const { data: article } = await db
    .from('news_articles')
    .select('*')
    .eq('id', params.id)
    .single()

  // ⚠️ 없는 id(지워졌거나 잘못된 주소)는 진짜 404를 돌려준다. (dictionary/[slug]와 같은 방식)
  //  2026-10-16까지는 200으로 「기사를 찾을 수 없어요」를 그렸고, 구글은 이걸 Soft 404로 본다.
  if (!article) notFound()

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
                  <p className="text-[15px] sm:text-sm text-ink leading-relaxed">{val}</p>
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
            <p className="text-[15px] sm:text-sm text-ink-muted leading-relaxed">{article.summary}</p>
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
