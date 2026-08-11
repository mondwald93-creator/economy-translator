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

/**
 * 연속 방문 기록 표시. 2026-08-11부터 EndCard(글 맨 끝) 안에서만 쓴다.
 * 완독 문구는 EndCard 제목이 맡으므로 여기서는 연속 일수만 말한다(문구 중복 제거).
 */
export default function DailyStreakBanner() {
  const [streak, setStreak] = useState<number | null>(null)

  useEffect(() => {
    try {
      setStreak(calcStreak())
    } catch {
      // 브라우저 저장소 미지원 환경 — 표시하지 않는다
    }
  }, [])

  if (streak === null || streak < 2) return null

  return (
    <p className="inline-flex items-center gap-1.5 bg-white/[0.07] text-[#FDE68A] text-[13px] font-bold rounded-full px-3.5 py-1.5">
      🔥 {streak}일 연속 공부 중
    </p>
  )
}
