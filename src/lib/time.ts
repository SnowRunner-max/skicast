import { MOUNTAIN_TIME_ZONE } from '../config'

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

const HOUR_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: MOUNTAIN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

/** The hour containing `ms`, in mountain time, as "2026-11-15T15:00". */
export function mountainHour(ms: number): string {
  const part = Object.fromEntries(HOUR_PARTS.formatToParts(new Date(ms)).map((p) => [p.type, p.value]))
  return `${part.year}-${part.month}-${part.day}T${part.hour}:00`
}
