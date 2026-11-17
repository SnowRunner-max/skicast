import type { Station } from '../types'

/**
 * Every weather station Mammoth Mountain runs, as listed by the National
 * Weather Service (api.weather.gov/stations/MTHnn). IDs MTH04, MTH06, MTH13,
 * MTH14 and MTH25 onward do not exist.
 *
 * Skicast fetches all of them, not just the ones the map shows, so the
 * readings are on hand for interpolating between stations later.
 *
 * Coordinates are NWS's. Elevations are the ones Mammoth puts in each station's
 * name. The comment on each line is what the station sent in November 2026; a
 * sensor that was down then may come back.
 */
export const STATIONS: readonly Station[] = [
  { id: 'MTH01', name: 'Chair 1 Top', lat: 37.64196, lon: -119.03611, elevationFt: 9875 }, // wind, direction, gust
  { id: 'MTH02', name: 'Top of 22', lat: 37.63707, lon: -119.0174, elevationFt: 10067 }, // temperature, gust
  { id: 'MTH03', name: 'Top Station', lat: 37.63059, lon: -119.03282, elevationFt: 11053 }, // temperature, gust
  { id: 'MTH05', name: 'Sesame', lat: 37.64982, lon: -119.04175, elevationFt: 9014 }, // temperature, wind, direction, gust
  { id: 'MTH07', name: 'Chair 10 Tower 17', lat: 37.63796, lon: -119.0223, elevationFt: 9601 }, // gust
  { id: 'MTH08', name: 'Chair 10 Tower 20', lat: 37.63644, lon: -119.02172, elevationFt: 9875 }, // wind, direction, gust
  { id: 'MTH09', name: 'Gondola 1 Tower 6', lat: 37.64689, lon: -119.03421, elevationFt: 9259 }, // wind, direction, gust
  { id: 'MTH10', name: 'Gondola 1 Tower 12', lat: 37.64451, lon: -119.03216, elevationFt: 9496 }, // wind, direction, gust
  { id: 'MTH11', name: 'Gondola 2 Tower 8', lat: 37.63469, lon: -119.03228, elevationFt: 10506 }, // wind, direction, gust
  { id: 'MTH12', name: 'Gondola 2 Tower 10', lat: 37.63108, lon: -119.03315, elevationFt: 10999 }, // wind, direction, gust
  { id: 'MTH15', name: 'Chair 9 Tower 11', lat: 37.62857, lon: -119.01697, elevationFt: 9421 }, // wind, direction, gust
  { id: 'MTH16', name: 'Chair 9 Tower 15', lat: 37.62886, lon: -119.0221, elevationFt: 9846 }, // gust
  { id: 'MTH17', name: 'Bottom of 15 (Little Eagle)', lat: 37.63654, lon: -118.99059, elevationFt: 8107 }, // temperature
  { id: 'MTH18', name: 'Bottom of Chair 10 (The Mill)', lat: 37.65081, lon: -119.02724, elevationFt: 8799 }, // temperature
  { id: 'MTH19', name: 'Canyon Lodge', lat: 37.64475, lon: -119.00272, elevationFt: 8343 }, // temperature, wind, direction, gust
  { id: 'MTH20', name: 'McCoy Station', lat: 37.64149, lon: -119.0317, elevationFt: 9630 }, // temperature, wind, direction, gust
  { id: 'MTH21', name: 'Bottom of 9', lat: 37.64696, lon: -119.01112, elevationFt: 8726 }, // temperature, wind, direction, gust
  { id: 'MTH22', name: 'Top of 15', lat: 37.63548, lon: -119.00901, elevationFt: 9047 }, // temperature, wind, direction, gust
  { id: 'MTH23', name: 'Top of 3', lat: 37.63474, lon: -119.03301, elevationFt: 10489 }, // temperature
  { id: 'MTH24', name: "Woolly's", lat: 37.65115, lon: -119.00782, elevationFt: 8653 }, // nothing recent
]

export function stationById(id: string): Station {
  const station = STATIONS.find((s) => s.id === id)
  if (!station) throw new Error(`No weather station ${id} in stations.ts`)
  return station
}
