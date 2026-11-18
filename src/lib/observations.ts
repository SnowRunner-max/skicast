import { MAMMOTH_FRESH_MS, MAMMOTH_SNAPSHOT_URL, MAMMOTH_TIMEOUT_MS, OBSERVATION_MAX_AGE_MS } from '../config'
import type { Observation, Station } from '../types'
import { parseSnapshot } from './mammoth'
import { fetchJson, fetchObservations, type ObservationMap } from './nws'

const age = (o: Observation, nowMs: number) => nowMs - Date.parse(o.observedAt)

/** The newer of two readings of one station, either of which may be missing. */
function newer(a: Observation | null, b: Observation | null): Observation | null {
  if (!a || !b) return a ?? b
  return Date.parse(b.observedAt) > Date.parse(a.observedAt) ? b : a
}

/**
 * Current readings for every station, keyed by Mammoth's station id.
 *
 * Mammoth's own feed comes first: it reports every 5 minutes and carries values
 * the NWS copy drops (Top Station's sustained wind, for one). Any station it has
 * nothing recent for is asked of the National Weather Service instead, and the
 * newer of the two readings is kept. Each station's values come from one feed,
 * never a mix. If Mammoth's site can't be reached (or the app is served
 * without the /api/stations function) every station falls back to NWS.
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
  const fresh = (s: Station) => {
    const o = usable(mammoth[s.id])
    return o !== null && age(o, nowMs) <= MAMMOTH_FRESH_MS
  }

  const behind = stations.filter((s) => !fresh(s))
  const nws = behind.length > 0 ? await fetchObservations(behind, signal) : {}
  return Object.fromEntries(stations.map((s) => [s.id, newer(usable(mammoth[s.id]), nws[s.id] ?? null)]))
}
