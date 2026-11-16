import type { Beacon } from '../types'
import { MAP, type MapStation } from './mapPaths'

/**
 * Forecast points. Each is pinned to a lift station; its coordinates come from
 * that OSM node in the generated map data, so there is no separate lat/lon list.
 */
export const BEACONS: Beacon[] = [
  {
    id: 'summit',
    name: 'Summit',
    stationOsmId: 96939624,
    elevationFt: 11053,
    pinnedTo: 'Panorama Gondola top station',
    shortName: 'Summit',
    labelSide: 'right',
    weatherStation: { id: 'MTH03', name: 'Top Station' },
  },
  {
    id: 'mccoy',
    name: 'McCoy Station',
    stationOsmId: 96939622,
    elevationFt: 9600,
    pinnedTo: 'Panorama Gondola mid-station',
    shortName: 'McCoy',
    labelSide: 'left',
    weatherStation: { id: 'MTH20', name: 'McCoy Station' },
  },
  {
    id: 'main',
    name: 'Main Lodge',
    stationOsmId: 96939620,
    elevationFt: 8900,
    pinnedTo: 'Panorama Gondola bottom station',
    shortName: 'Main',
    labelSide: 'below',
    // No station here. Sesame (MTH05) is the nearest, 1,200 ft away and 125 ft higher, so it is not used.
    weatherStation: null,
  },
  {
    id: 'canyon',
    name: 'Canyon Lodge',
    stationOsmId: 11224268511,
    elevationFt: 8350,
    pinnedTo: 'Base of Canyon Express',
    shortName: 'Canyon',
    labelSide: 'left',
    weatherStation: { id: 'MTH19', name: 'Canyon Lodge' },
  },
  {
    id: 'eagle',
    name: 'Eagle Lodge',
    stationOsmId: 369251388,
    elevationFt: 8100,
    pinnedTo: 'Base of Eagle Express',
    shortName: 'Eagle',
    labelSide: 'left',
    weatherStation: { id: 'MTH17', name: 'Bottom of Chair 15' },
  },
]

export const DEFAULT_BEACON_ID = 'summit'

export function stationFor(beacon: Beacon): MapStation {
  const station = MAP.stations.find((s) => s.osmId === beacon.stationOsmId)
  if (!station) {
    throw new Error(`${beacon.name}: OSM node ${beacon.stationOsmId} is not in the map data. Re-run npm run map:build.`)
  }
  return station
}
