/** "2026-11-15T15:00" -> "3 PM". Reads the string directly, so it stays in mountain time. */
export function hourLabel(localIso: string): string {
  const hour = Number(localIso.slice(11, 13))
  if (!Number.isFinite(hour)) return ''
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12} ${hour < 12 ? 'AM' : 'PM'}`
}

/** "Updated 4 min ago" wording. */
export function agoLabel(fromIso: string, nowMs: number): string {
  const minutes = Math.floor((nowMs - Date.parse(fromIso)) / 60_000)
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}
