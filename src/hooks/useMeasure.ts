import { useCallback, useState } from 'react'

/** What the toolbar's Mountain Forecast and the map's beacons show: the wind, or the air temperature. */
export type Measure = 'wind' | 'temp'

const STORAGE_KEY = 'skicast:measure'

function readSaved(): Measure {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'temp' ? 'temp' : 'wind'
  } catch {
    return 'wind'
  }
}

/**
 * Wind or temperature, remembered between visits so a reader who checks the
 * temperature first finds it there next time. Wind is the default: it is what
 * decides whether the upper lifts run.
 */
export function useMeasure(): { measure: Measure; setMeasure: (next: Measure) => void } {
  const [measure, setState] = useState<Measure>(readSaved)
  const setMeasure = useCallback((next: Measure) => {
    setState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // The choice still applies for this visit.
    }
  }, [])
  return { measure, setMeasure }
}
