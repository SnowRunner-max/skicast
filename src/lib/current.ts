import type { Beacon, BeaconForecast, Observation, Station } from '../types'
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
  cloudPct: number
  sources: Record<Field, Source>
  /** The station each measured value came from. A beacon with backup stations can mix them. */
  stationFor: Partial<Record<Field, Station>>
  /** The stations that supplied at least one value, main station first. */
  stations: Station[]
  /**
   * station: at least one value is a measurement.
   * model: nothing is measured here (the station has nothing fresh, or failed).
   * pending: the station's readings have not arrived yet.
   */
  status: 'station' | 'model' | 'pending'
  /** ISO time of the measurement, when status is "station". With several stations, the oldest of their readings. */
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

/** The beacon's stations in the order they are read: its own, then its backups. */
export function beaconStations(beacon: Beacon): Station[] {
  return [beacon.weatherStation, ...(beacon.backupStations ?? [])]
}

/**
 * @param observations  Readings by station id, or undefined while they are still loading.
 */
export function resolveCurrent(forecast: BeaconForecast, observations: ObservationMap | undefined): Current {
  const m = forecast.now
  const readings = beaconStations(forecast.beacon).flatMap((station) => {
    const o = observations?.[station.id]
    return o ? [{ station, o }] : []
  })

  const stationFor: Current['stationFor'] = {}
  const sources = {} as Record<Field, Source>
  // Each value from the first station that has it, else the model.
  const pick = (field: Field, live: (o: Observation) => number | null, model: number): number => {
    const hit = readings.find(({ o }) => typeof live(o) === 'number')
    if (!hit) {
      sources[field] = 'model'
      return model
    }
    sources[field] = 'station'
    stationFor[field] = hit.station
    return live(hit.o)!
  }

  const tempF = pick('temp', (o) => o.tempF, m.tempF)
  const speedMph = pick('speed', (o) => o.speedMph, m.speedMph)
  const gustRaw = pick('gust', (o) => o.gustMph, m.gustMph)
  const dirDeg = pick('dir', (o) => o.dirDeg, m.dirDeg)
  const used = readings.filter(({ station }) => Object.values(stationFor).includes(station))
  const measured = used.length > 0

  // A measured temperature needs a feels-like of its own: the model's belongs to the model's temperature.
  const feelsF = sources.temp === 'station' ? windChillF(tempF, speedMph) : m.feelsF
  // Never show a sustained wind above the gust beside it.
  const gustMph = Math.max(gustRaw, sources.speed === sources.gust ? speedMph : 0)
  const gustReading = readings.find(({ station }) => station === stationFor.gust)

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
    stationFor,
    stations: used.map(({ station }) => station),
    status: measured ? 'station' : observations === undefined ? 'pending' : 'model',
    // Shown as "measured N min ago", so a mix of stations is only as fresh as its oldest reading.
    observedAt: measured
      ? used.map(({ o }) => o.observedAt).reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b))
      : null,
    gustAt: gustReading?.o.gustAt ?? null,
  }
}

const FIELD_NAMES: Record<Field, string> = {
  temp: 'temperature',
  speed: 'sustained wind',
  gust: 'gusts',
  dir: 'wind direction',
}

/** The values no station supplied, in words, for the info text. */
export function modeledFields(current: Current): string[] {
  return (Object.keys(FIELD_NAMES) as Field[]).filter((k) => current.sources[k] === 'model').map((k) => FIELD_NAMES[k])
}

/** Which values each station supplied, in words, main station first: [[station, ["temperature", "gusts"]], ...]. */
export function measuredBy(current: Current): [Station, string[]][] {
  return current.stations.map((station) => [
    station,
    (Object.keys(FIELD_NAMES) as Field[]).filter((k) => current.stationFor[k] === station).map((k) => FIELD_NAMES[k]),
  ])
}
