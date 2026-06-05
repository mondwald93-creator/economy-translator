import { Top3AnalysisItem } from '@/types'

type StepKey = keyof Top3AnalysisItem['steps']

const stepDefinitions: { key: StepKey; label: string }[] = [
  { key: 'oneline', label: '한 마디로' },
  { key: 'whatHappened', label: '무슨 일이야?' },
  { key: 'whyHappened', label: '왜 이런 일이?' },
  { key: 'myImpact', label: '나한테 영향은?' },
  { key: 'outlook', label: '앞으로 어떻게?' },
  { key: 'conclusion', label: '한 줄 결론' },
]

interface Props {
  top3Analysis: Top3AnalysisItem[] | null
}

export default function Top3NewsSection({ top3Analysis }: Props) {
  if (!top3Analysis || top3Analysis.length === 0) return null

  return (
    <section>
      <h2 className="notion-heading">오늘의 TOP 3 뉴스</h2>
      <div className="space-y-4">
        {top3Analysis.map((item, idx) => (
          <div key={item.articleId} className="border border-notion-border rounded-lg overflow-hidden">
            {/* 카드 헤더 */}
            <div className="flex items-start gap-3 px-4 py-3 bg-notion-hover">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <p className="text-sm font-semibold text-notion-text leading-snug">{item.title}</p>
            </div>
            {/* 6단계 분석 */}
            <div className="divide-y divide-notion-border">
              {stepDefinitions.map(({ key, label }) => (
                <div key={key} className="flex gap-3 px-4 py-2.5">
                  <span className="flex-shrink-0 text-[11px] font-semibold text-notion-muted w-[88px] pt-0.5">
                    {label}
                  </span>
                  <p className="text-xs text-notion-secondary leading-relaxed flex-1">
                    {item.steps[key]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
