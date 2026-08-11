import { KeyIndicator, HealthCheckItem } from '@/types'
import { getGrade, getGradeReason } from '@/lib/healthGrade'

interface Props {
  indicators: KeyIndicator[] | null
  healthCheck: HealthCheckItem[] | null
  briefingAt?: string | null
  /** 지난 브리핑은 실시간 시세가 아니라 그날 저장된 값이다. */
  snapshot?: boolean
}

export default function KeyIndicators({ indicators, healthCheck, briefingAt, snapshot = false }: Props) {
  if (!indicators || indicators.length === 0) return null

  const grade = healthCheck && healthCheck.length > 0 ? getGrade(healthCheck) : null
  const reason = healthCheck && healthCheck.length > 0 ? getGradeReason(healthCheck) : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">

      {/* 폰 전용: 지표를 가는 띠 한 줄로. 숫자는 배경 정보라 첫 화면 세로 공간을 덜 쓴다.
          (큰 화면은 아래 카드 그리드 그대로 — 데스크톱 화면은 바뀌지 않는다) */}
      <div className="sm:hidden">
        <div className="relative">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide bg-white border border-[#F3F4F6] rounded-[14px] px-3 py-2.5 pr-8 whitespace-nowrap">
          {indicators.map((item) => {
            const isUp = item.direction === 'up'
            const isDown = item.direction === 'down'
            return (
              <span key={item.name} className="text-[13px] text-[#6B7280] flex-shrink-0">
                {item.name} <b className="font-extrabold text-[#111827]">{item.value}</b>{' '}
                <span className={isUp ? 'text-[#DC2626]' : isDown ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}>
                  {item.change}
                </span>
              </span>
            )
          })}
        </div>
          <div className="pointer-events-none absolute right-px inset-y-px w-10 rounded-r-[14px] bg-gradient-to-l from-white via-white/85 to-transparent flex items-center justify-end pr-2 text-ink-subtle font-bold">
            ›
          </div>
        </div>
        <p className="text-[11px] text-[#9CA3AF] mt-1.5">
          {snapshot ? `${briefingAt ?? '작성 당시'} 기준 저장값` : '숫자는 실시간 · 옆으로 밀면 더 있어요'}
        </p>
      </div>

      {/* 왼쪽: 경제 컨디션 카드 */}
      {grade && (
        <div className="hidden sm:flex rounded-[16px] bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] border border-[#A7F3D0] p-5 flex-col justify-center gap-2">
          <p className="text-[11px] font-bold text-[#059669] uppercase tracking-wide">{snapshot ? '그날 경제 컨디션' : '오늘 경제 컨디션'}</p>
          <p className="text-[48px] font-black leading-none text-[#065F46] tracking-tight">{grade}</p>
          {reason && <p className="text-xs text-[#059669] leading-relaxed">{reason}</p>}
        </div>
      )}

      {/* 오른쪽: 지표 그리드 + 타임스탬프 — grade가 없으면 전체 폭 사용 (폰에서는 위 띠가 대신한다) */}
      <div className={`hidden sm:block ${!grade ? 'sm:col-span-full' : ''}`}>
        <div className={`grid gap-3 grid-cols-2 ${indicators.length === 4 ? 'sm:grid-cols-4' : indicators.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {indicators.map((item) => {
            const isUp = item.direction === 'up'
            const isDown = item.direction === 'down'
            return (
              <div key={item.name} className="bg-white rounded-[14px] border border-[#F3F4F6] p-4 flex flex-col shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wide mb-2">{item.name}</p>
                <p className="text-[22px] font-black text-[#111827] tracking-tight mb-1">{item.value}</p>
                {/* 한국 금융앱 관습: 상승=빨강, 하락=파랑 (2026-06-11 사용자 결정) */}
                <p className={`text-xs font-semibold flex items-center gap-1 ${isUp ? 'text-[#DC2626]' : isDown ? 'text-[#2563EB]' : 'text-[#9CA3AF]'}`}>
                  {item.change}
                </p>
                <div className={`mt-2 h-[3px] rounded-full ${
                  isUp ? 'bg-gradient-to-r from-[#EF4444] to-[#FCA5A5]' :
                  isDown ? 'bg-gradient-to-r from-[#3B82F6] to-[#93C5FD]' :
                  'bg-[#E5E7EB]'
                }`} />
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-[#9CA3AF] text-right mt-1">
          {snapshot
            ? `${briefingAt ?? '작성 당시'} 기준으로 저장된 숫자예요`
            : `숫자는 실시간 · 헤드라인·해설은 직전 거래일 마감 기준${briefingAt ? ` (${briefingAt} 작성)` : ''}`}
        </p>
      </div>
    </div>
  )
}
