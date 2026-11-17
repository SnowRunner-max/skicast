import type { ReactNode } from 'react'
import type { SkyIconId } from '../lib/mountainForecast'

// Drawn on a 24-unit grid in the same line style as the other icons. Clouds are
// filled with the toolbar's background so a sun or moon behind one is hidden.
const SUN_RAYS = 'M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5'
const MOON = 'M20 14.2A8 8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2Z'
/** A cloud about 13 wide and 10 tall, sitting on y = 14. */
const CLOUD = 'M7 14h10a3.5 3.5 0 0 0 .35-6.98A5 5 0 0 0 7.6 8.1 3 3 0 0 0 7 14Z'

const cloud = (transform?: string) => <path className="sky-cloud" d={CLOUD} transform={transform} />

/** A six-armed flake centred on (x, y). */
const flake = (x: number, y: number) => (
  <path key={`${x},${y}`} d={`M${x} ${y - 1.7}v3.4M${x - 1.5} ${y - 0.85}l3 1.7M${x - 1.5} ${y + 0.85}l3-1.7`} />
)

const SHAPES: Record<SkyIconId, ReactNode> = {
  'clear-day': (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d={SUN_RAYS} />
    </>
  ),
  'clear-night': <path d={MOON} />,
  'partly-day': (
    <>
      <g transform="translate(-3.2 -3.2) scale(.78)">
        <circle cx="12" cy="12" r="4" />
        <path d={SUN_RAYS} />
      </g>
      {cloud('translate(2.5 6)')}
    </>
  ),
  'partly-night': (
    <>
      <path d={MOON} transform="translate(-2.6 -2.6) scale(.72)" />
      {cloud('translate(2.5 6)')}
    </>
  ),
  cloudy: cloud('translate(0 3.5)'),
  'light-snow': (
    <>
      {cloud()}
      {flake(9, 18.5)}
      {flake(15, 18.5)}
    </>
  ),
  'heavy-snow': (
    <>
      {cloud()}
      {flake(7, 17.8)}
      {flake(12, 20.5)}
      {flake(17, 17.8)}
    </>
  ),
  rain: (
    <>
      {cloud()}
      <path d="M8.5 16.5l-1 3M12.5 16.5l-1.4 4.2M16.5 16.5l-1 3" />
    </>
  ),
  thunder: (
    <>
      {cloud()}
      <path d="M12.6 15.2l-2.3 3.6h3.4l-2.3 3.7" />
    </>
  ),
  fog: <path d="M4 8.5h16M3 12.5h18M5 16.5h14M8 20.5h8" />,
  windy: <path d="M3 9h11.5a2.6 2.6 0 1 0-2.6-2.6M3 13h15.4a2.6 2.6 0 1 1-2.6 2.6M3 17h7" />,
}

/** The weather as a small line drawing. Decorative: pair it with the words. */
export function SkyIcon({ icon, size = 22 }: { icon: SkyIconId; size?: number }) {
  return (
    <svg className="sky-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" data-icon={icon}>
      {SHAPES[icon]}
    </svg>
  )
}
