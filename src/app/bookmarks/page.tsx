'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getBookmarks, removeBookmark, BookmarkedArticle } from '@/lib/bookmarks'

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkedArticle[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setBookmarks(getBookmarks())
    setLoaded(true)
  }, [])

  function handleRemove(id: string) {
    removeBookmark(id)
    setBookmarks(getBookmarks())
  }

  if (!loaded) return null

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-brand-500 pl-4">
        <p className="text-xs text-notion-muted mb-1">저장함</p>
        <h1 className="text-2xl font-bold text-notion-text">북마크</h1>
        <p className="text-sm text-notion-muted mt-1">저장한 뉴스를 모아볼 수 있어요</p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="notion-card text-center py-12">
          <p className="text-4xl mb-4">🔖</p>
          <p className="text-notion-text font-medium mb-1">아직 저장한 뉴스가 없어요</p>
          <p className="text-sm text-notion-muted mb-6">뉴스 카드 옆의 🔖 버튼을 눌러 저장해보세요</p>
          <Link
            href="/"
            className="inline-block text-sm text-brand-500 hover:underline"
          >
            오늘의 브리핑 보러 가기 →
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-notion-muted">{bookmarks.length}개 저장됨</p>
          <div className="space-y-2">
            {bookmarks.map((article) => (
              <div key={article.id} className="notion-card flex items-start gap-3">
                <Link href={`/news/${article.id}`} className="flex-1 min-w-0">
                  <p className="text-[11px] text-brand-500 font-semibold mb-1">{article.source}</p>
                  <p className="text-sm font-medium text-notion-text leading-relaxed">
                    {article.title}
                  </p>
                  <p className="text-[11px] text-notion-muted mt-1">
                    {new Date(article.bookmarkedAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })} 저장
                  </p>
                </Link>
                <button
                  onClick={() => handleRemove(article.id)}
                  title="북마크 해제"
                  className="flex-shrink-0 text-lg opacity-100"
                >
                  🔖
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
