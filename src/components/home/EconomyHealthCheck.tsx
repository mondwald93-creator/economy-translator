import { HealthCheckItem } from '@/types'

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
  if (!healthCheck || healthCheck.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold text-ink-subtle uppercase tracking-widest">{snapshot ? '그날' : '지금'} 한국 경제, 어떤 상태일까?</h2>
      {/* 폰 2단(칸이 좁으면 글이 4~5자마다 꺾임) · 큰 화면은 기존 3단 유지 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
