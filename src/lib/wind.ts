/**
 * Wind bands, by gust speed in mph. Rough guides for riders, not Mammoth's
 * rules for running lifts. Change the cutoffs here and nowhere else.
 */
export type WindBandId = 'calm' | 'windy' | 'strong'

export interface WindBand {
  id: WindBandId
  /** Lowest gust (mph, inclusive) in this band. */
  minGustMph: number
  /** One word, shown under the gust and read out for each hour. */
  label: string
  /** What the band can mean for the lifts, for the band key in the info dialog; empty when there is nothing to say. */
  lifts: string
}

export const WIND_BANDS: readonly WindBand[] = [
  { id: 'calm', minGustMph: 0, label: 'Calm', lifts: '' },
  { id: 'windy', minGustMph: 20, label: 'Windy', lifts: 'upper lifts may hold' },
  { id: 'strong', minGustMph: 40, label: 'Strong', lifts: 'expect upper-mountain holds' },
]

/**
 * Top of the band meter's scale: the last band drawn as wide as the one
 * before it (60 mph for cutoffs of 20 and 40). Gusts above it sit at the end.
 */
export const BAND_SCALE_MAX_MPH = (() => {
  const last = WIND_BANDS[WIND_BANDS.length - 1]!.minGustMph
  const before = WIND_BANDS[WIND_BANDS.length - 2]?.minGustMph ?? 0
  return last + (last - before)
})()

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

/** Whole mph, the way every number is shown. */
export function mph(value: number): number {
  return Math.round(value)
}

/**
 * Sustained wind (not gust) at which the Mountain Forecast draws its "windy"
 * icon, when nothing is falling. The National Weather Service calls 25 to 40
 * mph sustained "windy" in its forecast wording; below that the sky icon says more.
 */
export const WINDY_SUSTAINED_MPH = 25
