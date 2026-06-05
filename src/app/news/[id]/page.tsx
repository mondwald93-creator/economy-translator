import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BookmarkButton from '@/components/BookmarkButton'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { data: article } = await supabase
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

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  const { data: article } = await supabase
    .from('news_articles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!article) {
    return (
      <div className="space-y-4">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← 홈으로
        </Link>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-gray-500">기사를 찾을 수 없어요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← 홈으로
      </Link>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <div>
          <p className="text-xs text-blue-500 font-medium mb-2">{article.source}</p>
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-lg font-bold text-gray-900 leading-relaxed">{article.title}</h1>
            <BookmarkButton id={params.id} title={article.title} source={article.source} />
          </div>
        </div>
        {article.summary && (
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">
              쉬운 설명
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{article.summary}</p>
          </div>
        )}
        {article.original_url && (
          <a
            href={article.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            원본 기사 보기 →
          </a>
        )}
      </div>
    </div>
  )
}
