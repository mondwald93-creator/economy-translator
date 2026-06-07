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
}

export default function EconomyHealthCheck({ healthCheck }: Props) {
  if (!healthCheck || healthCheck.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold text-ink-subtle uppercase tracking-widest">한국 경제 건강진단</h2>
      <div className="grid grid-cols-3 gap-2">
        {healthCheck.map((item) => {
          const config = statusConfig[item.status] ?? statusConfig.normal
          return (
            <div key={item.category} className={`rounded-card border border-line p-3 ${config.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-ink">
                  {categoryIcons[item.category]} {item.category}
                </span>
                <span className={`text-[10px] font-bold ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">{item.summary}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
