import { HealthCheckItem } from '@/types'

// 경제 컨디션 등급·사유. KeyIndicators(데스크톱 카드)와 EconomyHealthCheck(폰 한 줄 요약)가 함께 쓴다.
export function getGrade(items: HealthCheckItem[]): string {
  const points: Record<string, number> = { good: 2, normal: 1, warning: 0 }
  const total = items.reduce((sum, item) => sum + (points[item.status] ?? 1), 0)
  const ratio = total / (items.length * 2)
  if (ratio >= 0.92) return 'A+'
  if (ratio >= 0.75) return 'A'
  if (ratio >= 0.58) return 'B+'
  if (ratio >= 0.42) return 'B'
  if (ratio >= 0.25) return 'C'
  return 'D'
}

export function getGradeReason(items: HealthCheckItem[]): string {
  const warnings = items.filter(i => i.status === 'warning').map(i => i.category)
  const goods = items.filter(i => i.status === 'good').map(i => i.category)
  if (warnings.length > 0 && goods.length > 0) return `${goods.join('·')} 호조, ${warnings.join('·')} 주의`
  if (warnings.length > 0) return `${warnings.join('·')} 분야 주의가 필요해요`
  if (goods.length === items.length) return '전 분야 고르게 좋은 상태예요'
  if (goods.length > 0) return `${goods.join('·')} 분야가 좋은 상태예요`
  return '전반적으로 보통 수준이에요'
}
