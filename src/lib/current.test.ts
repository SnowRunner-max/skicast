import { measuredBy, modeledFields, resolveCurrent, windChillF } from './current'
import { mammothForecasts } from './__fixtures__/nwsGrid'
import type { Observation } from '../types'

const forecasts = mammothForecasts(Date.parse('2026-11-16T05:20:00.000Z'), '2026-11-16T05:20:00.000Z')
const byId = (id: string) => forecasts.find((f) => f.beacon.id === id)!
const summit = byId('summit')
const sesame = byId('sesame')
const eagleTop = byId('eagletop')

/** Readings keyed by station id, as the app holds them. */
const at = (...readings: Observation[]) => Object.fromEntries(readings.map((o) => [o.stationId, o]))

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
      at(obs({ tempF: 24, speedMph: 6, gustMph: 15, gustAt: '2026-11-16T04:00:00.000Z', dirDeg: 270 })),
    )
    expect([c.tempF, c.speedMph, c.gustMph, c.dirDeg]).toEqual([24, 6, 15, 270])
    expect(c.sources).toEqual({ temp: 'station', speed: 'station', gust: 'station', dir: 'station' })
    expect(c.status).toBe('station')
    expect(c.observedAt).toBe('2026-11-16T05:10:00.000Z')
    expect(c.gustAt).toBe('2026-11-16T04:00:00.000Z')
  })

  it('falls back to the model for just the values the station lacks', () => {
    // Summit's station reports temperature and gusts only.
    const c = resolveCurrent(summit, at(obs({ tempF: 22, gustMph: 37 })))
    expect(c.sources).toEqual({ temp: 'station', speed: 'model', gust: 'station', dir: 'model' })
    expect(c.gustMph).toBe(37)
    expect(c.speedMph).toBe(summit.now.speedMph)
    expect(c.dirDeg).toBe(summit.now.dirDeg)
    expect(modeledFields(c)).toEqual(['sustained wind', 'wind direction'])
  })

  it('computes feels-like from a measured temperature, not the model', () => {
    const c = resolveCurrent(summit, at(obs({ tempF: 20, speedMph: 15 })))
    expect(Math.round(c.feelsF)).toBe(6)
  })

  it('keeps sky, precipitation and cloud cover from the model', () => {
    const c = resolveCurrent(summit, at(obs({ tempF: 22, speedMph: 5 })))
    expect([c.sky, c.precipIn, c.cloudPct]).toEqual([summit.now.sky, summit.now.precipIn, summit.now.cloudPct])
  })

  it('is all model, and says so, when the station has nothing fresh', () => {
    const c = resolveCurrent(sesame, {})
    expect(c.status).toBe('model')
    expect(c.gustMph).toBe(sesame.now.gustMph)
    expect(c.feelsF).toBe(sesame.now.feelsF)
    expect(c.observedAt).toBeNull()
  })

  it('is pending, not model, while the station is still waiting on its readings', () => {
    expect(resolveCurrent(summit, undefined).status).toBe('pending')
  })

  it('counts a temperature-only reading as measured, with a forecast gust', () => {
    const c = resolveCurrent(eagleTop, at(obs({ stationId: 'MTH22', tempF: 34 })))
    expect(c.status).toBe('station')
    expect(c.sources.gust).toBe('model')
    expect(c.gustMph).toBe(eagleTop.now.gustMph)
  })

  it("fills what the summit's station lacks from its backup, value by value", () => {
    const top = obs({ stationId: 'MTH03', observedAt: '2026-11-16T05:10:00.000Z', tempF: 22, gustMph: 37, gustAt: '2026-11-16T04:00:00.000Z' })
    const tower = obs({ stationId: 'MTH12', observedAt: '2026-11-16T05:00:00.000Z', speedMph: 12, dirDeg: 250, gustMph: 20, gustAt: '2026-11-16T05:00:00.000Z' })
    const c = resolveCurrent(summit, at(top, tower))
    expect([c.tempF, c.speedMph, c.gustMph, c.dirDeg]).toEqual([22, 12, 37, 250])
    expect(c.sources).toEqual({ temp: 'station', speed: 'station', gust: 'station', dir: 'station' })
    expect(c.stationFor.temp?.id).toBe('MTH03')
    expect(c.stationFor.gust?.id).toBe('MTH03') // the main station's gust wins
    expect(c.stationFor.speed?.id).toBe('MTH12')
    expect(c.stations.map((s) => s.id)).toEqual(['MTH03', 'MTH12'])
    expect(c.gustAt).toBe('2026-11-16T04:00:00.000Z')
    // Only as fresh as the older of the two.
    expect(c.observedAt).toBe('2026-11-16T05:00:00.000Z')
    expect(measuredBy(c).map(([s, fields]) => [s.id, fields])).toEqual([
      ['MTH03', ['temperature', 'gusts']],
      ['MTH12', ['sustained wind', 'wind direction']],
    ])
  })

  it('reads the backup alone when the main station has nothing', () => {
    const c = resolveCurrent(summit, { MTH03: null, ...at(obs({ stationId: 'MTH12', speedMph: 12, dirDeg: 250 })) })
    expect(c.status).toBe('station')
    expect(c.stations.map((s) => s.id)).toEqual(['MTH12'])
    expect(c.sources).toEqual({ temp: 'model', speed: 'station', gust: 'model', dir: 'station' })
  })

  it("ignores stations that are not the beacon's", () => {
    const mccoy = byId('mccoy')
    const c = resolveCurrent(mccoy, at(obs({ stationId: 'MTH03', tempF: 10, speedMph: 30 })))
    expect(c.status).toBe('model')
    expect(c.stations).toEqual([])
  })

  it('never shows a measured sustained wind above its own measured gust', () => {
    expect(resolveCurrent(summit, at(obs({ speedMph: 18, gustMph: 12 }))).gustMph).toBe(18)
  })
})
