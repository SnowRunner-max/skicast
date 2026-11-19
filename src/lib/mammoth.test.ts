import { buildSnapshot, fetchSnapshot, parseSnapshot, queryBody, type StationSnapshot } from './mammoth'
import interval5 from './__fixtures__/mammoth/interval-5.json'
import interval15 from './__fixtures__/mammoth/interval-15.json'
import interval60 from './__fixtures__/mammoth/interval-60.json'
import interval1440 from './__fixtures__/mammoth/interval-1440.json'

// The site's answers during the storm of 18 November 2026, about 10:10 PST.
const ALL = { '5min': interval5, '15min': interval15, hourly: interval60, daily: interval1440 }
const FETCHED = new Date('2026-11-18T18:11:00Z')

describe('buildSnapshot', () => {
  const snap = buildSnapshot(ALL, FETCHED)

  it('lists every station in the group, with its place', () => {
    expect(Object.keys(snap.stations)).toHaveLength(26)
    expect(snap.stations['MM-SUM']).toMatchObject({ name: 'Top Stn/Summit - 11,053ft', elevationFt: 11034 })
    expect(snap.stations['MM-SUM']!.lat).toBeCloseTo(37.6306, 4)
    // Listed on the site but sending nothing: kept, with no readings.
    expect(snap.stations['MM-T6']!.readings).toEqual({})
  })

  it('keeps every value of every interval, including the ones the screen does not use yet', () => {
    const ses = snap.stations['MM-SES']!.readings
    expect(Object.keys(ses).sort()).toEqual(['15min', '5min', 'daily', 'hourly'])
    expect(ses['15min']!.values).toMatchObject({ SnowDepth: expect.any(Number), PrecipWESeasonal: expect.any(Number) })
    expect(snap.stations['MM-SUM']!.readings['15min']!.values.WindMaxDayTime).toMatch(/^\d{4}$/)
    expect(snap.fields.WindMax).toEqual({ name: 'Max Wind Gust', units: 'mph' })
    expect(snap.fetchedAt).toBe('2026-11-18T18:11:00.000Z')
  })

  it('refuses to build a snapshot without the 5-minute readings', () => {
    expect(() => buildSnapshot({ '15min': interval15 }, FETCHED)).toThrow(/5-minute/)
    expect(() => buildSnapshot({ '5min': { error: true, message: 'nope' } }, FETCHED)).toThrow(/5-minute/)
  })
})

describe('parseSnapshot', () => {
  const obs = parseSnapshot(JSON.parse(JSON.stringify(buildSnapshot(ALL, FETCHED))) as StationSnapshot)

  it('reads the summit wind NWS was dropping', () => {
    expect(obs['MM-SUM']).toEqual({
      stationId: 'MM-SUM',
      source: 'mammoth',
      observedAt: '2026-11-18T18:10:00.000Z',
      tempF: 12.6,
      speedMph: 49,
      gustMph: 55.2,
      gustAt: '2026-11-18T18:10:00.000Z',
      dirDeg: 213,
    })
  })

  it('takes the 15-minute reading when the 5-minute feed has stalled', () => {
    // Bottom of 9's 5-minute record is from October 2025.
    expect(obs['MM-RMKB9']!.observedAt).toBe('2026-11-18T18:00:00.000Z')
  })

  it('gives null for a station with nothing to show', () => {
    expect(obs['MM-T6']).toBeNull()
    expect(obs['MM-WLY']).toBeNull()
  })

  it('reads 360 degrees as north and drops impossible values', () => {
    const snap: StationSnapshot = {
      version: 1,
      fetchedAt: FETCHED.toISOString(),
      fields: {},
      stations: {
        X: {
          name: 'X',
          lat: 0,
          lon: 0,
          elevationFt: null,
          readings: { '5min': { at: '2026-11-18T18:10:00Z', values: { WindDir: 360, Temp: 412, WindSpeed: 30, WindMax: 22 } } },
        },
      },
    }
    expect(parseSnapshot(snap).X).toMatchObject({ dirDeg: 0, tempF: null, speedMph: 30, gustMph: 30 })
  })

  it('rejects a file that is not a snapshot', () => {
    expect(() => parseSnapshot('<html>Not Found</html>')).toThrow(/not a station snapshot/)
  })
})

describe('fetchSnapshot', () => {
  it('asks for the whole group at every interval, as the site map does', async () => {
    const bodies: string[] = []
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = String(init?.body)
      bodies.push(body)
      const interval = new URLSearchParams(body).get('Interval')
      return new Response(JSON.stringify({ 5: interval5, 15: interval15, 60: interval60, 1440: interval1440 }[interval!]))
    })
    const { snapshot, failed } = await fetchSnapshot(fetchMock as typeof fetch)
    expect(bodies.sort()).toEqual(['5', '15', '60', '1440'].map((i) => queryBody(Number(i)).toString()).sort())
    expect(failed).toEqual([])
    expect(Object.keys(snapshot.stations)).toHaveLength(26)
  })

  it('publishes without a slower interval that fails, but not without the live one', async () => {
    const answer = (fail: string) =>
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const interval = new URLSearchParams(String(init?.body)).get('Interval')
        if (interval === fail) return new Response('down', { status: 503 })
        return new Response(JSON.stringify(interval5))
      })
    await expect(fetchSnapshot(answer('1440') as typeof fetch)).resolves.toMatchObject({ failed: ['daily'] })
    await expect(fetchSnapshot(answer('5') as typeof fetch)).rejects.toThrow(/5-minute readings failed/)
  })
})
