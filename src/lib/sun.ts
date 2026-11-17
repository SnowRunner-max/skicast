const RAD = Math.PI / 180

/** Days from the J2000 epoch (noon UTC, 1 January 2000). */
const daysSinceJ2000 = (ms: number) => ms / 86_400_000 - 10_957.5

/**
 * The sun's height above the horizon, in degrees, at a time and place. The
 * low-precision formula from the US Naval Observatory's Astronomical Almanac,
 * good to about a hundredth of a degree this century: far finer than deciding
 * whether to draw a sun or a moon needs.
 */
export function sunElevationDeg(ms: number, lat: number, lon: number): number {
  const d = daysSinceJ2000(ms)
  const meanAnomaly = (357.529 + 0.98560028 * d) * RAD
  const meanLongitude = 280.459 + 0.98564736 * d
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD
  const obliquity = (23.439 - 0.00000036 * d) * RAD

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude))
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude))
  const siderealDeg = (280.46061837 + 360.98564736629 * d + lon) % 360
  const hourAngle = siderealDeg * RAD - rightAscension

  const phi = lat * RAD
  return (
    Math.asin(
      Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle),
    ) / RAD
  )
}

/**
 * Whether the sun is up: its upper edge above a flat horizon, the way sunrise
 * and sunset are defined (the centre 0.833° below, for refraction and the
 * sun's radius). Mountains on the horizon are ignored.
 */
export function isDaylight(ms: number, lat: number, lon: number): boolean {
  return sunElevationDeg(ms, lat, lon) > -0.833
}
