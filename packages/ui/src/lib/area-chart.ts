import type { HeatmapPoint } from '@/hooks/use-timeline'

export function getAreaBaseValue(points: readonly HeatmapPoint[]): number {
  let minimum = Number.POSITIVE_INFINITY
  for (const point of points) {
    if (point.value > 0) {
      minimum = Math.min(minimum, point.value)
    }
  }
  return Number.isFinite(minimum) ? minimum : 0
}
