const STORAGE_KEY = 'economy_bookmarks'

export interface BookmarkedArticle {
  id: string
  title: string
  source: string
  bookmarkedAt: string
}

export function getBookmarks(): BookmarkedArticle[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function isBookmarked(id: string): boolean {
  return getBookmarks().some((b) => b.id === id)
}

export function toggleBookmark(article: Omit<BookmarkedArticle, 'bookmarkedAt'>): boolean {
  const bookmarks = getBookmarks()
  const index = bookmarks.findIndex((b) => b.id === article.id)

  if (index >= 0) {
    bookmarks.splice(index, 1)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
    return false
  } else {
    bookmarks.unshift({ ...article, bookmarkedAt: new Date().toISOString() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
    return true
  }
}

export function removeBookmark(id: string): void {
  const bookmarks = getBookmarks().filter((b) => b.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
}
