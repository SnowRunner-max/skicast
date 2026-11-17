import sample from './__fixtures__/nws-grid-sample.json'
import { gridResponse } from './__fixtures__/nwsGrid'
import { BEACONS } from '../data/beacons'
import { beaconForecast, buildGridUrl, cellKey, durationMs, fetchForecast, parseGrid } from './nwsForecast'

const summit = BEACONS.find((b) => b.id === 'summit')!
const cloudNine = BEACONS.find((b) => b.id === 'cloudnine')!

/** 8:20 PM in Mammoth on 16 November 2026, within the saved response. */
const NOW = Date.parse('2026-11-17T04:20:00Z')

describe('the beacon grid squares', () => {
  it('needs four requests for the eight beacons', () => {
    expect(new Set(BEACONS.map((b) => cellKey(b.forecastCell)))).toEqual(
      new Set(['REV/57,17', 'REV/57,18', 'REV/58,17', 'REV/58,18']),
    )
  })

  it('builds the gridpoints URL', () => {
    expect(buildGridUrl(summit.forecastCell)).toBe('https://api.weather.gov/gridpoints/REV/57,17')
  })
})

describe('durationMs', () => {
  it('reads the hour and day spans NWS uses', () => {
    expect(durationMs('PT1H')).toBe(3_600_000)
    expect(durationMs('PT3H')).toBe(3 * 3_600_000)
    expect(durationMs('P1D')).toBe(24 * 3_600_000)
    expect(durationMs('P7DT8H')).toBe((7 * 24 + 8) * 3_600_000)
    expect(durationMs('nonsense')).toBeNaN()
  })
})

describe('parseGrid (saved response for Summit, Gold Rush and Cloud Nine)', () => {
  const grid = parseGrid(sample, NOW)

  it("reads this hour's wind from the three-hour block covering it", () => {
    const now = grid.hours[0]!
    expect(now.startMs).toBe(Date.parse('2026-11-17T04:00:00Z'))
    expect(now.gustMph).toBeCloseTo(29.9, 1)
    expect(now.speedMph).toBeCloseTo(19.6, 1)
    expect(now.dirDeg).toBe(220)
    expect(now.cloudPct).toBe(72)
  })

  it('spreads a six-hour precipitation total evenly over its hours', () => {
    // 1.778 mm over 00:00-06:00 UTC.
    expect(grid.hours[0]!.precipInPerHour).toBeCloseTo(1.778 / 25.4 / 6, 5)
  })

  it('gives the six hours after this one', () => {
    expect(grid.hours).toHaveLength(7)
    expect(grid.hours[2]!.gustMph).toBeCloseTo(32.2, 1) // the 06:00 UTC block
  })

  it("keeps the grid square's height for the temperature correction", () => {
    expect(grid.elevationM).toBeCloseTo(3009, 0)
  })

  it('rejects a response without wind', () => {
    expect(() => parseGrid({ properties: {} }, NOW, 'REV/1,1')).toThrow('NWS forecast for REV/1,1 is missing wind data')
  })

  it('rejects a forecast that does not reach this hour', () => {
    expect(() => parseGrid(sample, Date.parse('2026-11-20T12:00:00Z'), 'REV/57,17')).toThrow(/does not cover this hour/)
  })
})

describe('beaconForecast', () => {
  const grid = parseGrid(sample, NOW)
  const f = beaconForecast(summit, grid, 'fetched')

  it('moves the temperature from the grid square up to the station, about 360 m higher', () => {
    // -3.9 °C at 3009 m is about -6.2 °C at Top Station's 3369 m.
    expect(f.now.tempF).toBeCloseTo(20.8, 1)
  })

  it('leaves the wind as the grid square has it, so beacons in one square share it', () => {
    const other = beaconForecast(cloudNine, grid, 'fetched')
    expect(other.now.gustMph).toBe(f.now.gustMph)
    expect(other.now.tempF).toBeGreaterThan(f.now.tempF) // Cloud Nine's station is lower
  })

  it('works out feels-like from the corrected temperature', () => {
    expect(Math.round(f.now.feelsF)).toBe(5)
  })

  it('names the weather in words', () => {
    expect(f.now.sky).toBe('Light snow likely')
  })

  it('stamps the hours in mountain time', () => {
    expect(f.now.time).toBe('2026-11-16T20:00')
    expect(f.next6.map((h) => h.time)).toEqual([
      '2026-11-16T21:00',
      '2026-11-16T22:00',
      '2026-11-16T23:00',
      '2026-11-17T00:00',
      '2026-11-17T01:00',
      '2026-11-17T02:00',
    ])
  })
})

describe('parseGrid (built responses)', () => {
  const base = { tempF: 20, speedMph: 15, gustMph: 25, dirDeg: 270 }

  it('uses the sustained wind for the gust when the grid has none, and never a gust below it', () => {
    const grid = parseGrid(gridResponse(NOW, [{ ...base, gustMph: null }, { ...base, gustMph: 10 }], 3000), NOW)
    expect(grid.hours.map((h) => Math.round(h.gustMph))).toEqual([15, 15])
  })

  it('stops the hours where the forecast does', () => {
    expect(parseGrid(gridResponse(NOW, [base, base, base], 3000), NOW).hours).toHaveLength(3)
  })
})

describe('fetchForecast', () => {
  afterEach(() => vi.unstubAllGlobals())

  const respond = () => Promise.resolve(new Response(JSON.stringify(gridResponse(Date.now(), [{ tempF: 20, speedMph: 15, gustMph: 25, dirDeg: 270 }], 3000))))

  it('asks once per grid square and gives every beacon its forecast, in order', async () => {
    const fetchMock = vi.fn(respond)
    vi.stubGlobal('fetch', fetchMock)
    const forecasts = await fetchForecast(BEACONS)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(forecasts.map((f) => f.beacon.id)).toEqual(BEACONS.map((b) => b.id))
  })

  it('tries a failed square once more before giving up', async () => {
    let failures = 1
    const fetchMock = vi.fn(() => (failures-- > 0 ? Promise.resolve(new Response('busy', { status: 500 })) : respond()))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchForecast(BEACONS.slice(0, 1))).resolves.toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails when a square fails twice', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('down', { status: 503 }))))
    await expect(fetchForecast(BEACONS.slice(0, 1))).rejects.toThrow('NWS answered 503 for /gridpoints/REV/57,17')
  })
})
