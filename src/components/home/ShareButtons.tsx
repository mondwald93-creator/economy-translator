'use client'

import { useState } from 'react'

const SHARE_URL = 'https://economy-translator.vercel.app'
const SHARE_TITLE = '경제번역기 — 매일 5분 경제 입문 브리핑'
const SHARE_TEXT = '경제를 전혀 몰라도 OK. 매일 한국 경제 뉴스를 초보자 언어로 쉽게 정리해줘요 📊'

export default function ShareButtons() {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL })
      } catch {
        // 사용자가 취소한 경우
      }
    } else {
      await handleCopy()
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(SHARE_URL)
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
