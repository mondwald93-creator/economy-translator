import ShareButtons from './ShareButtons'

interface Props {
  headline: string | null
  summary: string | null
  /** 지난 브리핑 페이지용. 넘기면 오늘 날짜 대신 이 날짜를 보여준다. */
  dateLabel?: string | null
  /** 지난 브리핑에서는 "오늘 읽으면 하루치 완료" 응원 배너를 숨긴다. */
  showStreak?: boolean
  /** 공유할 주소. 안 넘기면 홈 주소를 공유한다. */
  shareUrl?: string
  /** 공유할 제목. 안 넘기면 사이트 기본 문구를 쓴다. */
  shareTitle?: string
}

export default function HeadlineBanner({ headline, summary, dateLabel, showStreak = true, shareUrl, shareTitle }: Props) {
  if (!headline) return null

  const today = new Date()
  const weekday = today.toLocaleDateString('ko-KR', { weekday: 'long', timeZone: 'Asia/Seoul' })
  const date = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
  const dateStr = dateLabel ?? `${weekday} · ${date}`

  const lines = headline.split('\n').filter(Boolean)
  const firstLine = lines[0] ?? headline
  const secondLine = lines[1] ?? null

  const leadText = (() => {
    if (!summary) return null
    const firstParagraph = summary.split(/\n+/).find(p => p.trim().length > 0) ?? summary
    // 숫자 사이 점(8.18% 등)은 문장 끝으로 인식하지 않음
    const parts = firstParagraph.split(/\.(?!\d)\s*/)
    const twoSentences = parts.slice(0, 2).join('. ')
    return (twoSentences + (parts.length > 2 ? '.' : '')).trim() || firstParagraph
  })()

  return (
    <div>
      {/* 포지셔닝 문구 — 처음 온 사람이 "나 위한 거네" 느끼게 */}
      <p className="text-[12px] font-semibold text-[#16A34A] mb-2 sm:mb-3 tracking-wide">
        📰 매일 아침 5분 · 경제 초보를 위한 브리핑
      </p>

      {/* 날짜 + 새로고침 안내 */}
      <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-5">
        <span className="bg-[#F3F4F6] text-[#6B7280] text-xs font-medium px-3 py-1 rounded-md">
          {dateStr}
        </span>
        {showStreak && (
          <span className="flex text-[11px] text-[#9CA3AF] items-center gap-1">
            <span className="text-[13px]">↻</span> 매일 아침 9시 새 브리핑
          </span>
        )}
      </div>

      {/* 헤드라인 */}
      <h1
        className="font-black text-[#111827] text-[22px] sm:text-[30px] lg:text-[36px] leading-tight mb-3 sm:mb-4"
        style={{ letterSpacing: '-0.8px' }}
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
          className="text-[#4B5563] text-base sm:text-[17px] mb-4 sm:mb-6"
          style={{ lineHeight: 1.8, borderLeft: '3px solid #22C55E', paddingLeft: 16 }}
        >
          {leadText}
        </p>
      )}

      {/* 첫 화면에서 오늘 핵심(TOP3)으로 내려가는 길 (홈에서만) */}
      {showStreak && (
        <a
          href="#top3"
          className="inline-flex items-center gap-1.5 bg-brand-green text-white text-sm font-bold px-5 py-2.5 rounded-[12px] mb-4 sm:mb-6 hover:bg-[#15803d] transition-colors"
        >
          📌 오늘의 TOP3 뉴스 바로 보기 ↓
        </a>
      )}

      {/* 완독 배너·연속 방문 카운터는 맨 아래 EndCard로 옮겼다(2026-08-11).
          맨 위에 있으면 '완료'가 아니라 '예고'로 읽혀 완독의 기분이 생기지 않았다. */}

      {/* 공유 버튼 */}
      <ShareButtons url={shareUrl} title={shareTitle} />
    </div>
  )
}
