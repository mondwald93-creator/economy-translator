'use client'

import { useState, useMemo } from 'react'

interface EconomicEvent {
  date: string
  title: string
  category: '금리' | '지표' | '무역'
  description: string
  importance: 'high' | 'medium'
  country: '한국' | '미국'
}

const CAT_STYLE = {
  '금리': { badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  '지표': { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  '무역': { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
}

const EVENTS: EconomicEvent[] = [
  // 한국은행 금통위 (연 8회)
  { date: '2026-01-15', title: '한국은행 금통위', category: '금리', description: '기준금리 인상·동결·인하 중 결정. 대출금리·예금금리에 직접 영향.', importance: 'high', country: '한국' },
  { date: '2026-02-26', title: '한국은행 금통위', category: '금리', description: '기준금리 인상·동결·인하 중 결정. 대출금리·예금금리에 직접 영향.', importance: 'high', country: '한국' },
  { date: '2026-04-16', title: '한국은행 금통위', category: '금리', description: '기준금리 인상·동결·인하 중 결정. 대출금리·예금금리에 직접 영향.', importance: 'high', country: '한국' },
  { date: '2026-05-28', title: '한국은행 금통위', category: '금리', description: '기준금리 인상·동결·인하 중 결정. 대출금리·예금금리에 직접 영향.', importance: 'high', country: '한국' },
  { date: '2026-07-16', title: '한국은행 금통위', category: '금리', description: '기준금리 인상·동결·인하 중 결정. 대출금리·예금금리에 직접 영향.', importance: 'high', country: '한국' },
  { date: '2026-08-27', title: '한국은행 금통위', category: '금리', description: '기준금리 인상·동결·인하 중 결정. 대출금리·예금금리에 직접 영향.', importance: 'high', country: '한국' },
  { date: '2026-10-15', title: '한국은행 금통위', category: '금리', description: '기준금리 인상·동결·인하 중 결정. 대출금리·예금금리에 직접 영향.', importance: 'high', country: '한국' },
  { date: '2026-11-26', title: '한국은행 금통위', category: '금리', description: '기준금리 인상·동결·인하 중 결정. 대출금리·예금금리에 직접 영향.', importance: 'high', country: '한국' },

  // 미국 FOMC (연 8회)
  { date: '2026-01-28', title: '미국 FOMC', category: '금리', description: '미국 연준 기준금리 결정. 달러 가치와 원/달러 환율에 직접 영향.', importance: 'high', country: '미국' },
  { date: '2026-03-18', title: '미국 FOMC', category: '금리', description: '미국 연준 기준금리 결정. 달러 가치와 원/달러 환율에 직접 영향.', importance: 'high', country: '미국' },
  { date: '2026-04-29', title: '미국 FOMC', category: '금리', description: '미국 연준 기준금리 결정. 달러 가치와 원/달러 환율에 직접 영향.', importance: 'high', country: '미국' },
  { date: '2026-06-10', title: '미국 FOMC', category: '금리', description: '미국 연준 기준금리 결정. 달러 가치와 원/달러 환율에 직접 영향.', importance: 'high', country: '미국' },
  { date: '2026-07-29', title: '미국 FOMC', category: '금리', description: '미국 연준 기준금리 결정. 달러 가치와 원/달러 환율에 직접 영향.', importance: 'high', country: '미국' },
  { date: '2026-09-16', title: '미국 FOMC', category: '금리', description: '미국 연준 기준금리 결정. 달러 가치와 원/달러 환율에 직접 영향.', importance: 'high', country: '미국' },
  { date: '2026-10-28', title: '미국 FOMC', category: '금리', description: '미국 연준 기준금리 결정. 달러 가치와 원/달러 환율에 직접 영향.', importance: 'high', country: '미국' },
  { date: '2026-12-09', title: '미국 FOMC', category: '금리', description: '미국 연준 기준금리 결정. 달러 가치와 원/달러 환율에 직접 영향.', importance: 'high', country: '미국' },

  // 한국 GDP (분기별)
  { date: '2026-01-23', title: 'GDP 성장률 (4분기)', category: '지표', description: '2025년 4분기 경제성장률 발표. 경제가 얼마나 성장했는지 보여주는 핵심 지표.', importance: 'high', country: '한국' },
  { date: '2026-04-24', title: 'GDP 성장률 (1분기)', category: '지표', description: '2026년 1분기 경제성장률 발표. 경제가 얼마나 성장했는지 보여주는 핵심 지표.', importance: 'high', country: '한국' },
  { date: '2026-07-23', title: 'GDP 성장률 (2분기)', category: '지표', description: '2026년 2분기 경제성장률 발표. 경제가 얼마나 성장했는지 보여주는 핵심 지표.', importance: 'high', country: '한국' },
  { date: '2026-10-22', title: 'GDP 성장률 (3분기)', category: '지표', description: '2026년 3분기 경제성장률 발표. 경제가 얼마나 성장했는지 보여주는 핵심 지표.', importance: 'high', country: '한국' },

  // 한국 소비자물가지수 (매월)
  { date: '2026-01-02', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-02-03', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-03-03', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-04-02', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-05-04', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-06-02', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-07-02', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-08-04', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-09-02', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-10-02', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-11-03', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },
  { date: '2026-12-02', title: '소비자물가지수', category: '지표', description: '지난달 물가 상승률 발표. 생활비 변화와 금리 방향 예측에 활용.', importance: 'medium', country: '한국' },

  // 미국 소비자물가지수 (매월)
  { date: '2026-01-14', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-02-11', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-03-11', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-04-10', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-05-13', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-06-10', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-07-14', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-08-12', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-09-09', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-10-14', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-11-11', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },
  { date: '2026-12-09', title: '미국 소비자물가지수', category: '지표', description: '미국 물가 발표. 높으면 달러 강세·원화 약세 가능성. 연준 금리 결정에도 영향.', importance: 'high', country: '미국' },

  // 한국 무역수지 (매월)
  { date: '2026-01-15', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-02-16', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-03-16', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-04-15', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-05-15', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-06-15', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-07-15', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-08-17', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-09-15', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-10-15', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-11-16', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
  { date: '2026-12-15', title: '무역수지', category: '무역', description: '지난달 수출·수입 금액 발표. 흑자면 외화 유입, 적자면 외화 유출.', importance: 'medium', country: '한국' },
]

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

export default function CalendarPage() {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [countryFilter, setCountryFilter] = useState<'전체' | '한국' | '미국'>('전체')

  const monthEvents = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return EVENTS.filter(e =>
      e.date.startsWith(prefix) &&
      (countryFilter === '전체' || e.country === countryFilter)
    ).sort((a, b) => a.date.localeCompare(b.date))
  }, [year, month, countryFilter])

  const eventMap = useMemo(() => {
    const map: Record<string, EconomicEvent[]> = {}
    monthEvents.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [monthEvents])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const startDow = (firstDay.getDay() + 6) % 7 // Mon=0 ... Sun=6

    const days: (number | null)[] = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [year, month])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const selectedEvents = selectedDate ? (eventMap[selectedDate] ?? []) : []
  const upcomingEvents = monthEvents.filter(e => e.date >= todayStr).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="border-l-4 border-brand-green pl-4 py-1">
        <p className="section-label">달력</p>
        <h1 className="text-xl font-bold text-ink leading-snug">경제 달력</h1>
        <p className="text-sm text-ink-muted mt-1">
          금리 발표일, 물가 지표 등 주요 경제 일정을 미리 확인하세요
        </p>
      </div>

      {/* 국가 필터 */}
      <div className="flex gap-1.5">
        {(['전체', '한국', '미국'] as const).map(c => (
          <button
            key={c}
            onClick={() => { setCountryFilter(c); setSelectedDate(null) }}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              countryFilter === c
                ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0] font-bold'
                : 'bg-white text-ink-muted border-line hover:bg-surface'
            }`}
          >
            {c === '한국' ? '🇰🇷 한국' : c === '미국' ? '🇺🇸 미국' : '전체'}
          </button>
        ))}
      </div>

      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 text-sm rounded-md hover:bg-surface text-ink-muted transition-colors"
        >
          ← 이전
        </button>
        <h2 className="text-base font-bold text-ink">{year}년 {month + 1}월</h2>
        <button
          onClick={nextMonth}
          className="px-3 py-1.5 text-sm rounded-md hover:bg-surface text-ink-muted transition-colors"
        >
          다음 →
        </button>
      </div>

      {/* 달력 그리드 */}
      <div className="border border-line rounded-[14px] overflow-hidden bg-white">
        <div className="grid grid-cols-7 bg-surface border-b border-line">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-xs font-semibold py-2 ${
                i === 5 ? 'text-brand-green' : i === 6 ? 'text-red-400' : 'text-ink-muted'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-line">
          {calendarDays.map((day, i) => {
            if (!day) {
              return <div key={`e-${i}`} className="min-h-[48px] sm:min-h-[64px] bg-surface/50" />
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const events = eventMap[dateStr] ?? []
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const dow = i % 7

            return (
              <div
                key={dateStr}
                onClick={() => events.length > 0 && setSelectedDate(isSelected ? null : dateStr)}
                className={`min-h-[48px] sm:min-h-[64px] p-1 sm:p-1.5 transition-colors ${
                  events.length > 0 ? 'cursor-pointer hover:bg-surface' : ''
                } ${isSelected ? 'bg-[#F0FDF4]' : ''}`}
              >
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                    isToday
                      ? 'bg-brand-green text-white'
                      : dow === 6
                      ? 'text-red-400'
                      : dow === 5
                      ? 'text-brand-green'
                      : 'text-ink'
                  }`}
                >
                  {day}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {events.slice(0, 2).map((e, ei) => (
                    <div key={ei} className="flex items-center gap-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CAT_STYLE[e.category].dot}`} />
                      <span className="text-[10px] text-ink-muted truncate leading-tight">
                        {e.title.length > 8 ? e.title.slice(0, 7) + '…' : e.title}
                      </span>
                    </div>
                  ))}
                  {events.length > 2 && (
                    <span className="text-[10px] text-ink-subtle">+{events.length - 2}개 더</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 text-xs text-ink-muted">
        {(Object.entries(CAT_STYLE) as [keyof typeof CAT_STYLE, typeof CAT_STYLE[keyof typeof CAT_STYLE]][]).map(([cat, style]) => (
          <span key={cat} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
            {cat}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-red-500">★ 중요 일정</span>
      </div>

      {/* 선택된 날짜 상세 */}
      {selectedDate && selectedEvents.length > 0 && (
        <div className="border border-[#BBF7D0] rounded-[14px] p-4 bg-[#F0FDF4]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-ink">
              {parseInt(selectedDate.split('-')[1])}월 {parseInt(selectedDate.split('-')[2])}일 일정
            </p>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-ink-subtle hover:text-ink-muted"
            >
              닫기 ✕
            </button>
          </div>
          <div className="space-y-2.5">
            {selectedEvents.map((e, i) => (
              <div key={i} className="bg-white rounded-[14px] border border-line p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CAT_STYLE[e.category].badge}`}>
                    {e.category}
                  </span>
                  <span className="text-[11px] text-ink-subtle">
                    {e.country === '한국' ? '🇰🇷 한국' : '🇺🇸 미국'}
                  </span>
                  {e.importance === 'high' && (
                    <span className="text-[10px] text-red-500 font-medium">★ 중요</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-ink">{e.title}</p>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">{e.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 이달의 일정 목록 */}
      <div>
        <p className="text-sm font-bold text-ink mb-3">
          {upcomingEvents.length > 0 ? '다가오는 일정' : `${month + 1}월 전체 일정`}
        </p>
        {monthEvents.length === 0 ? (
          <div className="border border-line rounded-[14px] p-8 text-center bg-white">
            <p className="text-sm text-ink-subtle">이달 일정이 없어요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(upcomingEvents.length > 0 ? upcomingEvents : monthEvents).map((e, i) => {
              const [, m, d] = e.date.split('-')
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(e.date)}
                  className="flex items-start gap-3 p-3 border border-line rounded-[14px] bg-white hover:bg-surface cursor-pointer transition-colors"
                >
                  <div className="flex-shrink-0 text-center w-10">
                    <span className="text-[10px] text-ink-subtle block">{parseInt(m)}월</span>
                    <span className="text-lg font-bold text-ink leading-tight">{parseInt(d)}</span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CAT_STYLE[e.category].badge}`}>
                        {e.category}
                      </span>
                      <span className="text-[10px] text-ink-subtle">
                        {e.country === '한국' ? '🇰🇷' : '🇺🇸'}
                      </span>
                      {e.importance === 'high' && (
                        <span className="text-[10px] text-red-500 font-medium">★</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-ink">{e.title}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
