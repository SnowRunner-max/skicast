import { modeledFields, resolveCurrent, windChillF } from './current'
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
  stationId: 'MM-SUM',
  source: 'mammoth',
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
    expect(c.station?.id).toBe('MM-SUM')
    expect(c.feed).toBe('mammoth')
  })

  it('falls back to the model for just the values the station lacks', () => {
    // Through NWS, the summit's station often arrives with temperature and gusts only.
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
    const c = resolveCurrent(eagleTop, at(obs({ stationId: 'MM-T15', tempF: 34 })))
    expect(c.status).toBe('station')
    expect(c.sources.gust).toBe('model')
    expect(c.gustMph).toBe(eagleTop.now.gustMph)
  })

  it('never borrows a value from a neighbouring station', () => {
    // Gondola 2 Tower 10 sits 220 ft from Top Station but can read a tenth of its wind.
    const tower = obs({ stationId: 'MM-G2T10', speedMph: 4, dirDeg: 144, gustMph: 13 })
    const c = resolveCurrent(summit, { 'MM-SUM': null, ...at(tower) })
    expect(c.status).toBe('model')
    expect(c.station).toBeNull()
    expect(c.speedMph).toBe(summit.now.speedMph)
  })

  it("ignores stations that are not the beacon's", () => {
    const mccoy = byId('mccoy')
    const c = resolveCurrent(mccoy, at(obs({ stationId: 'MM-SUM', tempF: 10, speedMph: 30 })))
    expect(c.status).toBe('model')
    expect(c.station).toBeNull()
  })

  it('never shows a measured sustained wind above its own measured gust', () => {
    expect(resolveCurrent(summit, at(obs({ speedMph: 18, gustMph: 12 }))).gustMph).toBe(18)
  })

  it('says which feed the reading came from', () => {
    const c = resolveCurrent(summit, at(obs({ source: 'nws', tempF: 22 })))
    expect(c.feed).toBe('nws')
  })

  it('does not raise a measured gust to meet a forecast wind', () => {
    const c = resolveCurrent(summit, at(obs({ tempF: 22, gustMph: 1 })))
    expect(c.sources.speed).toBe('model')
    expect(c.speedMph).toBeGreaterThan(1) // the fixture's forecast wind, which the gust is not raised to
    expect(c.gustMph).toBe(1)
  })
})
