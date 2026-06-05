interface Props {
  dailyTerm: { term: string; explanation: string } | null
}

export default function EconomyStudy({ dailyTerm }: Props) {
  if (!dailyTerm) return null

  return (
    <section>
      <h2 className="notion-heading">오늘의 경제공부</h2>
      <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5">📚</span>
          <div>
            <p className="text-base font-bold text-purple-800 mb-1.5">{dailyTerm.term}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{dailyTerm.explanation}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
