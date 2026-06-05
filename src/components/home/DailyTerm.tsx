interface Props {
  dailyTerm: { term: string; explanation: string } | null
}

export default function DailyTerm({ dailyTerm }: Props) {
  if (!dailyTerm) {
    return (
      <section className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
        <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-2">
          오늘의 경제 용어
        </p>
        <p className="text-gray-500 text-sm">오늘의 경제 용어를 준비하고 있어요.</p>
      </section>
    )
  }

  return (
    <section className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
      <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-2">
        오늘의 경제 용어
      </p>
      <p className="text-base font-bold text-purple-800 mb-2">{dailyTerm.term}</p>
      <p className="text-sm text-gray-700 leading-relaxed">{dailyTerm.explanation}</p>
    </section>
  )
}
