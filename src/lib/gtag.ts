// GA 이벤트 전송 헬퍼 — 버튼 클릭 등 사용자 행동을 GA에 기록
// GA 스크립트가 아직 안 떴거나 차단된 환경에서는 조용히 무시

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(name: string, params?: Record<string, string | number>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}
