import { MAMMOTH_FRESH_MS, MAMMOTH_SNAPSHOT_URL, MAMMOTH_TIMEOUT_MS, OBSERVATION_MAX_AGE_MS } from '../config'
import type { Observation, Station } from '../types'
import { parseSnapshot } from './mammoth'
import { fetchJson, fetchObservations, type ObservationMap } from './nws'

const age = (o: Observation, nowMs: number) => nowMs - Date.parse(o.observedAt)

/**
 * Which reading of one station to show.
 *
 * Mammoth's own reading takes precedence while it is fresh (MAMMOTH_FRESH_MS:
 * one report plus one missed cycle), even if NWS somehow has a newer one.
 * Past that the station has stalled, and the newer of the two is shown. Either
 * may be missing. The reading is kept whole, never mixed across feeds.
 */
export function chooseReading(mammoth: Observation | null, nws: Observation | null, nowMs: number): Observation | null {
  if (mammoth && age(mammoth, nowMs) <= MAMMOTH_FRESH_MS) return mammoth
  if (!mammoth || !nws) return mammoth ?? nws
  return Date.parse(nws.observedAt) > Date.parse(mammoth.observedAt) ? nws : mammoth
}

/**
 * Current readings for every station, keyed by Mammoth's station id.
 *
 * Mammoth's own feed comes first: it reports every 5 minutes and carries values
 * the NWS copy drops (Top Station's sustained wind, for one). Only a station
 * whose Mammoth reading is missing or stale is asked of the National Weather
 * Service, and `chooseReading` decides between the two. If Mammoth's site
 * can't be reached (or the app is served without the /api/stations function)
 * every station falls back to NWS.
 *
 * @param nowMs  Fixed once per fetch, so every station is judged against the same clock.
 */
export async function fetchAllObservations(
  stations: readonly Station[],
  signal?: AbortSignal,
  nowMs: number = Date.now(),
): Promise<ObservationMap> {
  let mammoth: ObservationMap = {}
  try {
    mammoth = parseSnapshot(await fetchJson(MAMMOTH_SNAPSHOT_URL, MAMMOTH_TIMEOUT_MS, signal))
  } catch {
    // No readings from Mammoth: NWS covers every station below.
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // A stalled station's last reading can be old; past the usual age limit it is not shown at all.
  const usable = (o: Observation | null | undefined) => (o && age(o, nowMs) <= OBSERVATION_MAX_AGE_MS ? o : null)
  const isFresh = (s: Station) => {
    const o = usable(mammoth[s.id])
    return o !== null && age(o, nowMs) <= MAMMOTH_FRESH_MS
  }

  // NWS is only asked about stations it could actually win for.
  const stale = stations.filter((s) => !isFresh(s))
  const nws = stale.length > 0 ? await fetchObservations(stale, signal, nowMs) : {}
  return Object.fromEntries(
    stations.map((s) => [s.id, chooseReading(usable(mammoth[s.id]), nws[s.id] ?? null, nowMs)]),
  )
}
