import type { Beacon } from '../types'
import { MAP } from './mapPaths'
import { project, type Point } from '../lib/projection'
import { stationById } from './stations'

/**
 * The points drawn on the map, each at one of Mammoth's weather stations. The
 * other stations in stations.ts are fetched too but not drawn.
 *
 * Each `forecastCell` is the NWS grid square for the station's coordinates,
 * looked up in November 2026. If NWS ever redraws its grid, the forecast
 * request fails loudly; look the stations up again at api.weather.gov/points.
 */
export const BEACONS: Beacon[] = [
  {
    id: 'summit',
    name: 'Summit',
    pinnedTo: 'Panorama Gondola top station',
    shortName: 'Summit',
    labelSide: 'right',
    weatherStation: stationById('MM-SUM'),
    forecastCell: { office: 'REV', x: 57, y: 17 },
  },
  {
    id: 'mccoy',
    name: 'McCoy Station',
    pinnedTo: 'Panorama Gondola mid-station',
    shortName: 'McCoy',
    labelSide: 'left',
    weatherStation: stationById('MM-MCY'),
    forecastCell: { office: 'REV', x: 57, y: 18 },
  },
  {
    id: 'broadway',
    name: 'Top of Broadway',
    pinnedTo: 'Top of Broadway Express (Chair 1)',
    shortName: 'Broadway',
    labelSide: 'right',
    weatherStation: stationById('MM-C1T'),
    forecastCell: { office: 'REV', x: 57, y: 18 },
  },
  {
    id: 'goldrush',
    name: 'Top of Gold Rush',
    pinnedTo: 'Tower 20, at the top of Gold Rush Express (Chair 10)',
    shortName: 'Gold Rush',
    labelSide: 'left',
    weatherStation: stationById('MM-C10T20'),
    forecastCell: { office: 'REV', x: 57, y: 17 },
  },
  {
    id: 'cloudnine',
    name: 'Cloud Nine',
    pinnedTo: 'Tower 11, midway up Cloud Nine Express (Chair 9)',
    shortName: 'Cloud Nine',
    labelSide: 'left',
    weatherStation: stationById('MM-C9T11'),
    forecastCell: { office: 'REV', x: 57, y: 17 },
  },
  {
    id: 'sesame',
    name: 'Sesame',
    pinnedTo: 'Beside Main Lodge',
    shortName: 'Sesame',
    // Below, not beside: it is the right-most beacon, and a side label runs off a phone screen.
    labelSide: 'below',
    weatherStation: stationById('MM-SES'),
    forecastCell: { office: 'REV', x: 57, y: 18 },
  },
  {
    id: 'eagletop',
    name: 'Top of Eagle',
    pinnedTo: 'Top of Eagle Express (Chair 15)',
    shortName: 'Top of Eagle',
    // Below, not beside: it is the left-most beacon, and a side label runs off a phone screen.
    labelSide: 'below',
    weatherStation: stationById('MM-T15'),
    forecastCell: { office: 'REV', x: 58, y: 17 },
  },
  {
    id: 'canyon',
    name: 'Canyon Lodge',
    pinnedTo: 'Base of Canyon Express',
    shortName: 'Canyon',
    labelSide: 'left',
    weatherStation: stationById('MM-CLG'),
    forecastCell: { office: 'REV', x: 58, y: 18 },
  },
]

export const DEFAULT_BEACON_ID = 'summit'

/** Where a beacon sits on the map, in map units: on its weather station. */
export function beaconPoint(beacon: Beacon): Point {
  const { lat, lon } = beacon.weatherStation
  return project(MAP.projection, lat, lon)
}
