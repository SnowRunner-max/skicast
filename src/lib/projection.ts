/**
 * Lat/lon -> SVG x/y, shared by scripts/build-map.ts and the app so a beacon
 * always lands on its station.
 *
 * The map is a flat local projection (fine over a few miles) rotated so that
 * `bearingDeg` points up the screen. For Mammoth that is roughly south-west:
 * the view from town, base lodges along the bottom, summit at the top.
 */
export interface Projection {
  /** Projection origin. */
  lat0: number
  lon0: number
  /** Compass bearing (degrees clockwise from north) that points up the screen. */
  bearingDeg: number
  /** SVG units per metre. */
  scale: number
  /** SVG coordinates of the origin. */
  tx: number
  ty: number
}

export interface Point {
  x: number
  y: number
}

const EARTH_RADIUS_M = 6_371_008.8
const RAD = Math.PI / 180

/** Metres right / up on screen from the origin, before scaling. */
export function toViewMetres(p: Pick<Projection, 'lat0' | 'lon0' | 'bearingDeg'>, lat: number, lon: number): Point {
  const east = (lon - p.lon0) * RAD * EARTH_RADIUS_M * Math.cos(p.lat0 * RAD)
  const north = (lat - p.lat0) * RAD * EARTH_RADIUS_M
  const b = p.bearingDeg * RAD
  return {
    x: east * Math.cos(b) - north * Math.sin(b),
    y: east * Math.sin(b) + north * Math.cos(b),
  }
}

/** Inverse of toViewMetres. */
export function fromViewMetres(
  p: Pick<Projection, 'lat0' | 'lon0' | 'bearingDeg'>,
  x: number,
  y: number,
): { lat: number; lon: number } {
  const b = p.bearingDeg * RAD
  const east = x * Math.cos(b) + y * Math.sin(b)
  const north = -x * Math.sin(b) + y * Math.cos(b)
  return {
    lat: p.lat0 + north / (RAD * EARTH_RADIUS_M),
    lon: p.lon0 + east / (RAD * EARTH_RADIUS_M * Math.cos(p.lat0 * RAD)),
  }
}

export function project(p: Projection, lat: number, lon: number): Point {
  const m = toViewMetres(p, lat, lon)
  return { x: p.tx + m.x * p.scale, y: p.ty - m.y * p.scale }
}

/**
 * Screen rotation (degrees clockwise, 0 = pointing up) for a compass bearing
 * drawn on the rotated map. North itself sits at screenAngle(p, 0).
 */
export function screenAngle(p: Pick<Projection, 'bearingDeg'>, compassDeg: number): number {
  return (((compassDeg - p.bearingDeg) % 360) + 360) % 360
}
