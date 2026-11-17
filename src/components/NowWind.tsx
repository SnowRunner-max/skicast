import { MAP } from '../data/mapPaths'
import { bandForGust, compassPoint, compassWord, mph } from '../lib/wind'
import type { Current } from '../lib/current'
import { agoLabel } from '../lib/time'
import { OBSERVATION_LIVE_MS } from '../config'
import { windArrowAngle } from './WindArrow'

/** Current wind: the gust is the one hero number on screen. */
export function NowWind({ current, now }: { current: Current; now: number }) {
  const { gustMph, speedMph, dirDeg, sources, status } = current
  // When some values are measured, say which ones are not. A point with no station is labelled once, at the top.
  const note = (source: 'station' | 'model') => status === 'station' && source === 'model'
  const band = bandForGust(gustMph)
  // Stations send gusts late. Say so when the gust on screen is not recent.
  const gustIsOld = current.gustAt !== null && now - Date.parse(current.gustAt) > OBSERVATION_LIVE_MS
  return (
    <section className="widget-section wind" aria-labelledby="wind-heading">
      <h3 id="wind-heading" className="section-label">
        Gusts now{note(sources.gust) ? ', forecast' : ''}
      </h3>
      <div className="wind-main">
        <p className="hero" aria-label={`Gusts ${mph(gustMph)} miles per hour`}>
          {mph(gustMph)}
          <span className="hero-unit">mph</span>
        </p>
        <div className="wind-direction">
          {/* The dial is drawn in the map's frame, so its arrow matches the beacon's. */}
          <svg className="dial" width="72" height="72" viewBox="-36 -36 72 72" aria-hidden="true">
            <circle className="dial-rim" r="21" />
            <g transform={`rotate(${MAP.northAngle})`}>
              <path className="dial-tick" d="M0 -21V-16" />
              <text className="dial-north" y="-29" transform={`rotate(${-MAP.northAngle} 0 -29)`}>
                N
              </text>
            </g>
            <g transform={`rotate(${windArrowAngle(dirDeg)})`}>
              <path className="dial-arrow" d="M0 12V-11M-5.5 -5 0 -12 5.5 -5" />
            </g>
          </svg>
          <div>
            <p className="wind-from wind-from-value" aria-label={`From the ${compassWord(dirDeg)}`}>
              From {compassPoint(dirDeg)}
            </p>
            {note(sources.dir) && <p className="wind-note">Forecast</p>}
          </div>
        </div>
      </div>
      <p className="band-line" data-band={band.id}>
        <span className="band-dot" aria-hidden="true" />
        {band.label}
      </p>
      {gustIsOld && <p className="wind-note">Gust measured {agoLabel(current.gustAt!, now)}</p>}
      <p className="wind-sustained">
        Sustained {mph(speedMph)} mph{note(sources.speed) ? ', forecast' : ''}
      </p>
    </section>
  )
}
