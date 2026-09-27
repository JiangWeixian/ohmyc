/** Compact recorded token totals using the same decimal units as the native tray. */
export function formatTokens(value: number): string {
  const units = ['', 'K', 'M', 'B', 'T', 'P', 'E']
  let scaled = Math.max(0, value)
  let unit = 0
  while (scaled >= 999.95 && unit < units.length - 1) {
    scaled /= 1000
    unit += 1
  }
  return `${Math.round(scaled * 10) / 10}${units[unit]}`
}
