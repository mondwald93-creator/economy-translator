interface Props {
  summary: string
}

export default function DailyBriefing({ summary }: Props) {
  return (
    <section className="bg-blue-600 text-white rounded-2xl p-5">
      <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-2">
        오늘의 경제 브리핑
      </p>
      <p className="text-lg font-semibold leading-relaxed text-blue-100">
        {summary}
      </p>
    </section>
  )
}
