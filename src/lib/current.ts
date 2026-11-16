import type { BeaconForecast, Observation } from '../types'

export type Source = 'station' | 'model'

/**
 * What to show for "now" at one beacon. Each value comes from the station when
 * it has a fresh reading and from the forecast model when it does not, so a
 * station that drops a sensor costs only that value.
 */
export interface Current {
  tempF: number
  feelsF: number
  speedMph: number
  gustMph: number
  dirDeg: number
  /** Sky, precipitation and cloud cover are not measured at the stations, so these are always the model's. */
  code: number
  precipIn: number
  cloudPct: number
  sources: { temp: Source; speed: Source; gust: Source; dir: Source }
  /**
   * station: at least one value is a measurement.
   * model: nothing is measured here (no station, or it has nothing fresh).
   * pending: this beacon has a station and its readings have not arrived yet.
   */
  status: 'station' | 'model' | 'pending'
  /** ISO time of the measurement, when status is "station". */
  observedAt: string | null
  /** ISO time of the measured gust, which can lag `observedAt`; null when the gust is the model's. */
  gustAt: string | null
}

/** NWS wind chill. Only defined at or below 50 F with wind of 3 mph or more; otherwise it is the air temperature. */
export function windChillF(tempF: number, windMph: number): number {
  if (tempF > 50 || windMph < 3) return tempF
  const v = Math.pow(windMph, 0.16)
  return 35.74 + 0.6215 * tempF - 35.75 * v + 0.4275 * tempF * v
}

/**
 * @param observation  The station's reading, null when it has none, or undefined
 *                     while observations are still loading.
 */
export function resolveCurrent(
  forecast: BeaconForecast,
  observation: Observation | null | undefined,
): Current {
  const m = forecast.now
  const o = observation ?? null
  const pick = (live: number | null | undefined, model: number): [number, Source] =>
    typeof live === 'number' ? [live, 'station'] : [model, 'model']

  const [tempF, temp] = pick(o?.tempF, m.tempF)
  const [speedMph, speed] = pick(o?.speedMph, m.speedMph)
  const [gustRaw, gust] = pick(o?.gustMph, m.gustMph)
  const [dirDeg, dir] = pick(o?.dirDeg, m.dirDeg)
  const sources = { temp, speed, gust, dir }
  const measured = Object.values(sources).includes('station')

  // A measured temperature needs a feels-like of its own: the model's belongs to the model's temperature.
  const feelsF = temp === 'station' ? windChillF(tempF, speedMph) : m.feelsF
  // Never show a sustained wind above the gust beside it.
  const gustMph = Math.max(gustRaw, speed === gust ? speedMph : 0)

  return {
    tempF,
    feelsF,
    speedMph,
    gustMph,
    dirDeg,
    code: m.code,
    precipIn: m.precipIn,
    cloudPct: m.cloudPct,
    sources,
    status: measured ? 'station' : forecast.beacon.weatherStation && observation === undefined ? 'pending' : 'model',
    observedAt: measured ? (o?.observedAt ?? null) : null,
    gustAt: gust === 'station' ? (o?.gustAt ?? null) : null,
  }
}

/** The values a station did not supply, in words, for the info text. */
export function modeledFields(current: Current): string[] {
  const names: Record<keyof Current['sources'], string> = {
    temp: 'temperature',
    speed: 'sustained wind',
    gust: 'gusts',
    dir: 'wind direction',
  }
  return (Object.keys(names) as (keyof Current['sources'])[])
    .filter((k) => current.sources[k] === 'model')
    .map((k) => names[k])
}
