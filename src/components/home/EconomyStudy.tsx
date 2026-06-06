interface Props {
  dailyTerm: { term: string; explanation: string } | null
}

export default function EconomyStudy({ dailyTerm }: Props) {
  if (!dailyTerm) return null

  return (
    <section>
      <div className="bg-ink rounded-[16px] py-6 px-7 flex items-center justify-between gap-6">
        <div>
          <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">오늘의 경제용어</p>
          <p className="text-[20px] font-black text-[#F9FAFB] mb-2">{dailyTerm.term}</p>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed max-w-[480px]">{dailyTerm.explanation}</p>
        </div>
        <a
          href="/dictionary"
          className="flex-shrink-0 bg-brand-green text-white text-xs font-bold px-[18px] py-2 rounded-lg whitespace-nowrap"
        >
          용어 더 보기 →
        </a>
      </div>
    </section>
  )
}
