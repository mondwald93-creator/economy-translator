import { KeyIndicator } from '@/types'

interface Props {
  indicators: KeyIndicator[] | null
}

export default function KeyIndicators({ indicators }: Props) {
  if (!indicators || indicators.length === 0) {
    return (
      <section>
        <h2 className="notion-heading">핵심 지표</h2>
        <div className="notion-card text-center py-8">
          <p className="text-notion-muted text-sm">지표 데이터를 준비 중이에요</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="notion-heading">핵심 지표</h2>
      <div className="grid grid-cols-2 gap-2">
        {indicators.map((item) => (
          <div key={item.name} className="bg-white rounded-lg border border-notion-border p-3">
            <p className="text-[11px] text-notion-muted mb-1">{item.name}</p>
            <p className={`text-lg font-bold mb-0.5 ${
              item.direction === 'up' ? 'text-emerald-600' :
              item.direction === 'down' ? 'text-red-500' : 'text-notion-text'
            }`}>
              {item.value}
            </p>
            <p className={`text-[11px] font-medium mb-2 ${
              item.direction === 'up' ? 'text-emerald-500' :
              item.direction === 'down' ? 'text-red-400' : 'text-notion-muted'
            }`}>
              {item.change}
            </p>
            <p className="text-xs text-notion-secondary leading-relaxed">{item.easyExplanation}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
