import sample from './__fixtures__/open-meteo-sample.json'
import { buildForecastUrl, parseForecast, type ForecastPoint } from './openMeteo'
import { BEACONS, stationFor } from '../data/beacons'

const points: ForecastPoint[] = BEACONS.map((beacon) => {
  const { lat, lon } = stationFor(beacon)
  return { beacon, lat, lon }
})

describe('buildForecastUrl', () => {
  const url = new URL(buildForecastUrl(points))

  it('asks for all five beacons in one request', () => {
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast')
    expect(url.searchParams.get('latitude')?.split(',')).toHaveLength(5)
    expect(url.searchParams.get('longitude')?.split(',')).toHaveLength(5)
  })

  it('sends each beacon elevation in metres', () => {
    expect(url.searchParams.get('elevation')).toBe('3369,2926,2713,2545,2469')
  })

  it('asks for this hour plus the next six, in mountain units and time', () => {
    expect(url.searchParams.get('forecast_hours')).toBe('7')
    expect(url.searchParams.get('wind_speed_unit')).toBe('mph')
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit')
    expect(url.searchParams.get('precipitation_unit')).toBe('inch')
    expect(url.searchParams.get('timezone')).toBe('America/Los_Angeles')
  })

  it('pins the National Blend model, so the name shown on screen is the one used', () => {
    expect(url.searchParams.get('models')).toBe('ncep_nbm_conus')
  })

  it('takes a different base URL for a paid key', () => {
    expect(buildForecastUrl(points, 'https://customer-api.open-meteo.com/v1/forecast')).toMatch(
      /^https:\/\/customer-api\.open-meteo\.com\/v1\/forecast\?latitude=/,
    )
  })
})

describe('parseForecast (saved sample response)', () => {
  const forecasts = parseForecast(sample, BEACONS, '2026-11-16T05:20:00.000Z')

  it('returns one forecast per beacon, in order', () => {
    expect(forecasts.map((f) => f.beacon.id)).toEqual(['summit', 'mccoy', 'main', 'canyon', 'eagle'])
  })

  it('reads current weather and wind', () => {
    expect(forecasts[0]!.now).toEqual({
      time: '2026-11-15T21:15',
      tempF: 20.8,
      feelsF: 7.0,
      precipIn: 0,
      cloudPct: 0,
      code: 0,
      speedMph: 17.7,
      gustMph: 24.4,
      dirDeg: 229,
    })
  })

  it('gives the six hours after the current one', () => {
    const summit = forecasts[0]!
    expect(summit.next6.map((h) => h.time)).toEqual([
      '2026-11-15T22:00',
      '2026-11-15T23:00',
      '2026-11-16T00:00',
      '2026-11-16T01:00',
      '2026-11-16T02:00',
      '2026-11-16T03:00',
    ])
    expect(summit.next6[1]).toEqual({ time: '2026-11-15T23:00', speedMph: 17.9, gustMph: 28.4, dirDeg: 227 })
  })

  it('stamps every forecast with the fetch time', () => {
    expect(new Set(forecasts.map((f) => f.fetchedAt))).toEqual(new Set(['2026-11-16T05:20:00.000Z']))
  })

  it('accepts a bare object when there is a single location', () => {
    const one = parseForecast((sample as unknown[])[0], BEACONS.slice(0, 1), 'now')
    expect(one).toHaveLength(1)
  })

  it('rejects a response with the wrong number of locations', () => {
    expect(() => parseForecast((sample as unknown[]).slice(0, 2), BEACONS, 'now')).toThrow(/Expected 5 locations/)
  })

  it('rejects a response without wind data', () => {
    expect(() => parseForecast([{ current: {} }], BEACONS.slice(0, 1), 'now')).toThrow(/missing wind data/)
  })
})
