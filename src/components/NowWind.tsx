import { MAP } from '../data/mapPaths'
import { bandForGust, compassPoint, compassWord, mph } from '../lib/wind'
import type { BeaconForecast } from '../types'
import { windArrowAngle } from './WindArrow'

/** Current wind: the gust is the one hero number on screen. */
export function NowWind({ forecast }: { forecast: BeaconForecast }) {
  const { gustMph, speedMph, dirDeg } = forecast.now
  const band = bandForGust(gustMph)
  return (
    <section className="widget-section wind" aria-labelledby="wind-heading">
      <h3 id="wind-heading" className="section-label">
        Gusts now
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
          <p className="wind-from wind-from-value" aria-label={`From the ${compassWord(dirDeg)}`}>
            From {compassPoint(dirDeg)}
          </p>
        </div>
      </div>
      <p className="band-line" data-band={band.id}>
        <span className="band-dot" aria-hidden="true" />
        {band.label}
      </p>
      <p className="wind-sustained">Sustained {mph(speedMph)} mph</p>
    </section>
  )
}
