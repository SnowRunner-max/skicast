/** Builders for NWS grid-forecast responses, so tests read as the forecast they describe. */
import { BEACONS } from '../../data/beacons'
import type { BeaconForecast } from '../../types'
import { beaconForecast, cellKey, parseGrid } from '../nwsForecast'
import type { NwsWeather } from '../sky'

export interface HourSpec {
  tempF: number
  speedMph: number
  gustMph: number | null
  dirDeg: number
  cloudPct?: number
  /** Total for the hour, in inches. */
  precipIn?: number
  weather?: NwsWeather[]
}

const HOUR_MS = 3_600_000

/**
 * A grid response with one value per hour, the first for the hour containing
 * `nowMs`, in the units NWS sends (°C, km/h, mm).
 */
export function gridResponse(nowMs: number, hours: HourSpec[], elevationM: number) {
  const first = Math.floor(nowMs / HOUR_MS) * HOUR_MS
  const layer = (uom: string | undefined, pick: (h: HourSpec) => unknown) => ({
    ...(uom ? { uom } : {}),
    values: hours.map((h, i) => ({
      validTime: `${new Date(first + i * HOUR_MS).toISOString().replace('.000Z', '+00:00')}/PT1H`,
      value: pick(h),
    })),
  })
  return {
    properties: {
      elevation: { unitCode: 'wmoUnit:m', value: elevationM },
      temperature: layer('wmoUnit:degC', (h) => ((h.tempF - 32) * 5) / 9),
      windSpeed: layer('wmoUnit:km_h-1', (h) => h.speedMph / 0.621371),
      windGust: layer('wmoUnit:km_h-1', (h) => (h.gustMph === null ? null : h.gustMph / 0.621371)),
      windDirection: layer('wmoUnit:degree_(angle)', (h) => h.dirDeg),
      skyCover: layer('wmoUnit:percent', (h) => h.cloudPct ?? 0),
      quantitativePrecipitation: layer('wmoUnit:mm', (h) => (h.precipIn ?? 0) * 25.4),
      weather: layer(undefined, (h) => h.weather ?? [{ coverage: null, weather: null, intensity: null }]),
    },
  }
}

/** A steady hour, then six more with the given gusts, speeds and direction. */
function hours(now: HourSpec, next: [gust: number, speed: number, dir: number][]): HourSpec[] {
  return [now, ...next.map(([gustMph, speedMph, dirDeg]) => ({ ...now, gustMph, speedMph, dirDeg }))]
}

/**
 * A clear November evening at Mammoth with a southwest breeze, one entry per
 * grid square the beacons use. Each square's height is set to one station's,
 * so that station's temperature is exactly the one given here: Top Station
 * (Summit) in REV/57,17, McCoy in 57,18, Top of Eagle in 58,17, Canyon in 58,18.
 */
export function mammothGrids(nowMs: number): Record<string, ReturnType<typeof gridResponse>> {
  const ft = (f: number) => f * 0.3048
  return {
    'REV/57,17': gridResponse(
      nowMs,
      hours({ tempF: 20.8, speedMph: 17.7, gustMph: 24.4, dirDeg: 229 }, [
        [24.8, 17.9, 228],
        [28.4, 17.9, 227],
        [27.5, 17.4, 226],
        [26.8, 16.8, 226],
        [24.6, 15.7, 225],
        [24.2, 15.2, 224],
      ]),
      ft(11053),
    ),
    'REV/57,18': gridResponse(
      nowMs,
      hours({ tempF: 26.0, speedMph: 17.7, gustMph: 24.4, dirDeg: 229 }, [
        [24.8, 17.9, 228],
        [28.4, 17.9, 227],
        [27.5, 17.4, 226],
        [26.8, 16.8, 226],
        [24.6, 15.7, 225],
        [24.2, 15.2, 224],
      ]),
      ft(9630),
    ),
    'REV/58,17': gridResponse(
      nowMs,
      hours({ tempF: 32.0, speedMph: 11.9, gustMph: 19.2, dirDeg: 212 }, [
        [24.4, 14.1, 215],
        [30.0, 17.2, 218],
        [30.2, 17.4, 220],
        [31.1, 17.9, 221],
        [29.1, 16.6, 222],
        [28.0, 16.1, 222],
      ]),
      ft(9047),
    ),
    'REV/58,18': gridResponse(
      nowMs,
      hours({ tempF: 31.3, speedMph: 11.2, gustMph: 20.4, dirDeg: 233 }, [
        [24.8, 13.9, 232],
        [31.8, 17.6, 231],
        [32.0, 17.9, 230],
        [32.2, 18.1, 230],
        [30.6, 17.0, 229],
        [30.0, 16.6, 229],
      ]),
      ft(8343),
    ),
  }
}

/** Every beacon's forecast from `mammothGrids`, as the app would build it. */
export function mammothForecasts(nowMs: number, fetchedAt: string): BeaconForecast[] {
  const grids = mammothGrids(nowMs)
  return BEACONS.map((b) => {
    const key = cellKey(b.forecastCell)
    return beaconForecast(b, parseGrid(grids[key], nowMs, key), fetchedAt)
  })
}
