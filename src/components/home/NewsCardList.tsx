import Link from 'next/link'

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
          <Link key={article.id} href={`/news/${article.id}`}>
            <div className="notion-card cursor-pointer">
              <p className="text-[11px] text-brand-500 font-semibold mb-1">{article.source}</p>
              <p className="text-sm font-medium text-notion-text leading-relaxed">{article.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
