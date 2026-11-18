export interface Beacon {
  id: string
  name: string
  /** What the beacon sits at, in words. Shown under the name with the station's elevation. */
  pinnedTo: string
  /** Short name drawn next to the beacon on the map. */
  shortName: string
  /** Where the map label sits relative to the dot, chosen by hand to stay clear of lift lines and neighbours. */
  labelSide: 'left' | 'right' | 'below'
  /** The weather station the beacon is drawn at and reads from. */
  weatherStation: Station
  /**
   * The NWS forecast grid square the beacon's station sits in, from
   * api.weather.gov/points/{lat},{lon} (gridId, gridX, gridY). Squares are
   * 2.5 km across, so neighbouring beacons can share one.
   */
  forecastCell: ForecastCell
}

/** One square of the National Weather Service's forecast grid. */
export interface ForecastCell {
  /** Forecast office, e.g. "REV" for Reno. */
  office: string
  x: number
  y: number
}

/** One of Mammoth's weather stations, as listed in src/data/stations.ts. */
export interface Station {
  /** Mammoth's station identifier on its own station site, e.g. "MM-SUM". */
  id: string
  /** The same station's National Weather Service identifier, e.g. "MTH03", read when Mammoth's own feed has nothing fresh. Null for stations NWS does not carry. */
  nwsId: string | null
  /** Short name for the station as Mammoth labels it. */
  name: string
  lat: number
  lon: number
  /** As Mammoth labels it. Shown on screen, and used to correct the forecast grid square's temperature to the station's height. */
  elevationFt: number
}

import type { NwsWeather } from './lib/sky'

export interface WindHour {
  /** Local mountain time, e.g. "2026-11-15T15:00". */
  time: string
  speedMph: number
  gustMph: number
  /** Direction the wind comes from, degrees clockwise from north. */
  dirDeg: number
}

/** One forecast hour: its wind, plus what the sky is doing, for the Mountain Forecast's icons. */
export interface ForecastHour extends WindHour {
  /** Air temperature at the station's height, °F. Null when the forecast gives none for the hour. */
  tempF: number | null
  /** Null when the forecast gives none for the hour: unknown, which is not the same as clear. */
  cloudPct: number | null
  /** The forecast weather for the hour as NWS sends it; empty for none. */
  weather: NwsWeather[]
  /** Whether the sun is up at the station halfway through the hour, so a clear hour is drawn as a sun or a moon. */
  daylight: boolean
}

export interface BeaconForecast {
  beacon: Beacon
  now: {
    tempF: number
    feelsF: number
    /** Average per hour over the forecast period covering now, which NWS gives in blocks of up to six hours. */
    precipIn: number
    /** The sky in words: the forecast weather ("Chance of light snow") or, with none, the cloud cover ("Partly cloudy"). */
    sky: string
  } & ForecastHour
  next6: ForecastHour[]
  fetchedAt: string
}

/**
 * What a station is reporting now. Any value can be null: stations drop
 * sensors for hours (an iced anemometer, a temperature-only unit).
 */
export interface Observation {
  /** Mammoth's station id (see Station.id), whichever feed the reading came from. */
  stationId: string
  /** Mammoth's own station feed, or the National Weather Service's copy of it. */
  source: 'mammoth' | 'nws'
  /** ISO time of the newest reading that supplied temperature or sustained wind. */
  observedAt: string
  tempF: number | null
  speedMph: number | null
  /** The latest gust reported, which can be much older than `observedAt`. */
  gustMph: number | null
  /** ISO time that gust was reported, or null with no gust. */
  gustAt: string | null
  dirDeg: number | null
}
