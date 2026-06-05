import { KeyIndicator } from '@/types'

interface Props {
  indicators: KeyIndicator[] | null
}

export default function KeyIndicators({ indicators }: Props) {
  if (!indicators || indicators.length === 0) {
    return (
      <section>
        <h2 className="text-base font-bold text-gray-800 mb-3">핵심 지표</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center py-8">
          <p className="text-gray-400 text-sm">지표 데이터를 준비 중이에요</p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-base font-bold text-gray-800 mb-3">핵심 지표</h2>
      <div className="grid grid-cols-2 gap-3">
        {indicators.map((item) => (
          <div key={item.name} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">{item.name}</p>
            <p className={`text-lg font-bold mb-1 ${
              item.direction === 'up' ? 'text-green-600' :
              item.direction === 'down' ? 'text-red-500' : 'text-gray-700'
            }`}>
              {item.value}
            </p>
            <p className={`text-xs font-medium mb-2 ${
              item.direction === 'up' ? 'text-green-500' :
              item.direction === 'down' ? 'text-red-400' : 'text-gray-400'
            }`}>
              {item.change}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">{item.easyExplanation}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
