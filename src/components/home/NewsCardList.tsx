import Link from 'next/link'
import BookmarkButton from '@/components/BookmarkButton'

interface Article {
  id: string | number
  title: string
  source: string
}

interface Props {
  articles: Article[] | null
}

export default function NewsCardList({ articles }: Props) {
  if (!articles || articles.length === 0) {
    return (
      <section>
        <h2 className="notion-heading">오늘의 헤드라인</h2>
        <div className="notion-card text-center py-8">
          <p className="text-notion-muted text-sm">오늘의 뉴스를 불러오는 중이에요</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="notion-heading">오늘의 헤드라인</h2>
      <div className="space-y-2">
        {articles.map((article) => (
          <div key={article.id} className="notion-card flex items-start gap-3">
            <Link href={`/news/${article.id}`} className="flex-1 min-w-0 cursor-pointer">
              <p className="text-[11px] text-brand-500 font-semibold mb-1">{article.source}</p>
              <p className="text-sm font-medium text-notion-text leading-relaxed">{article.title}</p>
            </Link>
            <BookmarkButton
              id={String(article.id)}
              title={article.title}
              source={article.source}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
