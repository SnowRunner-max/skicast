import {
  NWS_BASE_URL,
  OBSERVATION_GUST_MAX_AGE_MS,
  OBSERVATION_LIMIT,
  OBSERVATION_MAX_AGE_MS,
  OBSERVATION_TIMEOUT_MS,
} from '../config'
import type { Observation, Station } from '../types'

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
function read(v: NwsValue | undefined, convert: Record<string, (n: number) => number>): number | null {
  if (!v || typeof v.value !== 'number' || !Number.isFinite(v.value)) return null
  if (v.qualityControl && REJECTED_QC.has(v.qualityControl)) return null
  const fn = v.unitCode ? convert[v.unitCode] : undefined
  return fn ? fn(v.value) : null
}

const toF: Record<string, (n: number) => number> = {
  'wmoUnit:degC': (c) => (c * 9) / 5 + 32,
  'wmoUnit:degF': (f) => f,
}
const toMph: Record<string, (n: number) => number> = {
  'wmoUnit:km_h-1': (k) => k * 0.621371,
  'wmoUnit:m_s-1': (m) => m * 2.236936,
}
const toDeg: Record<string, (n: number) => number> = {
  'wmoUnit:degree_(angle)': (d) => d,
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
  if (!Array.isArray(features)) throw new Error(`NWS response for ${stationId} has no readings`)

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

  const temp = latest((r) => read(r.temperature, toF))
  const speed = latest((r) => read(r.windSpeed, toMph))
  const dir = latest((r) => read(r.windDirection, toDeg))
  const gust = latest((r) => read(r.windGust, toMph), OBSERVATION_GUST_MAX_AGE_MS)

  const stamps = [temp?.at, speed?.at].filter((t): t is number => t !== undefined)
  // A gust alone still counts as a reading, stamped with when the gust was reported.
  if (gust && stamps.length === 0) stamps.push(gust.at)
  if (stamps.length === 0 && !dir) return null
  const observedAt = new Date(Math.max(...(stamps.length ? stamps : [dir!.at]))).toISOString()

  const speedMph = speed?.value ?? null
  // A gust is by definition at least the sustained wind.
  const gustMph = gust ? Math.max(gust.value, speedMph ?? 0) : null
  return {
    stationId,
    observedAt,
    tempF: temp?.value ?? null,
    speedMph,
    gustMph,
    gustAt: gust ? new Date(gust.at).toISOString() : null,
    dirDeg: dir?.value ?? null,
  }
}

/**
 * GETs JSON from the NWS API, giving up after `timeoutMs` so one slow request
 * never holds up the screen. Also stops when `signal` aborts.
 */
export async function fetchJson(url: string, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), timeoutMs)
  const onAbort = () => timeout.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: timeout.signal, headers: { Accept: 'application/geo+json' } })
    if (!res.ok) throw new Error(`NWS answered ${res.status} for ${url.replace(NWS_BASE_URL, '')}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

async function fetchStation(stationId: string, nowMs: number, signal?: AbortSignal): Promise<Observation | null> {
  const raw = await fetchJson(buildObservationsUrl(stationId), OBSERVATION_TIMEOUT_MS, signal)
  return parseObservations(raw, stationId, nowMs)
}

/** Observations by station id. A station that failed or has nothing fresh maps to null. */
export type ObservationMap = Record<string, Observation | null>

/**
 * One request per station, in parallel. A slow or broken station only loses
 * its own readings; it never holds up the others or the forecast.
 */
export async function fetchObservations(
  stations: readonly Pick<Station, 'id'>[],
  signal?: AbortSignal,
): Promise<ObservationMap> {
  const nowMs = Date.now()
  const entries = await Promise.all(
    stations.map(async ({ id }) => {
      try {
        return [id, await fetchStation(id, nowMs, signal)] as const
      } catch {
        return [id, null] as const
      }
    }),
  )
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  return Object.fromEntries(entries)
}
