import type { WindHour } from '../types'

/**
 * Wind bands, by gust speed in mph. Rough guides for riders, not Mammoth's
 * rules for running lifts. Change the cutoffs here and nowhere else.
 */
export type WindBandId = 'calm' | 'windy' | 'strong'

export interface WindBand {
  id: WindBandId
  /** Lowest gust (mph, inclusive) in this band. */
  minGustMph: number
  /** One word, shown on the map key and hourly cells. */
  short: string
  /** Full label shown in the widget. */
  label: string
}

export const WIND_BANDS: readonly WindBand[] = [
  { id: 'calm', minGustMph: 0, short: 'Calm', label: 'Calm' },
  { id: 'windy', minGustMph: 20, short: 'Windy', label: 'Windy, upper lifts may hold' },
  { id: 'strong', minGustMph: 40, short: 'Strong', label: 'Strong, expect upper-mountain holds' },
]

export function bandForGust(gustMph: number): WindBand {
  let band = WIND_BANDS[0]!
  for (const b of WIND_BANDS) if (gustMph >= b.minGustMph) band = b
  return band
}

const COMPASS = [
  ['N', 'north'],
  ['NNE', 'north-northeast'],
  ['NE', 'northeast'],
  ['ENE', 'east-northeast'],
  ['E', 'east'],
  ['ESE', 'east-southeast'],
  ['SE', 'southeast'],
  ['SSE', 'south-southeast'],
  ['S', 'south'],
  ['SSW', 'south-southwest'],
  ['SW', 'southwest'],
  ['WSW', 'west-southwest'],
  ['W', 'west'],
  ['WNW', 'west-northwest'],
  ['NW', 'northwest'],
  ['NNW', 'north-northwest'],
] as const

function compassIndex(deg: number): number {
  const normal = ((deg % 360) + 360) % 360
  return Math.round(normal / 22.5) % 16
}

/** 16-point compass abbreviation: 270 -> "W". */
export function compassPoint(deg: number): string {
  return COMPASS[compassIndex(deg)]![0]
}

/** Spoken form for screen readers: 270 -> "west". */
export function compassWord(deg: number): string {
  return COMPASS[compassIndex(deg)]![1]
}

/** Compass bearing the wind is blowing toward. */
export function blowingToward(dirFromDeg: number): number {
  return (dirFromDeg + 180) % 360
}

/** The hour with the highest gust; the earliest one wins a tie. */
export function peakGust(hours: readonly WindHour[]): WindHour | null {
  let peak: WindHour | null = null
  for (const h of hours) if (!peak || h.gustMph > peak.gustMph) peak = h
  return peak
}

/** Whole mph, the way every number is shown. */
export function mph(value: number): number {
  return Math.round(value)
}
