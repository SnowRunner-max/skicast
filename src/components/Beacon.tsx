import type { Beacon as BeaconDef } from '../types'
import type { Current } from '../lib/current'
import { bandForGust, compassWord, mph } from '../lib/wind'
import { windArrowAngle } from './WindArrow'
import { WarningGlyph } from './WarningGlyph'

interface Props {
  beacon: BeaconDef
  current: Current | null
  selected: boolean
  /** Screen position of the station, in pixels. */
  x: number
  y: number
  onSelect: (id: string) => void
}

/** A forecast point on the map: a band-colored dot holding the wind arrow, with the gust in mph beside it. */
export function Beacon({ beacon, current, selected, x, y, onSelect }: Props) {
  const now = current
  const band = now ? bandForGust(now.gustMph) : null
  // The number on the map is the gust, so the warning follows the gust's source, not the point's.
  const modelOnly = now !== null && now.status !== 'pending' && now.sources.gust === 'model'
  const label = now
    ? `${beacon.name}, gusts ${mph(now.gustMph)} mph from the ${compassWord(now.dirDeg)}${modelOnly ? ', not from a weather station' : ''}`
    : `${beacon.name}, forecast not loaded`

  return (
    <button
      type="button"
      className="beacon"
      data-side={beacon.labelSide}
      data-band={band?.id ?? 'none'}
      aria-label={label}
      aria-pressed={selected}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onClick={() => onSelect(beacon.id)}
    >
      <svg className="beacon-mark" width="44" height="44" viewBox="-22 -22 44 44" aria-hidden="true">
        {selected && <circle className="beacon-ring" r="16" />}
        <circle className="beacon-dot" r="11" />
        {now && mph(now.speedMph) > 0 && (
          <path
            className="beacon-arrow"
            transform={`rotate(${windArrowAngle(now.dirDeg)})`}
            d="M0 6.5V-6M-4 -2 0 -6.5 4 -2"
          />
        )}
      </svg>
      <span className="beacon-label" aria-hidden="true">
        <span className="beacon-gust">
          {now ? mph(now.gustMph) : '–'}
          <span className="beacon-unit"> mph</span>
        </span>
        <span className="beacon-name">
          {modelOnly && <WarningGlyph className="beacon-warning" />}
          {beacon.shortName}
        </span>
      </span>
    </button>
  )
}
