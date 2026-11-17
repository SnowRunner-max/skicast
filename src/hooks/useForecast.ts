import { useCallback, useEffect, useRef, useState } from 'react'
import { FORECAST_TTL_MS } from '../config'
import { BEACONS } from '../data/beacons'
import { fetchForecast } from '../lib/nwsForecast'
import type { BeaconForecast } from '../types'
import { useVisiblePolling } from './useVisiblePolling'

// v2: the NWS forecast, with the sky in words rather than a WMO code.
const STORAGE_KEY = 'skicast:forecast:v2'

/** Past this age a saved forecast's "next 6 hours" are all behind us, so it is dropped. */
const MAX_SAVED_AGE_MS = 6 * 60 * 60 * 1000

/** In-memory cache, shared by every mount in this tab. */
let memory: BeaconForecast[] | null = null

export function clearForecastCache(): void {
  memory = null
}

function ageMs(forecasts: BeaconForecast[]): number {
  const at = Date.parse(forecasts[0]?.fetchedAt ?? '')
  return Number.isFinite(at) ? Date.now() - at : Infinity
}

function readSaved(): BeaconForecast[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as BeaconForecast[]
    if (!Array.isArray(saved)) return null
    // Re-attach beacons by id so a saved result survives edits to beacons.ts.
    const forecasts = BEACONS.map((beacon) => {
      const match = saved.find((f) => f?.beacon?.id === beacon.id)
      return match && match.now && Array.isArray(match.next6) ? { ...match, beacon } : null
    })
    if (forecasts.some((f) => f === null)) return null
    const complete = forecasts as BeaconForecast[]
    return ageMs(complete) <= MAX_SAVED_AGE_MS ? complete : null
  } catch {
    return null
  }
}

function save(forecasts: BeaconForecast[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(forecasts))
  } catch {
    // Private mode or a full disk: the app works without the saved copy.
  }
}

export interface ForecastState {
  /** One entry per beacon, or null before the first result arrives. */
  forecasts: BeaconForecast[] | null
  /** True while a request is in flight. */
  loading: boolean
  /** Set when the latest request failed; `forecasts` may still hold an older result. */
  error: string | null
  fetchedAt: string | null
  refresh: () => void
}

export function useForecast(): ForecastState {
  const [forecasts, setForecasts] = useState<BeaconForecast[] | null>(() => memory ?? readSaved())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // `load` is created once, so it reads the newest forecasts through a ref.
  const latest = useRef(forecasts)
  latest.current = forecasts
  const inFlight = useRef<AbortController | null>(null)

  const load = useCallback((force: boolean) => {
    if (inFlight.current) return
    if (!force && latest.current && ageMs(latest.current) < FORECAST_TTL_MS) return
    const controller = new AbortController()
    inFlight.current = controller
    setLoading(true)
    fetchForecast(BEACONS, controller.signal)
      .then((result) => {
        memory = result
        save(result)
        setForecasts(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Request failed')
      })
      .finally(() => {
        if (inFlight.current === controller) inFlight.current = null
        if (!controller.signal.aborted) setLoading(false)
      })
  }, [])

  const loadIfStale = useCallback(() => load(false), [load])
  useVisiblePolling(loadIfStale)
  // Drop a request that outlives the screen. Clearing the ref matters under
  // StrictMode, which unmounts and remounts once in development: without it
  // the remount would see a request "in flight" that has just been aborted.
  useEffect(
    () => () => {
      inFlight.current?.abort()
      inFlight.current = null
    },
    [],
  )

  const refresh = useCallback(() => load(true), [load])

  return { forecasts, loading, error, fetchedAt: forecasts?.[0]?.fetchedAt ?? null, refresh }
}
