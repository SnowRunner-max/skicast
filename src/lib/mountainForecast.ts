import type { BeaconForecast, ForecastHour, Station } from '../types'
import type { Current, Source } from './current'
import { skyLabel, type NwsWeather } from './sky'
import { isDaylight } from './sun'
import { hourLabel } from './time'
import { WINDY_SUSTAINED_MPH } from './wind'

/**
 * The beacon whose forecast stands for the whole mountain. Mountain weather is
 * broader than any one station (cloud on the summit usually means cloud
 * everywhere), and the summit's NWS grid square also covers Gold Rush and
 * Cloud Nine, so its sky is the mountain's sky and its wind is the one that
 * decides whether the upper lifts run.
 */
export const MOUNTAIN_BEACON_ID = 'summit'

/** How many hours after this one the Mountain Forecast shows. */
export const MOUNTAIN_NEXT_HOURS = 4

export type SkyIconId =
  | 'clear-day'
  | 'clear-night'
  | 'partly-day'
  | 'partly-night'
  | 'cloudy'
  | 'light-snow'
  | 'heavy-snow'
  | 'rain'
  | 'thunder'
  | 'fog'
  | 'windy'
  /** No cloud cover in the forecast and nothing falling. */
  | 'unknown'

export interface MountainSlot {
  /** Local mountain hour, "2026-11-15T15:00". */
  time: string
  /** "Now", or the hour: "3 PM". */
  label: string
  icon: SkyIconId
  /** The sky in words, for screen readers and the tooltip: "Sunny", "Chance of light snow", "Mostly cloudy and windy". */
  sky: string
  /** Sustained wind, not gust. */
  windMph: number
  /** Whether the wind was measured at the summit or is the forecast's. The sky is always the forecast's. */
  windSource: Source
}

export interface MountainForecast {
  /** The station the current wind was measured at, when it was measured. */
  windStation: Station | null
  now: MountainSlot
  /** The next hours, up to MOUNTAIN_NEXT_HOURS: fewer when the forecast runs out. */
  next: MountainSlot[]
}

// Kinds of NWS weather, by what the icon shows. Snow wins over rain when both
// are forecast (a rain-snow mix reads as snow to a skier); blowing snow is
// wind, not snowfall, so it is left to the wind test.
const THUNDER = /thunder/
const SNOW = /^(snow|snow_showers|snow_grains|snow_pellets|ice_pellets|ice_crystals|sleet)$/
const RAIN = /rain|drizzle|hail/
const FOG = /fog|mist|haze|smoke/
/** Moderate snow is an inch an hour or so: heavy, as far as a day on the hill goes. */
const HEAVY = new Set(['moderate', 'heavy'])

/** What is falling, or null for nothing. A "slight chance" is not drawn: the words still say it. */
function falling(weather: readonly NwsWeather[]): SkyIconId | null {
  const kinds = weather.filter((w) => typeof w?.weather === 'string' && w.coverage !== 'slight_chance')
  const has = (re: RegExp) => kinds.filter((w) => re.test(w.weather!))
  if (has(THUNDER).length) return 'thunder'
  const snow = has(SNOW)
  if (snow.length) return snow.some((w) => w.intensity && HEAVY.has(w.intensity)) ? 'heavy-snow' : 'light-snow'
  if (has(RAIN).length) return 'rain'
  if (has(FOG).length) return 'fog'
  return null
}

/** NWS words for a clear sky by day are "sunny" and "mostly sunny". */
function dayWords(sky: string, daylight: boolean): string {
  if (!daylight) return sky
  if (sky === 'Clear') return 'Sunny'
  if (sky === 'Mostly clear') return 'Mostly sunny'
  return sky
}

/**
 * The icon and words for one hour. Something falling comes first; then strong
 * sustained wind; then the cloud cover, with clear and partly cloudy drawn as
 * a sun by day and a moon by night.
 */
export function skyIcon(
  hour: Pick<ForecastHour, 'weather' | 'cloudPct' | 'daylight'>,
  windMph: number,
): { icon: SkyIconId; sky: string } {
  const fall = falling(hour.weather)
  const windy = windMph >= WINDY_SUSTAINED_MPH
  // An hour the forecast leaves without cloud cover is unknown, never drawn as clear.
  if (hour.cloudPct === null) {
    if (fall) return { icon: fall, sky: skyLabel(hour.weather, NaN) }
    return windy ? { icon: 'windy', sky: 'Windy' } : { icon: 'unknown', sky: 'Sky not forecast' }
  }
  const words = dayWords(skyLabel(hour.weather, hour.cloudPct), hour.daylight)
  if (fall) return { icon: fall, sky: words }
  if (windy) return { icon: 'windy', sky: `${words} and windy` }
  if (hour.cloudPct < 37.5) return { icon: hour.daylight ? 'clear-day' : 'clear-night', sky: words }
  if (hour.cloudPct < 62.5) return { icon: hour.daylight ? 'partly-day' : 'partly-night', sky: words }
  return { icon: 'cloudy', sky: words }
}

/**
 * The Mountain Forecast: this hour and the next four, from the summit's NWS
 * forecast. The current wind is the summit's sustained wind as the Summit
 * beacon shows it (measured when a station has it, otherwise the forecast), so
 * the bar and the Summit card never disagree. Every later hour, and every sky,
 * is the forecast's.
 *
 * @param nowMs  Decides sun or moon for the current hour, so the icon turns at sunset rather than on the hour.
 */
export function mountainForecast(forecast: BeaconForecast, current: Current | null, nowMs: number): MountainForecast {
  const { lat, lon } = forecast.beacon.weatherStation
  const windMph = current?.speedMph ?? forecast.now.speedMph
  const windSource: Source = current?.sources.speed ?? 'model'
  const now: MountainSlot = {
    time: forecast.now.time,
    label: 'Now',
    windMph,
    windSource,
    ...skyIcon({ ...forecast.now, daylight: isDaylight(nowMs, lat, lon) }, windMph),
  }
  const next = forecast.next6.slice(0, MOUNTAIN_NEXT_HOURS).map(
    (h): MountainSlot => ({
      time: h.time,
      label: hourLabel(h.time),
      windMph: h.speedMph,
      windSource: 'model',
      ...skyIcon(h, h.speedMph),
    }),
  )
  return { windStation: windSource === 'station' ? (current?.stationFor.speed ?? null) : null, now, next }
}
