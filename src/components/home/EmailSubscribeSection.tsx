'use client'

import { useState } from 'react'

export default function EmailSubscribeSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        setMessage(data.message)
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error ?? '오류가 발생했어요. 다시 시도해주세요.')
      }
    } catch {
      setStatus('error')
      setMessage('오류가 발생했어요. 다시 시도해주세요.')
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-card border border-line p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="text-3xl">🎉</span>
          <div>
            <p className="font-bold text-ink text-base mb-1">{message}</p>
            <p className="text-sm text-ink-muted">매일 아침 9시, 받은편지함에서 확인하세요.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-line overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 pt-6 pb-4 sm:px-8 sm:pt-7">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📬</span>
          <h2 className="text-sm font-bold text-[#111827] tracking-tight">매일 아침 이메일로 받아보기</h2>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed">
          오늘 경제 브리핑을 이메일로 보내드려요. 매일 아침 9시, 받은편지함에서 바로 확인하세요.
        </p>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="px-6 pb-6 sm:px-8 sm:pb-7">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="이메일 주소 입력"
            disabled={status === 'loading'}
            required
            className="flex-1 min-w-0 text-sm px-4 py-2.5 rounded-lg border border-line bg-white text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status === 'loading' || !email.trim()}
            className="flex-shrink-0 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
            style={{
              background: status === 'loading' ? '#D1D5DB' : '#22C55E',
              color: '#fff',
              border: 'none',
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {status === 'loading' ? '처리 중...' : '구독하기'}
          </button>
        </div>

        {status === 'error' && (
          <p className="mt-2 text-xs text-red-500">{message}</p>
        )}

        <p className="mt-3 text-xs text-ink-muted">
          언제든지 구독 취소 가능해요. 스팸 없음 약속 💚
        </p>
      </form>
    </div>
  )
}
