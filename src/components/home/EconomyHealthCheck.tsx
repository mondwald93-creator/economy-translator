import { HealthCheckItem } from '@/types'

const statusConfig = {
  good:    { label: '좋음', color: 'text-emerald-600', bg: 'bg-emerald-50',  dot: 'bg-emerald-500' },
  normal:  { label: '보통', color: 'text-gray-500',    bg: 'bg-gray-50',     dot: 'bg-gray-400'    },
  warning: { label: '주의', color: 'text-amber-600',   bg: 'bg-amber-50',    dot: 'bg-amber-500'   },
}

const categoryIcons: Record<string, string> = {
  '물가': '🛒',
  '소비': '💳',
  '수출': '🚢',
  '고용': '👷',
  '부동산': '🏠',
  '금융': '📈',
}

interface Props {
  healthCheck: HealthCheckItem[] | null
}

export default function EconomyHealthCheck({ healthCheck }: Props) {
  if (!healthCheck || healthCheck.length === 0) return null

  return (
    <section>
      <h2 className="notion-heading">한국 경제 건강진단</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {healthCheck.map((item) => {
          const config = statusConfig[item.status] ?? statusConfig.normal
          return (
            <div key={item.category} className={`rounded-lg p-3 ${config.bg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-notion-text">
                  {categoryIcons[item.category]} {item.category}
                </span>
                <span className={`text-[11px] font-semibold ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-xs text-notion-secondary leading-relaxed">{item.summary}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
