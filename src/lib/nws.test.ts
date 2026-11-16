import { BEACONS } from '../data/beacons'
import { fetchObservations, parseObservations } from './nws'
import { nwsResponse } from './__fixtures__/nws'

const NOW = Date.parse('2026-11-16T17:00:00Z')
const parse = (readings: Parameters<typeof nwsResponse>[1]) => parseObservations(nwsResponse(NOW, readings), 'MTH20', NOW)

describe('parseObservations', () => {
  it('converts NWS units to mph and degrees Fahrenheit', () => {
    const obs = parse([{ minAgo: 5, tempC: -5, speedKmh: 16.0934, gustKmh: 32.1869, dirDeg: 250 }])!
    expect(obs.tempF).toBeCloseTo(23, 5)
    expect(obs.speedMph).toBeCloseTo(10, 3)
    expect(obs.gustMph).toBeCloseTo(20, 3)
    expect(obs.dirDeg).toBe(250)
    expect(obs.stationId).toBe('MTH20')
  })

  it('stamps the reading with the newest time that supplied temperature or wind', () => {
    const obs = parse([{ minAgo: 12, tempC: -3, speedKmh: 8 }, { minAgo: 17, tempC: -3, speedKmh: 8 }])!
    expect(obs.observedAt).toBe(new Date(NOW - 12 * 60_000).toISOString())
  })

  it('takes each value from the newest reading that has it', () => {
    // The newest readings carry no gust: stations send it late.
    const obs = parse([
      { minAgo: 5, tempC: -4, speedKmh: 10, dirDeg: 200 },
      { minAgo: 10, tempC: -4, speedKmh: 12, dirDeg: 210 },
      { minAgo: 100, tempC: -4, speedKmh: 14, gustKmh: 40, dirDeg: 190 },
    ])!
    expect(obs.speedMph).toBeCloseTo(6.2, 1)
    expect(obs.gustMph).toBeCloseTo(24.9, 1)
    expect(obs.gustAt).toBe(new Date(NOW - 100 * 60_000).toISOString())
  })

  it('keeps a gust up to three hours old, but nothing else past two', () => {
    const obs = parse([
      { minAgo: 130, tempC: -4, speedKmh: 10 },
      { minAgo: 170, gustKmh: 50 },
    ])!
    expect(obs.tempF).toBeNull()
    expect(obs.speedMph).toBeNull()
    expect(obs.gustMph).toBeCloseTo(31.1, 1)
  })

  it('returns null when every reading is too old', () => {
    expect(parse([{ minAgo: 200, tempC: -4, speedKmh: 10, gustKmh: 30 }])).toBeNull()
  })

  it('returns null for a station that has sent nothing', () => {
    expect(parseObservations({ features: [] }, 'MTH20', NOW)).toBeNull()
  })

  it('reports what a temperature-only station has and leaves wind empty', () => {
    const obs = parse([{ minAgo: 5, tempC: 1 }, { minAgo: 15, tempC: 1.2 }])!
    expect(obs.tempF).toBeCloseTo(33.8, 1)
    expect(obs.speedMph).toBeNull()
    expect(obs.gustMph).toBeNull()
    expect(obs.dirDeg).toBeNull()
  })

  it('drops values that failed or are doubted by NWS quality control', () => {
    expect(parse([{ minAgo: 5, tempC: -4, speedKmh: 99, qc: 'X' }])).toBeNull()
    expect(parse([{ minAgo: 5, tempC: -4, speedKmh: 99, qc: 'Q' }])).toBeNull()
    expect(parse([{ minAgo: 5, tempC: -4, speedKmh: 10, qc: 'Z' }])!.speedMph).toBeCloseTo(6.2, 1)
  })

  it('never reports a gust below the sustained wind', () => {
    const obs = parse([{ minAgo: 5, speedKmh: 30 }, { minAgo: 20, gustKmh: 10 }])!
    expect(obs.gustMph).toBeCloseTo(18.6, 1)
  })

  it('ignores values in units it does not know rather than guessing', () => {
    const raw = nwsResponse(NOW, [{ minAgo: 5, tempC: -4, speedKmh: 10 }])
    raw.features[0]!.properties.windSpeed.unitCode = 'wmoUnit:knot'
    expect(parseObservations(raw, 'MTH20', NOW)!.speedMph).toBeNull()
  })

  it('rejects a response that is not a list of readings', () => {
    expect(() => parseObservations({ title: 'Not Found' }, 'MTH20', NOW)).toThrow(/no readings/)
  })
})

describe('fetchObservations', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks only for beacons that have a station, and one failing station leaves the rest alone', async () => {
    const now = Date.now()
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('/stations/MTH19/')) return new Response('down', { status: 503 })
      return new Response(JSON.stringify(nwsResponse(now, [{ minAgo: 5, tempC: -4, speedKmh: 10, dirDeg: 250 }])))
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchObservations(BEACONS)

    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls).toHaveLength(4)
    expect(urls.every((u) => u.startsWith('https://api.weather.gov/stations/MTH'))).toBe(true)
    expect(result.main).toBeNull() // no station at Main Lodge
    expect(result.canyon).toBeNull() // its station failed
    expect(result.summit?.stationId).toBe('MTH03')
    expect(result.mccoy?.speedMph).toBeCloseTo(6.2, 1)
  })
})
