import type { Beacon as BeaconDef, BeaconForecast } from '../types'
import { bandForGust, compassWord, mph } from '../lib/wind'
import { windArrowAngle } from './WindArrow'

interface Props {
  beacon: BeaconDef
  forecast: BeaconForecast | null
  selected: boolean
  /** Screen position of the station, in pixels. */
  x: number
  y: number
  onSelect: (id: string) => void
}

/** A forecast point on the map: a band-colored dot holding the wind arrow, with the gust in mph beside it. */
export function Beacon({ beacon, forecast, selected, x, y, onSelect }: Props) {
  const now = forecast?.now
  const band = now ? bandForGust(now.gustMph) : null
  const label = now
    ? `${beacon.name}, gusts ${mph(now.gustMph)} mph from the ${compassWord(now.dirDeg)}`
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
        <span className="beacon-name">{beacon.shortName}</span>
      </span>
    </button>
  )
}
