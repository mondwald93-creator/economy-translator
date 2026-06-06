import { Top3AnalysisItem } from '@/types'

type StepKey = keyof Top3AnalysisItem['steps']

const stepDefinitions: { key: StepKey; label: string }[] = [
  { key: 'oneline',     label: '한 마디로' },
  { key: 'whatHappened', label: '무슨 일?' },
  { key: 'whyHappened', label: '왜?' },
  { key: 'myImpact',   label: '나한테 영향' },
  { key: 'outlook',    label: '앞으로는' },
  { key: 'conclusion', label: '한 줄 결론' },
]

interface Props {
  top3Analysis: Top3AnalysisItem[] | null
}

export default function Top3NewsSection({ top3Analysis }: Props) {
  if (!top3Analysis || top3Analysis.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold text-ink-subtle uppercase tracking-widest">오늘의 TOP 3 뉴스</h2>
      <div className="space-y-4">
        {top3Analysis.map((item, idx) => (
          <div key={item.articleId} className="rounded-card border border-line overflow-hidden">
            {/* 카드 헤더 */}
            <div className="flex items-start gap-3 px-4 py-3 bg-surface border-b border-line">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-green text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                {idx + 1}
              </span>
              <p className="text-sm font-bold text-ink leading-snug">{item.title}</p>
            </div>
            {/* 6단계 분석 */}
            <div className="divide-y divide-line">
              {stepDefinitions.map(({ key, label }) => (
                <div key={key} className="flex gap-3 px-4 py-2.5">
                  <span className="flex-shrink-0 text-[11px] font-semibold text-ink-subtle w-20 pt-0.5 whitespace-nowrap">
                    {label}
                  </span>
                  <p className="text-xs text-ink-muted leading-relaxed flex-1">
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
