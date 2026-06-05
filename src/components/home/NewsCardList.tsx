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
        <h2 className="text-base font-bold text-gray-800 mb-3">오늘의 헤드라인</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center py-8">
          <p className="text-gray-400 text-sm">오늘의 뉴스를 불러오는 중이에요</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-base font-bold text-gray-800 mb-3">오늘의 헤드라인</h2>
      <div className="space-y-3">
        {articles.map((article) => (
          <Link key={article.id} href={`/news/${article.id}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">
              <p className="text-xs text-blue-500 font-medium mb-1">{article.source}</p>
              <p className="text-sm font-medium text-gray-800 leading-relaxed">{article.title}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
