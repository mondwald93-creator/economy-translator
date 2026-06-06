interface Props {
  headline: string | null
  summary: string | null
}

export default function HeadlineBanner({ headline, summary }: Props) {
  if (!headline) return null

  const today = new Date()
  const weekday = today.toLocaleDateString('ko-KR', { weekday: 'long' })
  const date = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const dateStr = `${weekday} · ${date}`

  const lines = headline.split('\n').filter(Boolean)
  const firstLine = lines[0] ?? headline
  const secondLine = lines[1] ?? null

  const leadText = (() => {
    if (!summary) return null
    const firstParagraph = summary.split(/\n+/).find(p => p.trim().length > 0) ?? summary
    const sentences = firstParagraph.match(/[^。.!?]*[。.!?]+\s*/g) ?? [firstParagraph]
    return sentences.slice(0, 2).join('').trim() || firstParagraph
  })()

  return (
    <div>
      {/* 날짜 + 새로고침 안내 */}
      <div className="flex items-center gap-3 mb-5">
        <span className="bg-[#F3F4F6] text-[#6B7280] text-xs font-medium px-3 py-1 rounded-md">
          {dateStr}
        </span>
        <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
          <span className="text-[13px]">↻</span> 내일 오전 9시에 새 브리핑이 올라와요
        </span>
      </div>

      {/* 헤드라인 */}
      <h1
        className="font-black text-[#111827]"
        style={{ fontSize: 36, lineHeight: 1.25, letterSpacing: '-1.2px', marginBottom: 18 }}
      >
        {firstLine}
        {secondLine && (
          <>
            <br />
            <em style={{ fontStyle: 'normal', color: '#16A34A' }}>{secondLine}</em>
          </>
        )}
      </h1>

      {/* 리드 문단 — 첫 번째 문단만 */}
      {leadText && (
        <p
          className="text-[#4B5563]"
          style={{ fontSize: 15, lineHeight: 1.8, borderLeft: '3px solid #22C55E', paddingLeft: 16, maxWidth: 640, marginBottom: 32 }}
        >
          {leadText}
        </p>
      )}

      {/* 긴박감 배너 */}
      <div
        className="flex items-center gap-3 text-[#92400E]"
        style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 16px', fontSize: 13, marginBottom: 32 }}
      >
        <span style={{ fontSize: 16 }}>⏰</span>
        <span><strong className="font-bold">오늘의 브리핑</strong> — 내일 오전 9시에 새 내용으로 바뀌어요</span>
        <span className="ml-auto font-semibold text-[#B45309] text-xs">D-day</span>
      </div>
    </div>
  )
}
