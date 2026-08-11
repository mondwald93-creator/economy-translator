'use client'
import { useState } from 'react'
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

/** 펼쳤을 때 읽는 데 걸리는 대략 시간. 한국어 성인 평균 분당 500자 기준. */
function readTime(item: Top3AnalysisItem): string {
  const chars = stepDefinitions.reduce((n, { key }) => n + (item.steps[key]?.length ?? 0), 0)
  const sec = Math.round((chars / 500) * 60)
  return sec < 60 ? `${Math.max(20, Math.round(sec / 10) * 10)}초` : `${Math.round(sec / 60)}분`
}

interface Props {
  top3Analysis: Top3AnalysisItem[] | null
  /** 지난 브리핑에서는 '오늘의'가 아니라 '그날의'로 표시한다. */
  snapshot?: boolean
}

export default function Top3NewsSection({ top3Analysis, snapshot = false }: Props) {
  // 폰에서만 접는다. 큰 화면은 CSS(sm:block)로 항상 펼쳐져 데스크톱 화면은 그대로다.
  // 접어도 본문은 HTML에 그대로 있어(숨기기만 함) 검색 색인에는 영향이 없다.
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  if (!top3Analysis || top3Analysis.length === 0) return null

  return (
    // id: 헤드라인 "TOP3 바로 보기" 버튼의 도착 지점. scroll-mt는 고정 메뉴바(60px)에 안 가리게.
    <section id="top3" className="space-y-3 scroll-mt-[76px]">
      <h2 className="text-[11px] font-semibold text-ink-subtle uppercase tracking-widest">
        {snapshot ? '그날' : '오늘'} 알아야 할 3가지
      </h2>
      <div className="space-y-3 sm:space-y-4">
        {top3Analysis.map((item, idx) => {
          const open = openIdx === idx
          return (
            <div key={item.articleId} className="rounded-card bg-white border border-line overflow-hidden">
              {/* 카드 헤더 — 폰에서는 이 줄이 여닫는 버튼이 된다 */}
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : idx)}
                aria-expanded={open}
                className="w-full text-left flex items-start gap-3 px-4 py-3 bg-white sm:cursor-default"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-green text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] sm:text-base font-bold text-ink leading-snug">{item.title}</span>
                  {/* 한 줄 요약 + 예상 시간: 누르기 전에 무엇을 얻는지 알려준다 (폰 전용) */}
                  <span className="sm:hidden block text-[13px] font-semibold text-[#16A34A] mt-1">
                    → {item.steps.oneline} · {readTime(item)}
                  </span>
                </span>
                <span className={`sm:hidden text-ink-subtle text-[15px] font-bold transition-transform ${open ? 'rotate-45' : ''}`} aria-hidden>
                  +
                </span>
              </button>

              {/* 6단계 분석 — 폰에서는 위 버튼으로 여닫고, 큰 화면에서는 항상 보인다 */}
              <div className={`${open ? 'block' : 'hidden'} sm:block divide-y divide-line border-t border-line`}>
                {stepDefinitions.map(({ key, label }) => (
                  <div key={key} className="flex gap-3 px-4 py-2.5">
                    <span className="flex-shrink-0 text-[11px] font-semibold text-ink-subtle w-20 pt-0.5 whitespace-nowrap">
                      {label}
                    </span>
                    <p className="text-[15px] text-ink-muted leading-relaxed flex-1">
                      {item.steps[key]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
