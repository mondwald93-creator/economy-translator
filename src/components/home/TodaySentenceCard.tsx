'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/gtag'

interface Props {
  sentence: string
  dateLabel: string
}

/**
 * 오늘의 한 문장 카드 (2026-08-11 개편)
 *
 * 카드 그림은 서버가 만든 공유 카드(`/opengraph-image`) 한 장을 그대로 쓴다.
 * 화면에 보이는 것 = 저장되는 것 = 카톡에 뜨는 것이 전부 같은 그림이다.
 *
 * 왜 바꿨나: 예전에는 화면 요소를 html2canvas로 사진 찍어 저장했는데,
 * 그러면 카드가 두 벌(화면용·공유용)이 되어 나중에 한쪽만 고치는 사고가 난다.
 * 겸사겸사 html2canvas(무거운 라이브러리)도 걷어냈다.
 */
export default function TodaySentenceCard({ sentence, dateLabel }: Props) {
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleCopyText = async () => {
    trackEvent('sentence_card_copy_text')
    const text = `${sentence}\n\n📰 경제번역기 · 매일 5분 경제 입문 브리핑\nhttps://economy-translator.vercel.app`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveImage = async () => {
    trackEvent('sentence_card_save_image')
    setSaving(true)
    try {
      const res = await fetch('/opengraph-image')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `경제번역기-${dateLabel}.png`
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-sm font-bold text-[#111827] mb-3 tracking-tight">✨ 오늘의 한 문장</h2>

      {/* 서버가 만든 공유 카드 그대로. 링크를 붙였을 때 뜨는 그림과 같은 것이다.
          eslint-disable: 이 그림은 매일 내용이 바뀌고 next/image의 최적화가 필요 없다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/opengraph-image"
        alt={sentence}
        width={1200}
        height={630}
        className="w-full max-w-[520px] rounded-[14px]"
      />

      {/* 버튼 */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleCopyText}
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          style={{
            background: copied ? '#22C55E' : '#F3F4F6',
            color: copied ? '#fff' : '#374151',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {copied ? '✓ 복사됨!' : '📋 텍스트 복사'}
        </button>
        <button
          onClick={handleSaveImage}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors"
          style={{
            background: saving ? '#D1D5DB' : '#111827',
            color: '#fff',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '저장 중...' : '📸 이미지 저장'}
        </button>
      </div>
    </div>
  )
}
