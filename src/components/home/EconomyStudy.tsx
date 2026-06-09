interface Props {
  dailyTerm: { term: string; explanation: string } | null
}

export default function EconomyStudy({ dailyTerm }: Props) {
  if (!dailyTerm) return null

  return (
    <section>
      <div className="bg-ink rounded-[16px] py-6 px-6 sm:px-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">오늘 알면 좋은 경제 단어</p>
          <p className="text-[20px] font-black text-[#F9FAFB] mb-2">{dailyTerm.term}</p>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed">{dailyTerm.explanation}</p>
        </div>
        <a
          href="/dictionary"
          className="sm:flex-shrink-0 bg-brand-green text-white text-xs font-bold px-[18px] py-2 rounded-lg text-center sm:whitespace-nowrap"
        >
          단어 더 보기 →
        </a>
      </div>
    </section>
  )
}
