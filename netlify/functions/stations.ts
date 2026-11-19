/**
 * GET /api/stations on Netlify: Mammoth's station readings, fetched from the
 * server because Mammoth's site doesn't allow cross-origin reads. The work and
 * the caching are in src/lib/stationsEndpoint.ts.
 */
import { STATIONS_ENDPOINT_PATH, stationsResponse } from '../../src/lib/stationsEndpoint'

export const config = { path: STATIONS_ENDPOINT_PATH, method: 'GET' }

export default async function stations(): Promise<Response> {
  return stationsResponse()
}
