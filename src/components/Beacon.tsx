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
  const band = current ? bandForGust(current.gustMph) : null
  // The number on the map is the gust, so the warning follows the gust's source, not the point's.
  const modelOnly = current !== null && current.status !== 'pending' && current.sources.gust === 'model'
  const label = current
    ? `${beacon.name}, gusts ${mph(current.gustMph)} mph from the ${compassWord(current.dirDeg)}${modelOnly ? ', not from a weather station' : ''}`
    : `${beacon.name}, forecast not loaded`

  return (
    // The button is a 44px tap target centred on the station (see .beacon in
    // index.css, which offsets it by half its size); the visible dot is smaller.
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
        {/* No arrow in a dead calm: a direction with no wind behind it means nothing. */}
        {current && mph(current.speedMph) > 0 && (
          <path
            className="beacon-arrow"
            transform={`rotate(${windArrowAngle(current.dirDeg)})`}
            d="M0 6.5V-6M-4 -2 0 -6.5 4 -2"
          />
        )}
      </svg>
      <span className="beacon-label" aria-hidden="true">
        <span className="beacon-gust">
          {current ? mph(current.gustMph) : '–'}
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
