import {
  NWS_BASE_URL,
  OBSERVATION_GUST_MAX_AGE_MS,
  OBSERVATION_LIMIT,
  OBSERVATION_MAX_AGE_MS,
  OBSERVATION_TIMEOUT_MS,
} from '../config'
import type { Observation, Station } from '../types'
import { TO_DEGREES, TO_FAHRENHEIT, TO_MPH, type UnitTable } from './units'

/** One reading as the NWS API sends it, trimmed to what Skicast uses. */
interface NwsValue {
  value: number | null
  unitCode?: string
  qualityControl?: string
}

interface NwsReading {
  timestamp: string
  temperature?: NwsValue
  windSpeed?: NwsValue
  windGust?: NwsValue
  windDirection?: NwsValue
}

export function buildObservationsUrl(stationId: string, baseUrl: string = NWS_BASE_URL): string {
  return `${baseUrl}/stations/${encodeURIComponent(stationId)}/observations?limit=${OBSERVATION_LIMIT}`
}

/**
 * NWS quality flags: X failed, Q questionable, B subjectively bad. Anything
 * else (not yet checked, passed, verified) is good enough to show.
 */
const REJECTED_QC = new Set(['X', 'Q', 'B'])

/** A usable number, or null. Unknown units are dropped rather than guessed at. */
function read(v: NwsValue | undefined, convert: UnitTable): number | null {
  if (!v || typeof v.value !== 'number' || !Number.isFinite(v.value)) return null
  if (v.qualityControl && REJECTED_QC.has(v.qualityControl)) return null
  const fn = v.unitCode ? convert[v.unitCode] : undefined
  return fn ? fn(v.value) : null
}

function isReading(value: unknown): value is NwsReading {
  return typeof value === 'object' && value !== null && typeof (value as NwsReading).timestamp === 'string'
}

/**
 * Boils a station's recent readings down to one observation, or null when
 * nothing usable is fresh enough.
 *
 * Temperature, sustained wind and direction come from the newest reading that
 * has them, and gust the same way, with a looser age limit: stations send
 * gusts late and only some of the time, so `gustAt` says how old the gust is.
 * Each value is taken on its own, so a station that reports only temperature
 * (or only gusts) still contributes what it has.
 */
export function parseObservations(raw: unknown, stationId: string, nowMs: number): Observation | null {
  const features = (raw as { features?: unknown })?.features
  if (!Array.isArray(features)) throw new Error(`NWS response for station ${stationId} has no readings`)

  const readings = features
    .map((f) => (f as { properties?: unknown })?.properties)
    .filter(isReading)
    .map((r) => ({ r, at: Date.parse(r.timestamp) }))
    .filter(({ at }) => Number.isFinite(at) && nowMs - at <= OBSERVATION_GUST_MAX_AGE_MS)
    .sort((a, b) => b.at - a.at)
  if (readings.length === 0) return null

  const latest = (pick: (r: NwsReading) => number | null, maxAgeMs = OBSERVATION_MAX_AGE_MS) => {
    for (const { r, at } of readings) {
      if (nowMs - at > maxAgeMs) break
      const value = pick(r)
      if (value !== null) return { value, at }
    }
    return null
  }

  const temp = latest((r) => read(r.temperature, TO_FAHRENHEIT))
  const speed = latest((r) => read(r.windSpeed, TO_MPH))
  const dir = latest((r) => read(r.windDirection, TO_DEGREES))
  const gust = latest((r) => read(r.windGust, TO_MPH), OBSERVATION_GUST_MAX_AGE_MS)

  // `observedAt` is what the screen calls "measured N min ago", so it follows the
  // values a rider reads first: temperature and sustained wind. A gust or a
  // direction only stamps the reading when it is all the station sent.
  const stamps = [temp?.at, speed?.at].filter((t): t is number => t !== undefined)
  if (stamps.length === 0 && gust) stamps.push(gust.at)
  if (stamps.length === 0 && dir) stamps.push(dir.at)
  if (stamps.length === 0) return null
  const observedAt = new Date(Math.max(...stamps)).toISOString()

  const speedMph = speed?.value ?? null
  // A gust is by definition at least the sustained wind.
  const gustMph = gust ? Math.max(gust.value, speedMph ?? 0) : null
  return {
    stationId,
    source: 'nws',
    observedAt,
    tempF: temp?.value ?? null,
    speedMph,
    gustMph,
    gustAt: gust ? new Date(gust.at).toISOString() : null,
    dirDeg: dir?.value ?? null,
  }
}

/**
 * GETs JSON, giving up after `timeoutMs` so one slow request never holds up
 * the screen. Also stops when `signal` aborts. Used for the NWS API and for
 * /api/stations alike.
 */
export async function fetchJson(url: string, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), timeoutMs)
  const onAbort = () => timeout.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: timeout.signal, headers: { Accept: 'application/geo+json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.replace(NWS_BASE_URL, 'NWS ')}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

async function fetchStation(station: Pick<Station, 'id' | 'nwsId'>, nowMs: number, signal?: AbortSignal): Promise<Observation | null> {
  if (!station.nwsId) return null
  const raw = await fetchJson(buildObservationsUrl(station.nwsId), OBSERVATION_TIMEOUT_MS, signal)
  return parseObservations(raw, station.id, nowMs)
}

/** Observations by Mammoth station id (Station.id). A station that failed or has nothing fresh maps to null. */
export type ObservationMap = Record<string, Observation | null>

/**
 * One NWS request per station, in parallel, keyed by Mammoth's id. A slow or
 * broken station only loses its own readings; it never holds up the others or
 * the forecast. A station NWS does not carry maps to null without a request.
 *
 * @param nowMs  The clock readings are aged against; pass the caller's so one fetch uses one time.
 */
export async function fetchObservations(
  stations: readonly Pick<Station, 'id' | 'nwsId'>[],
  signal?: AbortSignal,
  nowMs: number = Date.now(),
): Promise<ObservationMap> {
  const entries = await Promise.all(
    stations.map(async (station) => {
      try {
        return [station.id, await fetchStation(station, nowMs, signal)] as const
      } catch {
        return [station.id, null] as const
      }
    }),
  )
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return Object.fromEntries(entries)
}
