'use client'

import { useRef, useState } from 'react'
import { trackEvent } from '@/lib/gtag'

interface Props {
  sentence: string
  dateLabel: string
}

export default function TodaySentenceCard({ sentence, dateLabel }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
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
    if (!cardRef.current) return
    trackEvent('sentence_card_save_image')
    setSaving(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      })
      const link = document.createElement('a')
      link.download = `경제번역기-${dateLabel}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-sm font-bold text-[#111827] mb-3 tracking-tight">
        ✨ 오늘의 한 문장
      </h2>

      {/* 이미지로 저장될 카드 영역 */}
      <div
        ref={cardRef}
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #064E3B 100%)',
          borderRadius: 18,
          padding: '32px 28px 24px',
          maxWidth: 420,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 장식 */}
        <div style={{
          position: 'absolute', top: -50, right: -50,
          width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(34,197,94,0.12)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: -30,
          width: 100, height: 100, borderRadius: '50%',
          background: 'rgba(34,197,94,0.08)',
          pointerEvents: 'none',
        }} />

        {/* 상단 라벨 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{
            background: '#22C55E',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: 20,
            letterSpacing: 0.5,
          }}>
            경제번역기
          </span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
            {dateLabel}
          </span>
        </div>

        {/* 큰따옴표 — 배경 장식 (절대 위치, 텍스트 흐름과 분리) */}
        <div style={{
          position: 'absolute',
          top: 52,
          left: 20,
          color: 'rgba(34,197,94,0.15)',
          fontSize: 130,
          lineHeight: 1,
          fontFamily: 'Georgia, serif',
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          &ldquo;
        </div>

        {/* 한 문장 */}
        <p style={{
          color: '#F8FAFC',
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1.6,
          letterSpacing: '-0.3px',
          marginBottom: 28,
          position: 'relative',
          zIndex: 1,
        }}>
          {sentence}
        </p>

        {/* 하단 브랜딩 */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.12)',
          paddingTop: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
            매일 5분 경제 입문 브리핑
          </span>
          <span style={{ color: '#22C55E', fontSize: 10, fontWeight: 600 }}>
            economy-translator.vercel.app
          </span>
        </div>
      </div>

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
