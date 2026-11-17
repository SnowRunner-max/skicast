import { FORECAST_TIMEOUT_MS, NWS_BASE_URL } from '../config'
import type { Beacon, BeaconForecast, ForecastCell, ForecastHour } from '../types'
import { windChillF } from './current'
import { fetchJson } from './nws'
import { skyLabel, type NwsWeather } from './sky'
import { isDaylight } from './sun'
import { mountainHour } from './time'
import { cToF, TO_CELSIUS, TO_DEGREES, TO_INCHES, TO_MPH, TO_PERCENT, type UnitTable } from './units'

/** This hour plus the next six. */
const FORECAST_HOURS = 7

const HOUR_MS = 3_600_000

/** Standard atmosphere: air cools about 6.5 °C per km of height. */
const LAPSE_C_PER_M = 0.0065

const FT_TO_M = 0.3048

export function cellKey(cell: ForecastCell): string {
  return `${cell.office}/${cell.x},${cell.y}`
}

export function buildGridUrl(cell: ForecastCell, baseUrl: string = NWS_BASE_URL): string {
  return `${baseUrl}/gridpoints/${encodeURIComponent(cell.office)}/${cell.x},${cell.y}`
}

/** One layer of the grid forecast: values that each hold for a stretch of time. */
interface Layer {
  uom?: string
  values: { validTime: string; value: unknown }[]
}

/** "PT3H" or "P1DT6H" in ms. NWS only uses days and hours here. */
export function durationMs(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso)
  if (!m) return NaN
  const [, d = '0', h = '0', min = '0'] = m
  return ((Number(d) * 24 + Number(h)) * 60 + Number(min)) * 60_000
}

/** The value in force at `atMs`, and how long its stretch is, or null when nothing covers that time. */
function valueAt(layer: Layer | undefined, atMs: number): { value: unknown; spanMs: number } | null {
  if (!layer || !Array.isArray(layer.values)) return null
  for (const { validTime, value } of layer.values) {
    const [start = '', span = ''] = String(validTime).split('/')
    const from = Date.parse(start)
    const spanMs = durationMs(span)
    if (from <= atMs && atMs < from + spanMs) return { value, spanMs }
  }
  return null
}

/** A number in the units Skicast shows, or NaN. Unknown units are dropped rather than guessed at. */
function numberAt(layer: Layer | undefined, atMs: number, convert: UnitTable): number {
  const hit = valueAt(layer, atMs)
  const fn = layer?.uom ? convert[layer.uom] : undefined
  return hit && typeof hit.value === 'number' && fn ? fn(hit.value) : NaN
}

/** One hour of a grid square's forecast, before it is fitted to a beacon. */
export interface GridHour {
  startMs: number
  tempC: number
  speedMph: number
  gustMph: number
  dirDeg: number
  cloudPct: number
  precipInPerHour: number
  weather: NwsWeather[]
}

export interface GridForecast {
  /** The grid square's average ground height, which the forecast temperature is for. */
  elevationM: number
  /** This hour first, then the hours after it that the forecast covers, up to six. */
  hours: GridHour[]
}

function isGrid(value: unknown): value is { properties: Record<string, unknown> } {
  const p = (value as { properties?: Record<string, unknown> })?.properties
  return typeof p === 'object' && p !== null && typeof (p.windGust as Layer | undefined)?.values === 'object'
}

/**
 * Reads the hours Skicast shows out of a grid square's forecast. The grid
 * holds a value for each stretch of time (an hour, or a block of several), so
 * each hour takes whatever stretch covers its start.
 */
export function parseGrid(raw: unknown, nowMs: number, label = 'grid square'): GridForecast {
  if (!isGrid(raw)) throw new Error(`NWS forecast for ${label} is missing wind data`)
  const p = raw.properties as Record<string, Layer | undefined> & { elevation?: { value?: unknown } }
  const elevationM = typeof p.elevation?.value === 'number' ? p.elevation.value : NaN
  const firstHour = Math.floor(nowMs / HOUR_MS) * HOUR_MS

  const hours: GridHour[] = []
  for (let i = 0; i < FORECAST_HOURS; i++) {
    const t = firstHour + i * HOUR_MS
    const speedMph = numberAt(p.windSpeed, t, TO_MPH)
    const gust = numberAt(p.windGust, t, TO_MPH)
    const precip = valueAt(p.quantitativePrecipitation, t)
    const precipIn = numberAt(p.quantitativePrecipitation, t, TO_INCHES)
    const weather = valueAt(p.weather, t)?.value
    hours.push({
      startMs: t,
      tempC: numberAt(p.temperature, t, TO_CELSIUS),
      speedMph,
      // A gust is by definition at least the sustained wind; the grid leaves some hours without one.
      gustMph: Number.isFinite(gust) ? Math.max(gust, speedMph) : speedMph,
      dirDeg: numberAt(p.windDirection, t, TO_DEGREES),
      cloudPct: numberAt(p.skyCover, t, TO_PERCENT),
      // Precipitation comes as totals over blocks of up to six hours; spread each one evenly.
      precipInPerHour: precip && Number.isFinite(precipIn) ? precipIn / (precip.spanMs / HOUR_MS) : 0,
      weather: Array.isArray(weather) ? (weather as NwsWeather[]) : [],
    })
  }

  const now = hours[0]!
  if (!Number.isFinite(now.tempC) || !Number.isFinite(now.gustMph) || !Number.isFinite(now.dirDeg)) {
    throw new Error(`NWS forecast for ${label} does not cover this hour`)
  }
  return { elevationM, hours: [now, ...hours.slice(1).filter((h) => Number.isFinite(h.gustMph) && Number.isFinite(h.dirDeg))] }
}

function forecastHour(h: GridHour, beacon: Beacon): ForecastHour {
  const { lat, lon } = beacon.weatherStation
  return {
    time: mountainHour(h.startMs),
    speedMph: h.speedMph,
    gustMph: h.gustMph,
    dirDeg: h.dirDeg,
    // Null, not NaN: the forecast is saved as JSON, which has no NaN.
    cloudPct: Number.isFinite(h.cloudPct) ? h.cloudPct : null,
    weather: h.weather,
    daylight: isDaylight(h.startMs + HOUR_MS / 2, lat, lon),
  }
}

/**
 * Fits a grid square's forecast to one beacon. Wind is the square's as it
 * stands. Temperature is moved from the square's average height to the
 * station's along the standard lapse rate, since a 2.5 km square on a
 * mountain can sit hundreds of metres above or below the station.
 */
export function beaconForecast(beacon: Beacon, grid: GridForecast, fetchedAt: string): BeaconForecast {
  const [now, ...next] = grid.hours
  if (!now) throw new Error(`No forecast hours for ${beacon.name}`)
  const stationM = beacon.weatherStation.elevationFt * FT_TO_M
  // Positive when the station sits below the square's average ground, where the air is warmer.
  const liftC = Number.isFinite(grid.elevationM) ? (grid.elevationM - stationM) * LAPSE_C_PER_M : 0
  const tempF = cToF(now.tempC + liftC)
  return {
    beacon,
    now: {
      ...forecastHour(now, beacon),
      tempF,
      feelsF: windChillF(tempF, now.speedMph),
      precipIn: now.precipInPerHour,
      sky: skyLabel(now.weather, now.cloudPct),
    },
    next6: next.map((h) => forecastHour(h, beacon)),
    fetchedAt,
  }
}

/**
 * One request per grid square, in parallel, shared by the beacons in it. A
 * square that fails is tried once more before the whole forecast is called
 * failed, since this endpoint drops the odd request.
 */
export async function fetchForecast(beacons: readonly Beacon[], signal?: AbortSignal): Promise<BeaconForecast[]> {
  const cells = new Map<string, ForecastCell>()
  for (const b of beacons) cells.set(cellKey(b.forecastCell), b.forecastCell)

  const nowMs = Date.now()
  const grids = new Map(
    await Promise.all(
      [...cells].map(async ([key, cell]) => {
        const url = buildGridUrl(cell)
        const raw = await fetchJson(url, FORECAST_TIMEOUT_MS, signal).catch((err: unknown) => {
          if (signal?.aborted) throw err
          return fetchJson(url, FORECAST_TIMEOUT_MS, signal)
        })
        return [key, parseGrid(raw, nowMs, key)] as const
      }),
    ),
  )
  const fetchedAt = new Date(nowMs).toISOString()
  return beacons.map((b) => beaconForecast(b, grids.get(cellKey(b.forecastCell))!, fetchedAt))
}
