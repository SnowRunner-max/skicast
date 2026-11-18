import type { Station } from '../types'

/**
 * Every weather station Mammoth Mountain runs, as listed on its own station
 * site (mammothmountain.westernweathergroup.com, station group 454). That site
 * is where Skicast reads them; the National Weather Service carries most of
 * them too (api.weather.gov/stations/MTHnn), with gaps, and is read only when
 * Mammoth's feed has nothing fresh for a station.
 *
 * The site's group also holds two June Mountain stations; they are published
 * by /api/stations but are not Mammoth's, so they are not listed here.
 *
 * Coordinates are the site's. Elevations are the ones Mammoth puts in each
 * station's name. The comment on each line is what the station sent on
 * 18 November 2026; a sensor that was down then may come back.
 */
export const STATIONS: readonly Station[] = [
  { id: 'MM-C1T', nwsId: 'MTH01', name: 'Chair 1 Top', lat: 37.64196, lon: -119.03611, elevationFt: 9875 }, // wind, direction, gust, a second (sonic) anemometer
  { id: 'MM-T22', nwsId: 'MTH02', name: 'Top of 22', lat: 37.63707, lon: -119.0174, elevationFt: 10067 }, // temperature, humidity, wind, direction, gust
  { id: 'MM-SUM', nwsId: 'MTH03', name: 'Top Station', lat: 37.63059, lon: -119.03282, elevationFt: 11053 }, // temperature, humidity, wind, direction, gust
  { id: 'MM-SES', nwsId: 'MTH05', name: 'Sesame', lat: 37.64982, lon: -119.04175, elevationFt: 9014 }, // temperature, humidity, wind, direction, gust, pressure, snow, precipitation
  { id: 'MM-C10T17', nwsId: 'MTH07', name: 'Chair 10 Tower 17', lat: 37.63796, lon: -119.0223, elevationFt: 9601 }, // wind, direction, gust
  { id: 'MM-C10T20', nwsId: 'MTH08', name: 'Chair 10 Tower 20', lat: 37.63644, lon: -119.02172, elevationFt: 9875 }, // wind, direction, gust
  { id: 'MM-G1T6', nwsId: 'MTH09', name: 'Gondola 1 Tower 6', lat: 37.64689, lon: -119.03421, elevationFt: 9259 }, // wind, direction, gust
  { id: 'MM-G1T12', nwsId: 'MTH10', name: 'Gondola 1 Tower 12', lat: 37.64451, lon: -119.03216, elevationFt: 9496 }, // wind, direction, gust
  { id: 'MM-G2T8', nwsId: 'MTH11', name: 'Gondola 2 Tower 8', lat: 37.63469, lon: -119.03228, elevationFt: 10506 }, // wind, direction, gust
  { id: 'MM-G2T10', nwsId: 'MTH12', name: 'Gondola 2 Tower 10', lat: 37.63108, lon: -119.03315, elevationFt: 10999 }, // wind, direction, gust; reads far below Top Station
  { id: 'MM-C9T11', nwsId: 'MTH15', name: 'Chair 9 Tower 11', lat: 37.62857, lon: -119.01697, elevationFt: 9421 }, // wind, direction, gust
  { id: 'MM-C9T15', nwsId: 'MTH16', name: 'Chair 9 Tower 15', lat: 37.62886, lon: -119.0221, elevationFt: 9846 }, // wind, direction, gust
  { id: 'MM-B15', nwsId: 'MTH17', name: 'Bottom of 15 (Little Eagle)', lat: 37.63654, lon: -118.99059, elevationFt: 8107 }, // temperature, humidity
  { id: 'MM-BC10', nwsId: 'MTH18', name: 'Bottom of Chair 10 (The Mill)', lat: 37.65081, lon: -119.02724, elevationFt: 8799 }, // temperature; humidity sensor faulty (3%)
  { id: 'MM-CLG', nwsId: 'MTH19', name: 'Canyon Lodge', lat: 37.64475, lon: -119.00272, elevationFt: 8343 }, // temperature, humidity, wind, direction, gust
  { id: 'MM-MCY', nwsId: 'MTH20', name: 'McCoy Station', lat: 37.64149, lon: -119.0317, elevationFt: 9630 }, // temperature, humidity, wind, direction, gust
  { id: 'MM-RMKB9', nwsId: 'MTH21', name: 'Bottom of 9', lat: 37.64696, lon: -119.01112, elevationFt: 8726 }, // temperature, humidity, wind, direction, gust, snow, precipitation (15-minute feed only)
  { id: 'MM-T15', nwsId: 'MTH22', name: 'Top of 15', lat: 37.63548, lon: -119.00901, elevationFt: 9047 }, // temperature, humidity, wind, direction, gust
  { id: 'MM-T3', nwsId: 'MTH23', name: 'Top of 3', lat: 37.63474, lon: -119.03301, elevationFt: 10489 }, // temperature, humidity
  { id: 'MM-WLY', nwsId: 'MTH24', name: "Woolly's", lat: 37.65115, lon: -119.00782, elevationFt: 8653 }, // nothing
  { id: 'MM-C2T', nwsId: null, name: 'Chair 2 Top', lat: 37.6411, lon: -119.03496, elevationFt: 9843 }, // temperature, humidity; installed August 2026
  { id: 'MM-B4', nwsId: null, name: 'Bottom of 4', lat: 37.65013, lon: -119.02692, elevationFt: 8813 }, // nothing
  { id: 'MM-B16', nwsId: null, name: 'Bottom of 16', lat: 37.6445, lon: -119.00303, elevationFt: 8352 }, // nothing
  { id: 'MM-T6', nwsId: null, name: 'Top of Old 6', lat: 37.63382, lon: -119.04584, elevationFt: 10089 }, // nothing
]

export function stationById(id: string): Station {
  const station = STATIONS.find((s) => s.id === id)
  if (!station) throw new Error(`No weather station ${id} in stations.ts`)
  return station
}
