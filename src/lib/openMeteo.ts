import { OPEN_METEO_BASE_URL, MOUNTAIN_TIME_ZONE } from '../config'
import type { Beacon, BeaconForecast, WindHour } from '../types'

/** A beacon plus the coordinates of the station it is pinned to. */
export interface ForecastPoint {
  beacon: Beacon
  lat: number
  lon: number
}

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'cloud_cover',
  'weather_code',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
] as const

const HOURLY_FIELDS = ['wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m'] as const

/** This hour plus the next six. */
const FORECAST_HOURS = 7

const FT_TO_M = 0.3048

/**
 * One request covers every beacon: Open-Meteo takes comma-separated lists.
 * `elevation` sets each point's real altitude so the forecast is corrected for
 * it. The weather model is left on Open-Meteo's default on purpose.
 */
export function buildForecastUrl(points: readonly ForecastPoint[], baseUrl: string = OPEN_METEO_BASE_URL): string {
  const params: [string, string][] = [
    ['latitude', points.map((p) => p.lat.toFixed(5)).join(',')],
    ['longitude', points.map((p) => p.lon.toFixed(5)).join(',')],
    ['elevation', points.map((p) => Math.round(p.beacon.elevationFt * FT_TO_M)).join(',')],
    ['current', CURRENT_FIELDS.join(',')],
    ['hourly', HOURLY_FIELDS.join(',')],
    ['forecast_hours', String(FORECAST_HOURS)],
    ['temperature_unit', 'fahrenheit'],
    ['wind_speed_unit', 'mph'],
    ['precipitation_unit', 'inch'],
    ['timezone', MOUNTAIN_TIME_ZONE],
  ]
  return `${baseUrl}?${params.map(([k, v]) => `${k}=${v}`).join('&')}`
}

/** The parts of an Open-Meteo location response that Skicast reads. */
export interface OpenMeteoLocation {
  elevation: number
  current: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    precipitation: number
    cloud_cover: number
    weather_code: number
    wind_speed_10m: number
    wind_gusts_10m: number
    wind_direction_10m: number
  }
  hourly: {
    time: string[]
    wind_speed_10m: number[]
    wind_gusts_10m: number[]
    wind_direction_10m: number[]
  }
}

function isLocation(value: unknown): value is OpenMeteoLocation {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<OpenMeteoLocation>
  return (
    typeof v.current?.time === 'string' &&
    typeof v.current.wind_gusts_10m === 'number' &&
    Array.isArray(v.hourly?.time) &&
    Array.isArray(v.hourly.wind_gusts_10m) &&
    Array.isArray(v.hourly.wind_speed_10m) &&
    Array.isArray(v.hourly.wind_direction_10m)
  )
}

/**
 * Turns the raw response into one forecast per beacon, in the order requested.
 * Open-Meteo returns an array for several locations and a bare object for one.
 */
export function parseForecast(raw: unknown, beacons: readonly Beacon[], fetchedAt: string): BeaconForecast[] {
  const locations = Array.isArray(raw) ? raw : [raw]
  if (locations.length !== beacons.length) {
    throw new Error(`Expected ${beacons.length} locations from Open-Meteo, got ${locations.length}`)
  }
  return beacons.map((beacon, i) => {
    const loc: unknown = locations[i]
    if (!isLocation(loc)) throw new Error(`Open-Meteo response for ${beacon.name} is missing wind data`)

    const hours: WindHour[] = loc.hourly.time.map((time, h) => ({
      time,
      speedMph: loc.hourly.wind_speed_10m[h] ?? NaN,
      gustMph: loc.hourly.wind_gusts_10m[h] ?? NaN,
      dirDeg: loc.hourly.wind_direction_10m[h] ?? NaN,
    }))
    // `current` is stamped within the hour (e.g. 14:15); the six hours after it start at 15:00.
    const currentHour = `${loc.current.time.slice(0, 13)}:00`
    const next6 = hours.filter((h) => h.time > currentHour && Number.isFinite(h.gustMph)).slice(0, 6)

    return {
      beacon,
      now: {
        time: loc.current.time,
        tempF: loc.current.temperature_2m,
        feelsF: loc.current.apparent_temperature,
        precipIn: loc.current.precipitation,
        cloudPct: loc.current.cloud_cover,
        code: loc.current.weather_code,
        speedMph: loc.current.wind_speed_10m,
        gustMph: loc.current.wind_gusts_10m,
        dirDeg: loc.current.wind_direction_10m,
      },
      next6,
      fetchedAt,
    }
  })
}

export async function fetchForecast(points: readonly ForecastPoint[], signal?: AbortSignal): Promise<BeaconForecast[]> {
  const res = await fetch(buildForecastUrl(points), { signal })
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`)
  const raw: unknown = await res.json()
  return parseForecast(
    raw,
    points.map((p) => p.beacon),
    new Date().toISOString(),
  )
}
