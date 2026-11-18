import type { Observation } from '../types'
import type { ObservationMap } from './nws'

/**
 * Mammoth Mountain's own weather stations, as published on its public station
 * site (mammothmountain.westernweathergroup.com, run by Western Weather Group).
 * The site's map page reads them from `/mapapi/query`; Skicast reads the same
 * endpoint. It is undocumented, so everything here checks the shape it gets.
 *
 * The site sends no cross-origin headers, so the app can't ask it directly.
 * /api/stations (stationsEndpoint.ts) asks for every station at four
 * intervals and answers with one snapshot. The app turns that into
 * observations with `parseSnapshot`; NWS fills in for any station it has
 * nothing fresh for.
 */
export const MAMMOTH_STATIONS_SITE = 'https://mammothmountain.westernweathergroup.com'
export const MAMMOTH_QUERY_URL = `${MAMMOTH_STATIONS_SITE}/mapapi/query`

/** Mammoth's station group on the site: every Mammoth and June Mountain station, so new ones appear on their own. */
export const MAMMOTH_STATION_GROUP = 454

/**
 * The intervals the site keeps, each with its own set of fields. The 5-minute
 * record is the live one (wind, gust, temperature, humidity). The 15-minute
 * record adds snow depth, storm and season totals, and today's peaks; the
 * hourly one adds a fire-weather index; the daily one is yesterday's summary.
 */
export const SNAPSHOT_INTERVALS = { '5min': 5, '15min': 15, hourly: 60, daily: 1440 } as const
export type IntervalName = keyof typeof SNAPSHOT_INTERVALS

export interface SnapshotReading {
  /** ISO time (UTC) the reading covers. */
  at: string
  /** Every value the station sent, keyed by the site's field name (see `fields`). Times of day are strings such as "0923". */
  values: Record<string, number | string>
}

export interface SnapshotStation {
  name: string
  lat: number
  lon: number
  elevationFt: number | null
  readings: Partial<Record<IntervalName, SnapshotReading>>
}

export interface SnapshotField {
  name: string
  units: string | null
  description?: string
}

/** What /api/stations answers with. */
export interface StationSnapshot {
  version: 1
  fetchedAt: string
  fields: Record<string, SnapshotField>
  stations: Record<string, SnapshotStation>
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The request body the site's own map page sends, asking for every field of every station in the group. */
export function queryBody(interval: number): URLSearchParams {
  return new URLSearchParams({ Interval: String(interval), 'Groups[]': String(MAMMOTH_STATION_GROUP) })
}

/**
 * Folds the site's answers, one per interval, into one snapshot. Throws when
 * the 5-minute answer is missing or holds no station, so a broken fetch never
 * publishes an empty file. A station with no reading at all is still listed.
 */
export function buildSnapshot(responses: Partial<Record<IntervalName, unknown>>, fetchedAt: Date): StationSnapshot {
  if (!isObject(responses['5min']) || !isObject(responses['5min'].stations)) {
    throw new Error('Mammoth station site sent no 5-minute readings')
  }
  const snapshot: StationSnapshot = { version: 1, fetchedAt: fetchedAt.toISOString(), fields: {}, stations: {} }

  for (const name of Object.keys(SNAPSHOT_INTERVALS) as IntervalName[]) {
    const res = responses[name]
    if (!isObject(res)) continue

    if (isObject(res.metadata)) {
      for (const [key, m] of Object.entries(res.metadata)) {
        if (!isObject(m) || snapshot.fields[key]) continue
        snapshot.fields[key] = {
          name: typeof m.longName === 'string' ? m.longName : key,
          units: typeof m.units === 'string' && m.units !== '' ? m.units : null,
          ...(typeof m.description === 'string' ? { description: m.description } : {}),
        }
      }
    }

    if (isObject(res.stations)) {
      for (const [id, s] of Object.entries(res.stations)) {
        const lat = isObject(s) ? num(s.latitude) : null
        const lon = isObject(s) ? num(s.longitude) : null
        if (!isObject(s) || lat === null || lon === null || snapshot.stations[id]) continue
        snapshot.stations[id] = {
          name: typeof s.name === 'string' ? s.name : id,
          lat,
          lon,
          elevationFt: num(s.elevation),
          readings: {},
        }
      }
    }

    if (isObject(res.records)) {
      for (const [id, r] of Object.entries(res.records)) {
        const station = snapshot.stations[id]
        if (!station || !isObject(r) || typeof r.timestamp !== 'string' || !isObject(r.values)) continue
        const at = Date.parse(r.timestamp)
        if (!Number.isFinite(at)) continue
        const values: SnapshotReading['values'] = {}
        for (const [key, v] of Object.entries(r.values)) {
          if (typeof v === 'string' || num(v) !== null) values[key] = v as number | string
        }
        station.readings[name] = { at: new Date(at).toISOString(), values }
      }
    }
  }

  if (Object.keys(snapshot.stations).length === 0) throw new Error('Mammoth station site listed no stations')
  return snapshot
}

/** Asks the site for every interval. Only the 5-minute answer is required; a failed slower interval is left out. */
export async function fetchSnapshot(
  fetchImpl: typeof fetch,
  { timeoutMs = 20_000, userAgent = 'Skicast station fetch' }: { timeoutMs?: number; userAgent?: string } = {},
): Promise<{ snapshot: StationSnapshot; failed: IntervalName[] }> {
  const failed: IntervalName[] = []
  const entries = await Promise.all(
    (Object.entries(SNAPSHOT_INTERVALS) as [IntervalName, number][]).map(async ([name, interval]) => {
      try {
        const res = await fetchImpl(MAMMOTH_QUERY_URL, {
          method: 'POST',
          body: queryBody(interval),
          headers: { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body: unknown = await res.json()
        if (isObject(body) && body.error === true) throw new Error(String(body.message ?? 'error'))
        return [name, body] as const
      } catch (err) {
        if (name === '5min') throw new Error(`Mammoth station site: 5-minute readings failed (${(err as Error).message})`)
        failed.push(name)
        return [name, undefined] as const
      }
    }),
  )
  return { snapshot: buildSnapshot(Object.fromEntries(entries), new Date()), failed }
}

/** Values outside these are a sensor fault (a 3% humidity in a snowstorm, a 400 mph gust), not weather. */
const PLAUSIBLE = {
  tempF: [-60, 110],
  windMph: [0, 200],
  dirDeg: [0, 360],
} as const

function within(v: unknown, [lo, hi]: readonly [number, number]): number | null {
  const n = num(v)
  return n !== null && n >= lo && n <= hi ? n : null
}

/**
 * The newest of a station's 5- and 15-minute readings, boiled down to what the
 * screen shows. The two usually agree in time; when the 5-minute feed of a
 * station stalls (Bottom of 9's has not moved since October 2025) the
 * 15-minute one still carries it.
 */
function toObservation(id: string, station: SnapshotStation): Observation | null {
  const candidates = [station.readings['5min'], station.readings['15min']].filter(
    (r): r is SnapshotReading => r !== undefined,
  )
  const reading = candidates.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
  if (!reading) return null
  const v = reading.values
  const tempF = within(v.Temp, PLAUSIBLE.tempF)
  const speedMph = within(v.WindSpeed, PLAUSIBLE.windMph)
  const gust = within(v.WindMax, PLAUSIBLE.windMph)
  const dirDeg = within(v.WindDir, PLAUSIBLE.dirDeg)
  if (tempF === null && speedMph === null && gust === null && dirDeg === null) return null
  // The gust is the strongest wind within the reading's interval, so it is at least the sustained wind.
  const gustMph = gust === null ? null : Math.max(gust, speedMph ?? 0)
  return {
    stationId: id,
    source: 'mammoth',
    observedAt: reading.at,
    tempF,
    speedMph,
    gustMph,
    gustAt: gustMph === null ? null : reading.at,
    dirDeg: dirDeg === 360 ? 0 : dirDeg,
  }
}

/** A snapshot as observations by Mammoth station id. A station with nothing usable maps to null. Throws on a file that is not a snapshot. */
export function parseSnapshot(raw: unknown): ObservationMap {
  if (!isObject(raw) || raw.version !== 1 || !isObject(raw.stations)) {
    throw new Error('not a station snapshot')
  }
  const out: ObservationMap = {}
  for (const [id, s] of Object.entries(raw.stations as Record<string, SnapshotStation>)) {
    out[id] = isObject(s) && isObject(s.readings) ? toObservation(id, s) : null
  }
  return out
}
