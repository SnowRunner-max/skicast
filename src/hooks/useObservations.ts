import { useCallback, useEffect, useRef, useState } from 'react'
import { OBSERVATION_TTL_MS } from '../config'
import { BEACONS } from '../data/beacons'
import { fetchObservations, type ObservationMap } from '../lib/nws'

/** In-memory cache, shared by every mount in this tab. */
let memory: { at: number; observations: ObservationMap } | null = null

export function clearObservationCache(): void {
  memory = null
}

export interface ObservationState {
  /** Station readings by beacon id, or undefined until the first answer arrives. */
  observations: ObservationMap | undefined
  refresh: () => void
}

/**
 * Live station readings. These are not saved to localStorage: a reading is
 * only worth showing while it is fresh, and the first answer is a few hundred
 * milliseconds away. A failed fetch leaves each beacon on the forecast.
 */
export function useObservations(): ObservationState {
  const [observations, setObservations] = useState<ObservationMap | undefined>(() => memory?.observations)
  const inFlight = useRef<AbortController | null>(null)

  const load = useCallback((force: boolean) => {
    if (inFlight.current) return
    if (!force && memory && Date.now() - memory.at < OBSERVATION_TTL_MS) return
    const controller = new AbortController()
    inFlight.current = controller
    fetchObservations(BEACONS, controller.signal)
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

  useEffect(() => {
    load(false)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load(false)
    }, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      inFlight.current?.abort()
      inFlight.current = null
    }
  }, [load])

  const refresh = useCallback(() => load(true), [load])
  return { observations, refresh }
}
