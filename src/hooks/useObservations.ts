import { useCallback, useEffect, useRef, useState } from 'react'
import { OBSERVATION_TTL_MS } from '../config'
import { STATIONS } from '../data/stations'
import type { ObservationMap } from '../lib/nws'
import { fetchAllObservations } from '../lib/observations'
import { useVisiblePolling } from './useVisiblePolling'

/** In-memory cache, shared by every mount in this tab. */
let memory: { at: number; observations: ObservationMap } | null = null

export function clearObservationCache(): void {
  memory = null
}

export interface ObservationState {
  /** Readings from every station by station id, drawn on the map or not; undefined until the first answer arrives. */
  observations: ObservationMap | undefined
  refresh: () => void
}

/**
 * Live readings from every Mammoth station: Mammoth's own feed first, NWS for
 * any station it has nothing fresh for (see lib/observations.ts). These are not
 * saved to localStorage: a reading is only worth showing while it is fresh, and
 * the first answer is a few hundred milliseconds away. A failed fetch leaves
 * each beacon on the forecast.
 */
export function useObservations(): ObservationState {
  const [observations, setObservations] = useState<ObservationMap | undefined>(() => memory?.observations)
  const inFlight = useRef<AbortController | null>(null)

  const load = useCallback((force: boolean) => {
    if (inFlight.current) return
    if (!force && memory && Date.now() - memory.at < OBSERVATION_TTL_MS) return
    const controller = new AbortController()
    inFlight.current = controller
    fetchAllObservations(STATIONS, controller.signal)
      .then((result) => {
        memory = { at: Date.now(), observations: result }
        setObservations(result)
      })
      .catch(() => {
        // Aborted by an unmount. Individual station failures never reach here.
      })
      .finally(() => {
        if (inFlight.current === controller) inFlight.current = null
      })
  }, [])

  const loadIfStale = useCallback(() => load(false), [load])
  useVisiblePolling(loadIfStale)
  // Same unmount handling as useForecast; see the note there.
  useEffect(
    () => () => {
      inFlight.current?.abort()
      inFlight.current = null
    },
    [],
  )

  const refresh = useCallback(() => load(true), [load])
  return { observations, refresh }
}
