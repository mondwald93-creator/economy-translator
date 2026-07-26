'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/gtag'

const SHARE_URL = 'https://economy-translator.vercel.app'
const SHARE_TITLE = '경제번역기 — 매일 5분 경제 입문 브리핑'
const SHARE_TEXT = '경제를 전혀 몰라도 OK. 매일 한국 경제 뉴스를 초보자 언어로 쉽게 정리해줘요 📊'

interface Props {
  /** 지난 브리핑처럼 홈이 아닌 페이지에서는 그 페이지 주소를 공유해야 한다. */
  url?: string
  title?: string
  text?: string
}

export default function ShareButtons({ url, title, text }: Props = {}) {
  const [copied, setCopied] = useState(false)
  const shareUrl = url ?? SHARE_URL
  const shareTitle = title ?? SHARE_TITLE
  const shareText = text ?? SHARE_TEXT

  async function handleShare() {
    trackEvent('share_click', { method: typeof navigator.share === 'function' ? 'web_share' : 'copy_fallback' })
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
      } catch {
        // 사용자가 취소한 경우
      }
    } else {
      await copyToClipboard()
    }
  }

  async function handleCopy() {
    trackEvent('copy_link_click')
    await copyToClipboard()
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard 미지원 환경
    }
  }

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] px-3 py-2 rounded-lg transition-colors"
      >
        <span>📤</span>
        <span>친구에게 공유</span>
      </button>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 text-xs font-medium text-[#374151] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] px-3 py-2 rounded-lg transition-colors"
      >
        <span>{copied ? '✅' : '🔗'}</span>
        <span>{copied ? '복사됨!' : '링크 복사'}</span>
      </button>
    </div>
  )
}
