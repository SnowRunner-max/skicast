export interface Beacon {
  id: string
  name: string
  /** OSM node id of the lift station the beacon is pinned to. */
  stationOsmId: number
  /** Approximate. Shown on screen and sent to Open-Meteo, which corrects temperature (not wind) for it. */
  elevationFt: number
  /** What the beacon is pinned to, in words. */
  pinnedTo: string
  /** Short name drawn next to the beacon on the map. */
  shortName: string
  /** Where the map label sits relative to the dot, chosen by hand to stay clear of lift lines. */
  labelSide: 'left' | 'right' | 'below'
  /**
   * The weather station at this spot, or null when there is none. Only a
   * station at the point itself belongs here; a neighbour on a different
   * slope or a few hundred feet higher is a different wind.
   */
  weatherStation: WeatherStation | null
}

export interface WeatherStation {
  /** NWS station identifier, e.g. "MTH03". */
  id: string
  /** Short name for the station as Mammoth labels it. */
  name: string
}

export interface WindHour {
  /** Local mountain time, e.g. "2026-11-15T15:00". */
  time: string
  speedMph: number
  gustMph: number
  /** Direction the wind comes from, degrees clockwise from north. */
  dirDeg: number
}

export interface BeaconForecast {
  beacon: Beacon
  now: { tempF: number; feelsF: number; precipIn: number; cloudPct: number; code: number } & WindHour
  next6: WindHour[]
  fetchedAt: string
}

/**
 * What a station is reporting now. Any value can be null: stations drop
 * sensors for hours (an iced anemometer, a temperature-only unit).
 */
export interface Observation {
  stationId: string
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
