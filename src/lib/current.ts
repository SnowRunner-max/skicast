import type { BeaconForecast, Observation, Station } from '../types'
import type { ObservationMap } from './nws'

export type Source = 'station' | 'model'

type Field = 'temp' | 'speed' | 'gust' | 'dir'

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
  sky: string
  precipIn: number
  /** Null when the forecast gives no cloud cover. */
  cloudPct: number | null
  sources: Record<Field, Source>
  /** The beacon's station when it supplied at least one value, else null. */
  station: Station | null
  /** Which feed the station's reading came from: Mammoth's own, or the National Weather Service's copy. Null with no station value. */
  feed: Observation['source'] | null
  /**
   * station: at least one value is a measurement.
   * model: nothing is measured here (the station has nothing fresh, or failed).
   * pending: the station's readings have not arrived yet.
   */
  status: 'station' | 'model' | 'pending'
  /** ISO time of the measurement, when status is "station". */
  observedAt: string | null
  /** ISO time of the measured gust, which can lag `observedAt` in the NWS feed; null when the gust is the model's. */
  gustAt: string | null
}

/** NWS wind chill. Only defined at or below 50 F with wind of 3 mph or more; otherwise it is the air temperature. */
export function windChillF(tempF: number, windMph: number): number {
  if (tempF > 50 || windMph < 3) return tempF
  const v = Math.pow(windMph, 0.16)
  return 35.74 + 0.6215 * tempF - 35.75 * v + 0.4275 * tempF * v
}

/**
 * Each value from the beacon's own station when it has it, else from the
 * model. A beacon never borrows a value from a neighbouring station: two
 * stations a few hundred feet apart can differ tenfold in wind.
 *
 * @param observations  Readings by station id, or undefined while they are still loading.
 */
export function resolveCurrent(forecast: BeaconForecast, observations: ObservationMap | undefined): Current {
  const m = forecast.now
  const station = forecast.beacon.weatherStation
  const o = observations?.[station.id] ?? null

  const sources = {} as Record<Field, Source>
  const pick = (field: Field, live: number | null | undefined, model: number): number => {
    if (typeof live === 'number') {
      sources[field] = 'station'
      return live
    }
    sources[field] = 'model'
    return model
  }

  const tempF = pick('temp', o?.tempF, m.tempF)
  const speedMph = pick('speed', o?.speedMph, m.speedMph)
  const gustRaw = pick('gust', o?.gustMph, m.gustMph)
  const dirDeg = pick('dir', o?.dirDeg, m.dirDeg)
  const measured = Object.values(sources).includes('station')

  // A measured temperature needs a feels-like of its own: the model's belongs to the model's temperature.
  const feelsF = sources.temp === 'station' ? windChillF(tempF, speedMph) : m.feelsF
  // A gust is at least the sustained wind when both come from the same place. A
  // measured gust under a forecast wind (or the reverse) is left as read: raising
  // one to meet the other would show a number nobody reported. nws.ts and
  // mammoth.ts already apply this floor to each station's own pair.
  const gustMph = sources.speed === sources.gust ? Math.max(gustRaw, speedMph) : gustRaw

  return {
    tempF,
    feelsF,
    speedMph,
    gustMph,
    dirDeg,
    sky: m.sky,
    precipIn: m.precipIn,
    cloudPct: m.cloudPct,
    sources,
    station: measured ? station : null,
    feed: measured && o ? o.source : null,
    status: measured ? 'station' : observations === undefined ? 'pending' : 'model',
    observedAt: measured && o ? o.observedAt : null,
    gustAt: sources.gust === 'station' && o ? o.gustAt : null,
  }
}

const FIELD_NAMES: Record<Field, string> = {
  temp: 'temperature',
  speed: 'sustained wind',
  gust: 'gusts',
  dir: 'wind direction',
}
/** In the order the info text lists them. */
const FIELDS = Object.keys(FIELD_NAMES) as Field[]

/** The values no station supplied, in words, for the info text. */
export function modeledFields(current: Current): string[] {
  return FIELDS.filter((k) => current.sources[k] === 'model').map((k) => FIELD_NAMES[k])
}
