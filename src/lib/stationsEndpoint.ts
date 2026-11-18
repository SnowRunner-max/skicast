import { fetchSnapshot } from './mammoth'

/**
 * The answer to GET /api/stations: every reading from Mammoth's stations, as
 * one snapshot (see `StationSnapshot` in mammoth.ts). Mammoth's station site
 * sends no cross-origin headers, so the browser can't ask it directly; this
 * asks it from the server instead, at the same origin as the app.
 *
 * Runs as a Netlify Function in production (netlify/functions/stations.ts) and
 * as Vite middleware under `npm run dev` and `npm run preview`.
 *
 * Netlify's CDN keeps each answer for a minute, so however many people have
 * the app open, Mammoth's site is asked about once a minute. The stations
 * report every 5 minutes, so a reading is never more than about 6 minutes old.
 */
export const STATIONS_ENDPOINT_PATH = '/api/stations'

/** Under Netlify's 10-second limit for a function, with room to answer. */
const UPSTREAM_TIMEOUT_MS = 8000

const OK_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  // The browser asks again each time the app refreshes; the CDN answers.
  'Cache-Control': 'public, max-age=0, must-revalidate',
  // One copy for every CDN node, kept 60 s, then served while a new one is fetched.
  'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=60, stale-while-revalidate=120',
}

const ERROR_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  // A failure is kept briefly too, so an outage at Mammoth's end isn't asked about on every page load.
  'Netlify-CDN-Cache-Control': 'public, s-maxage=15',
}

export async function stationsResponse(fetchImpl: typeof fetch = fetch): Promise<Response> {
  try {
    const { snapshot, failed } = await fetchSnapshot(fetchImpl, { timeoutMs: UPSTREAM_TIMEOUT_MS })
    const headers: Record<string, string> = { ...OK_HEADERS }
    if (failed.length > 0) headers['X-Skicast-Missing-Intervals'] = failed.join(',')
    return new Response(JSON.stringify(snapshot), { status: 200, headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 502, headers: ERROR_HEADERS })
  }
}
