import { parseSnapshot } from './mammoth'
import { stationsResponse } from './stationsEndpoint'
import interval5 from './__fixtures__/mammoth/interval-5.json'
import interval15 from './__fixtures__/mammoth/interval-15.json'

/** Mammoth's site, answering the given intervals with the storm fixtures and failing the rest. */
const site = (up: Record<string, unknown>) =>
  vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const answer = up[new URLSearchParams(String(init?.body)).get('Interval')!]
    return answer ? new Response(JSON.stringify(answer)) : new Response('down', { status: 503 })
  }) as unknown as typeof fetch

describe('stationsResponse', () => {
  it('answers with a snapshot the app can read, cached a minute at the CDN and not in the browser', async () => {
    const res = await stationsResponse(site({ 5: interval5, 15: interval15 }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Netlify-CDN-Cache-Control')).toMatch(/s-maxage=60/)
    expect(res.headers.get('Cache-Control')).toMatch(/max-age=0/)
    expect(res.headers.get('X-Skicast-Missing-Intervals')).toBe('hourly,daily')
    const observations = parseSnapshot(await res.json())
    expect(observations['MM-SUM']).toMatchObject({ source: 'mammoth', speedMph: expect.any(Number) })
  })

  it('answers 502, briefly cached, when the live readings fail', async () => {
    const res = await stationsResponse(site({}))
    expect(res.status).toBe(502)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Netlify-CDN-Cache-Control')).toMatch(/s-maxage=15/)
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/5-minute readings failed/) })
  })
})
