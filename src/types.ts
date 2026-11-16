export interface Beacon {
  id: string
  name: string
  /** OSM node id of the lift station the beacon is pinned to. */
  stationOsmId: number
  /** Approximate; only used to correct the forecast for altitude. */
  elevationFt: number
  /** What the beacon is pinned to, in words. */
  pinnedTo: string
  /** Short name drawn next to the beacon on the map. */
  shortName: string
  /** Where the map label sits relative to the dot, chosen by hand to stay clear of lift lines. */
  labelSide: 'left' | 'right' | 'below'
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
