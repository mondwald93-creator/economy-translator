'use client'
import { useState } from 'react'
import { HealthCheckItem } from '@/types'
import { getGrade, getGradeReason } from '@/lib/healthGrade'

const statusConfig = {
  good:    { label: '좋음', color: 'text-up',       bg: 'bg-emerald-50', points: 2 },
  normal:  { label: '보통', color: 'text-ink-muted', bg: 'bg-white',      points: 1 },
  warning: { label: '주의', color: 'text-amber-600', bg: 'bg-amber-50',   points: 0 },
}

const categoryIcons: Record<string, string> = {
  '물가': '🛒', '소비': '💳', '수출': '🚢', '고용': '👷', '부동산': '🏠', '금융': '📈',
}

interface Props {
  healthCheck: HealthCheckItem[] | null
  /** 지난 브리핑에서는 '지금'이 아니라 '그날'로 표시한다. */
  snapshot?: boolean
}

export default function EconomyHealthCheck({ healthCheck, snapshot = false }: Props) {
  // 폰에서만 접는다. 큰 화면은 CSS(sm:grid)로 항상 펼쳐져 있어 이 값의 영향을 받지 않는다.
  const [open, setOpen] = useState(false)

  if (!healthCheck || healthCheck.length === 0) return null

  const grade = getGrade(healthCheck)
  const reason = getGradeReason(healthCheck)

  return (
    <section className="space-y-3">
      <h2 className="hidden sm:block text-[11px] font-semibold text-ink-subtle uppercase tracking-widest">
        {snapshot ? '그날' : '지금'} 한국 경제, 어떤 상태일까?
      </h2>

      {/* 폰: 등급 한 줄 요약 → 누르면 6칸이 펼쳐진다 */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="sm:hidden w-full flex items-center gap-3 bg-white border border-line rounded-card px-3.5 py-3 text-left"
      >
        <span className="text-[22px] font-black leading-none text-[#065F46]">{grade}</span>
        <span className="flex-1 text-[13px] text-ink-muted leading-snug">
          {snapshot ? '그날' : '오늘'} 경제 컨디션 · {reason}
        </span>
        <span className={`text-ink-subtle text-[15px] font-bold transition-transform ${open ? 'rotate-45' : ''}`} aria-hidden>
          +
        </span>
      </button>

      {/* 폰에서는 위 버튼으로 여닫고, 큰 화면(sm 이상)에서는 항상 3단으로 보인다 */}
      <div className={`${open ? 'grid' : 'hidden'} sm:grid grid-cols-2 sm:grid-cols-3 gap-2`}>
        {healthCheck.map((item) => {
          const config = statusConfig[item.status] ?? statusConfig.normal
          return (
            <div key={item.category} className={`rounded-card border border-line p-3 ${config.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-ink">
                  {categoryIcons[item.category]} {item.category}
                </span>
                <span className={`text-[11px] font-bold ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-[13px] text-ink-muted leading-relaxed">{item.summary}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
