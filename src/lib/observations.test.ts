import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Observation, Station } from '../types'
import { chooseReading, fetchAllObservations } from './observations'

const NOW = Date.parse('2026-11-18T18:11:00Z')
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

const reading = (source: Observation['source'], ageMin: number, speedMph: number | null = 30): Observation => ({
  stationId: 'MM-SUM',
  source,
  observedAt: minAgo(ageMin),
  tempF: 20,
  speedMph,
  gustMph: 45,
  gustAt: minAgo(ageMin),
  dirDeg: 250,
})

describe('chooseReading', () => {
  it('keeps a Mammoth reading up to 10 minutes old, even when NWS is newer', () => {
    const mammoth = reading('mammoth', 9)
    expect(chooseReading(mammoth, reading('nws', 2), NOW)).toBe(mammoth)
    const atLimit = reading('mammoth', 10)
    expect(chooseReading(atLimit, reading('nws', 2), NOW)).toBe(atLimit)
  })

  it('takes a newer NWS reading once Mammoth has missed a further cycle', () => {
    const nws = reading('nws', 5)
    expect(chooseReading(reading('mammoth', 11), nws, NOW)).toBe(nws)
  })

  it('keeps a stale Mammoth reading when NWS is older still', () => {
    const mammoth = reading('mammoth', 25)
    expect(chooseReading(mammoth, reading('nws', 60), NOW)).toBe(mammoth)
  })

  it('takes whichever exists when only one feed has the station', () => {
    const nws = reading('nws', 40)
    expect(chooseReading(null, nws, NOW)).toBe(nws)
    const mammoth = reading('mammoth', 40)
    expect(chooseReading(mammoth, null, NOW)).toBe(mammoth)
    expect(chooseReading(null, null, NOW)).toBeNull()
  })
})

describe('fetchAllObservations', () => {
  const station = (id: string, nwsId: string | null): Station => ({ id, nwsId, name: id, lat: 37.63, lon: -119.03, elevationFt: 11000 })
  const SUMMIT = station('MM-SUM', 'MTH03')
  const MCCOY = station('MM-MCY', 'MTH01')

  /** A snapshot as /api/stations answers, with one 5-minute reading per station. */
  const snapshot = (ages: Record<string, number>) => ({
    version: 1,
    fetchedAt: new Date(NOW).toISOString(),
    fields: {},
    stations: Object.fromEntries(
      Object.entries(ages).map(([id, m]) => [
        id,
        { name: id, lat: 37.63, lon: -119.03, elevationFt: 11000, readings: { '5min': { at: minAgo(m), values: { Temp: 20, WindSpeed: 30, WindMax: 45, WindDir: 250 } } } },
      ]),
    ),
  })

  /** One NWS reading, newer than anything Mammoth sent, so it would win if it were asked. */
  const nwsBody = () => ({
    features: [
      {
        properties: {
          timestamp: minAgo(1),
          temperature: { value: -5, unitCode: 'wmoUnit:degC' },
          windSpeed: { value: 16, unitCode: 'wmoUnit:km_h-1' },
        },
      },
    ],
  })

  const stub = (mammoth: unknown) => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('api/stations')
        ? mammoth === null
          ? new Response('', { status: 502 })
          : Response.json(mammoth)
        : Response.json(nwsBody()),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }
  const nwsCalls = (fetchMock: ReturnType<typeof stub>) =>
    fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('api.weather.gov'))

  afterEach(() => vi.unstubAllGlobals())

  it('asks NWS only about stations whose Mammoth reading is stale, and keeps the fresh ones', async () => {
    const fetchMock = stub(snapshot({ 'MM-SUM': 4, 'MM-MCY': 15 }))
    const out = await fetchAllObservations([SUMMIT, MCCOY], undefined, NOW)
    expect(nwsCalls(fetchMock)).toEqual([expect.stringContaining('/stations/MTH01/')])
    expect(out['MM-SUM']!.source).toBe('mammoth')
    expect(out['MM-MCY']!.source).toBe('nws')
  })

  it('reads every station from NWS when /api/stations fails', async () => {
    const fetchMock = stub(null)
    const out = await fetchAllObservations([SUMMIT, MCCOY], undefined, NOW)
    expect(nwsCalls(fetchMock)).toHaveLength(2)
    expect(out['MM-SUM']!.source).toBe('nws')
  })
})
