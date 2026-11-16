import { MAP } from '../data/mapPaths'
import { screenAngle } from '../lib/projection'
import { blowingToward } from '../lib/wind'

/**
 * Rotation for a wind arrow drawn in the map's frame: it points the way the
 * wind is blowing across the mountain as the map shows it, not north-up.
 */
export function windArrowAngle(dirFromDeg: number): number {
  return screenAngle(MAP.projection, blowingToward(dirFromDeg))
}

/** A small arrow pointing the way the wind blows. Decorative; pair it with text. */
export function WindArrow({ dirDeg, size = 18 }: { dirDeg: number; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-12 -12 24 24"
      aria-hidden="true"
      className="wind-arrow"
      style={{ transform: `rotate(${windArrowAngle(dirDeg)}deg)` }}
    >
      <path d="M0 9V-8M-5.5 -2.5 0 -8.5 5.5 -2.5" />
    </svg>
  )
}
