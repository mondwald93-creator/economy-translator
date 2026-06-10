'use client'

import { useEffect, useState } from 'react'

// 연속 방문 일수를 브라우저에 기록 — 어제도 왔으면 +1, 끊겼으면 1로 리셋
function calcStreak(): number {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
  const yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  const last = localStorage.getItem('visit_last_date')
  let count = parseInt(localStorage.getItem('visit_streak') ?? '0', 10) || 0

  if (last !== today) {
    count = last === yesterday ? count + 1 : 1
  }
  if (count < 1) count = 1

  localStorage.setItem('visit_last_date', today)
  localStorage.setItem('visit_streak', String(count))
  return count
}

export default function DailyStreakBanner() {
  const [streak, setStreak] = useState<number | null>(null)

  useEffect(() => {
    try {
      setStreak(calcStreak())
    } catch {
      // 브라우저 저장소 미지원 환경 — 배너는 기본 문구만 표시
    }
  }, [])

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[#92400E]"
      style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 16 }}
    >
      <span className="flex items-center gap-3">
        <span style={{ fontSize: 16 }}>☀️</span>
        <span>오늘 브리핑 읽으면 <strong className="font-bold">경제 공부 하루치 완료!</strong> 내일 아침 9시에 또 만나요</span>
      </span>
      {streak !== null && streak >= 2 && (
        <span className="flex-shrink-0 font-bold" style={{ color: '#B45309' }}>
          🔥 {streak}일 연속 공부 중
        </span>
      )}
    </div>
  )
}
