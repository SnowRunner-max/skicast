import sample from './__fixtures__/open-meteo-sample.json'
import { BEACONS } from '../data/beacons'
import { modeledFields, resolveCurrent, windChillF } from './current'
import { parseForecast } from './openMeteo'
import type { Observation } from '../types'

const forecasts = parseForecast(sample, BEACONS, '2026-11-16T05:20:00.000Z')
const [summit, , main, , eagle] = forecasts as [(typeof forecasts)[0], unknown, (typeof forecasts)[0], unknown, (typeof forecasts)[0]]

const obs = (o: Partial<Observation>): Observation => ({
  stationId: 'MTH03',
  observedAt: '2026-11-16T05:10:00.000Z',
  tempF: null,
  speedMph: null,
  gustMph: null,
  gustAt: null,
  dirDeg: null,
  ...o,
})

describe('windChillF', () => {
  it('matches the NWS chart: 20 F with 15 mph wind feels like 6 F', () => {
    expect(Math.round(windChillF(20, 15))).toBe(6)
  })
  it('is just the temperature when it is warm or the wind is light', () => {
    expect(windChillF(60, 20)).toBe(60)
    expect(windChillF(20, 2)).toBe(20)
  })
})

describe('resolveCurrent', () => {
  it('uses the station for every value it has', () => {
    const c = resolveCurrent(
      summit,
      obs({ tempF: 24, speedMph: 6, gustMph: 15, gustAt: '2026-11-16T04:00:00.000Z', dirDeg: 270 }),
    )
    expect([c.tempF, c.speedMph, c.gustMph, c.dirDeg]).toEqual([24, 6, 15, 270])
    expect(c.sources).toEqual({ temp: 'station', speed: 'station', gust: 'station', dir: 'station' })
    expect(c.status).toBe('station')
    expect(c.observedAt).toBe('2026-11-16T05:10:00.000Z')
    expect(c.gustAt).toBe('2026-11-16T04:00:00.000Z')
  })

  it('falls back to the model for just the values the station lacks', () => {
    // Summit's station reports temperature and gusts only.
    const c = resolveCurrent(summit, obs({ tempF: 22, gustMph: 37 }))
    expect(c.sources).toEqual({ temp: 'station', speed: 'model', gust: 'station', dir: 'model' })
    expect(c.gustMph).toBe(37)
    expect(c.speedMph).toBe(summit.now.speedMph)
    expect(c.dirDeg).toBe(summit.now.dirDeg)
    expect(modeledFields(c)).toEqual(['sustained wind', 'wind direction'])
  })

  it('computes feels-like from a measured temperature, not the model', () => {
    const c = resolveCurrent(summit, obs({ tempF: 20, speedMph: 15 }))
    expect(Math.round(c.feelsF)).toBe(6)
  })

  it('keeps sky, precipitation and cloud cover from the model', () => {
    const c = resolveCurrent(summit, obs({ tempF: 22, speedMph: 5 }))
    expect([c.code, c.precipIn, c.cloudPct]).toEqual([summit.now.code, summit.now.precipIn, summit.now.cloudPct])
  })

  it('is all model, and says so, for a point with no station', () => {
    const c = resolveCurrent(main, null)
    expect(c.status).toBe('model')
    expect(c.gustMph).toBe(main.now.gustMph)
    expect(c.feelsF).toBe(main.now.feelsF)
    expect(c.observedAt).toBeNull()
  })

  it('is all model when the station has nothing fresh', () => {
    expect(resolveCurrent(summit, null).status).toBe('model')
  })

  it('is pending, not model, while a station point is still waiting on its readings', () => {
    expect(resolveCurrent(summit, undefined).status).toBe('pending')
    expect(resolveCurrent(main, undefined).status).toBe('model')
  })

  it('counts a temperature-only station as measured, with a forecast gust', () => {
    const c = resolveCurrent(eagle, obs({ stationId: 'MTH17', tempF: 34 }))
    expect(c.status).toBe('station')
    expect(c.sources.gust).toBe('model')
    expect(c.gustMph).toBe(eagle.now.gustMph)
  })

  it('never shows a measured sustained wind above its own measured gust', () => {
    expect(resolveCurrent(summit, obs({ speedMph: 18, gustMph: 12 })).gustMph).toBe(18)
  })
})
