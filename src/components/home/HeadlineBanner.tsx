interface Props {
  headline: string | null
}

export default function HeadlineBanner({ headline }: Props) {
  if (!headline) return null

  return (
    <div className="border-l-4 border-blue-500 pl-4 py-1">
      <p className="section-label">오늘의 경제</p>
      <p className="text-xl font-bold text-notion-text leading-snug">{headline}</p>
    </div>
  )
}
