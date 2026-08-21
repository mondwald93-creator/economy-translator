'use client'

import { useState } from 'react'
import { trackEvent } from '@/lib/gtag'

interface Props {
  sentence: string
  dateLabel: string
  /** 'YYYY-MM-DD'. 카드 그림 주소에 들어간다 */
  date: string
}

/**
 * 오늘의 한 문장 카드 (2026-08-11 개편 · 2026-08-21 그림 주소 분리)
 *
 * 카드 그림은 서버가 만든다. 화면에 보이는 것 = 저장되는 것이 같은 그림이다.
 * 예전에는 화면 요소를 html2canvas로 사진 찍어 저장했는데, 그러면 카드가 두 벌이 되어
 * 나중에 한쪽만 고치는 사고가 난다. 겸사겸사 무거운 라이브러리도 걷어냈다.
 *
 * ⚠️ 2026-08-21: 그림 주소를 `/opengraph-image`에서 `/api/card/sentence/<날짜>`로 옮겼다.
 * 홈 og는 8/20에 **간판 고정**이 됐다(스레드 고정글이 홈 링크를 걸어 매일 그림이 바뀌던 걸
 * 막은 것). 그런데 이 화면 카드가 같은 주소를 쓰고 있어서, 「오늘의 한 문장」 자리에
 * 그날 문장 대신 간판이 떴다. 링크 미리보기와 화면 카드는 **쓰임이 다르다.**
 */
export default function TodaySentenceCard({ sentence, dateLabel, date }: Props) {
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleCopyText = async () => {
    trackEvent('sentence_card_copy_text')
    const text = `${sentence}\n\n📰 경제번역기 · 매일 5분 경제 입문 브리핑\nhttps://economytranslator.com`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveImage = async () => {
    trackEvent('sentence_card_save_image')
    setSaving(true)
    try {
      const res = await fetch(`/api/card/sentence/${date}`)
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

      {/* 서버가 만든 그날 문장 카드. 「이미지 저장」이 받아가는 것과 같은 그림이다.
          eslint-disable: 이 그림은 매일 내용이 바뀌고 next/image의 최적화가 필요 없다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/card/sentence/${date}`}
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
