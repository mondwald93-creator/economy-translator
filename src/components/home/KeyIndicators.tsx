import { KeyIndicator, HealthCheckItem } from '@/types'

function getGrade(items: HealthCheckItem[]): string {
  const points: Record<string, number> = { good: 2, normal: 1, warning: 0 }
  const total = items.reduce((sum, item) => sum + (points[item.status] ?? 1), 0)
  const ratio = total / (items.length * 2)
  if (ratio >= 0.92) return 'A+'
  if (ratio >= 0.75) return 'A'
  if (ratio >= 0.58) return 'B+'
  if (ratio >= 0.42) return 'B'
  if (ratio >= 0.25) return 'C'
  return 'D'
}

function getGradeReason(items: HealthCheckItem[]): string {
  const warnings = items.filter(i => i.status === 'warning').map(i => i.category)
  const goods = items.filter(i => i.status === 'good').map(i => i.category)
  if (warnings.length > 0 && goods.length > 0) return `${goods.join('·')} 호조, ${warnings.join('·')} 주의`
  if (warnings.length > 0) return `${warnings.join('·')} 분야 주의가 필요해요`
  if (goods.length === items.length) return '전 분야 고르게 좋은 상태예요'
  if (goods.length > 0) return `${goods.join('·')} 분야가 좋은 상태예요`
  return '전반적으로 보통 수준이에요'
}

interface Props {
  indicators: KeyIndicator[] | null
  healthCheck: HealthCheckItem[] | null
  briefingAt?: string | null
}

export default function KeyIndicators({ indicators, healthCheck, briefingAt }: Props) {
  if (!indicators || indicators.length === 0) return null

  const grade = healthCheck && healthCheck.length > 0 ? getGrade(healthCheck) : null
  const reason = healthCheck && healthCheck.length > 0 ? getGradeReason(healthCheck) : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">

      {/* 왼쪽: 경제 컨디션 카드 */}
      {grade && (
        <div className="rounded-[16px] bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] border border-[#A7F3D0] p-5 flex flex-col justify-center gap-2">
          <p className="text-[11px] font-bold text-[#059669] uppercase tracking-wide">오늘 경제 컨디션</p>
          <p className="text-[48px] font-black leading-none text-[#065F46] tracking-tight">{grade}</p>
          {reason && <p className="text-xs text-[#059669] leading-relaxed">{reason}</p>}
        </div>
      )}

      {/* 오른쪽: 지표 그리드 — 모바일 2열, 데스크탑 카드 수에 맞게 열 수 조정 */}
      <div className={`grid gap-3 grid-cols-2 ${indicators.length === 4 ? 'sm:grid-cols-4' : indicators.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {indicators.map((item) => {
          const isUp = item.direction === 'up'
          const isDown = item.direction === 'down'
          return (
            <div key={item.name} className="bg-white rounded-[14px] border border-[#F3F4F6] p-4 flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-2">{item.name}</p>
              <p className="text-[22px] font-black text-[#111827] tracking-tight mb-1">{item.value}</p>
              <p className={`text-xs font-semibold flex items-center gap-1 ${isUp ? 'text-[#16A34A]' : isDown ? 'text-[#DC2626]' : 'text-[#9CA3AF]'}`}>
                {item.change}
              </p>
              <div className={`mt-2 h-[3px] rounded-full ${
                isUp ? 'bg-gradient-to-r from-[#22C55E] to-[#86EFAC]' :
                isDown ? 'bg-gradient-to-r from-[#EF4444] to-[#FCA5A5]' :
                'bg-[#E5E7EB]'
              }`} />
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-[#9CA3AF] text-right mt-1">
        실시간 지표 · AI 설명은 {briefingAt ?? '오전 9시'} 브리핑 기준
      </p>
    </div>
  )
}
