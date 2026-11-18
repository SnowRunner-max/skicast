import type { Beacon as BeaconDef } from '../types'
import type { Current } from '../lib/current'
import type { Measure } from '../hooks/useMeasure'
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
  measure: Measure
}

/**
 * A forecast point on the map. Showing wind: a band-coloured dot holding the
 * wind arrow, with the gust in mph beside it. Showing temperature: a plain dot,
 * since green, amber and red mean wind and nothing else, with the temperature
 * in its place. The number sits in the same spot either way, so switching
 * reads as the number changing, not the map.
 */
export function Beacon({ beacon, current, selected, x, y, onSelect, measure }: Props) {
  const temp = measure === 'temp'
  const band = current && !temp ? bandForGust(current.gustMph) : null
  // The warning follows the source of the number on the map, not the point's.
  const modelOnly =
    current !== null && current.status !== 'pending' && current.sources[temp ? 'temp' : 'gust'] === 'model'
  const not = modelOnly ? ', not from a weather station' : ''
  const label = !current
    ? `${beacon.name}, forecast not loaded`
    : temp
      ? `${beacon.name}, ${Math.round(current.tempF)} degrees Fahrenheit${not}`
      : `${beacon.name}, gusts ${mph(current.gustMph)} mph from the ${compassWord(current.dirDeg)}${not}`

  return (
    // The button is a 44px tap target centred on the station (see .beacon in
    // index.css, which offsets it by half its size); the visible dot is smaller.
    <button
      type="button"
      className="beacon"
      data-side={beacon.labelSide}
      data-measure={measure}
      data-band={temp && current ? undefined : (band?.id ?? 'none')}
      aria-label={label}
      aria-pressed={selected}
      style={{ transform: `translate(${x}px, ${y}px)` }}
      onClick={() => onSelect(beacon.id)}
    >
      <svg className="beacon-mark" width="44" height="44" viewBox="-22 -22 44 44" aria-hidden="true">
        {selected && <circle className="beacon-ring" r="16" />}
        <circle className="beacon-dot" r="11" />
        {/* No arrow in a dead calm: a direction with no wind behind it means nothing. */}
        {!temp && current && mph(current.speedMph) > 0 && (
          <path
            className="beacon-arrow"
            transform={`rotate(${windArrowAngle(current.dirDeg)})`}
            d="M0 6.5V-6M-4 -2 0 -6.5 4 -2"
          />
        )}
      </svg>
      <span className="beacon-label" aria-hidden="true">
        {temp ? (
          <span className="beacon-value">
            {current ? `${Math.round(current.tempF)}°` : '–'}
            <span className="beacon-unit">F</span>
          </span>
        ) : (
          <span className="beacon-value">
            {current ? mph(current.gustMph) : '–'}
            <span className="beacon-unit"> mph</span>
          </span>
        )}
        <span className="beacon-name">
          {modelOnly && <WarningGlyph className="beacon-warning" />}
          {beacon.shortName}
        </span>
      </span>
    </button>
  )
}
