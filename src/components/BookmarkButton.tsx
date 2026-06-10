'use client'
import { useState, useEffect } from 'react'
import { isBookmarked, toggleBookmark } from '@/lib/bookmarks'
import { trackEvent } from '@/lib/gtag'

interface Props {
  id: string
  title: string
  source: string
}

export default function BookmarkButton({ id, title, source }: Props) {
  const [bookmarked, setBookmarked] = useState(false)

  useEffect(() => {
    setBookmarked(isBookmarked(id))
  }, [id])

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const added = toggleBookmark({ id, title, source })
    trackEvent(added ? 'bookmark_add' : 'bookmark_remove')
    setBookmarked(added)
  }

  return (
    <button
      onClick={handleClick}
      title={bookmarked ? '북마크 해제' : '북마크 저장'}
      className={`flex-shrink-0 text-lg transition-opacity ${
        bookmarked ? 'opacity-100' : 'opacity-25 hover:opacity-60'
      }`}
    >
      🔖
    </button>
  )
}
