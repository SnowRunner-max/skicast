import { FORECAST_SOURCE } from '../config'
import { hourLabel } from '../lib/time'
import { bandForGust, compassWord, mph } from '../lib/wind'
import type { BeaconForecast } from '../types'
import { WindArrow } from './WindArrow'

/**
 * Wind for the next six hours, one column per hour. It repeats the shapes of
 * the wind now above it, so it needs no key: the bold number is the gust, in
 * its band colour, and the arrow carries the sustained wind beside it, the way
 * the dial does.
 */
export function SixHourWind({ forecast }: { forecast: BeaconForecast }) {
  // The grid can run out before six hours are up (parseGrid drops hours with no wind), so count what is there.
  const hours = forecast.next6
  const heading = (
    <div className="hours-heading">
      <h3 id="hours-heading" className="section-label">
        Next {hours.length > 0 ? hours.length : 6} hours
      </h3>
      {hours.length > 0 && <p className="hours-source">{FORECAST_SOURCE.short} forecast</p>}
    </div>
  )
  if (hours.length === 0) {
    return (
      <section className="widget-section" aria-labelledby="hours-heading">
        {heading}
        <p className="weather-detail">Hourly wind is not available right now.</p>
      </section>
    )
  }
  return (
    <section className="widget-section" aria-labelledby="hours-heading">
      {heading}
      {/* Columns are set here, not in CSS, because the strip can hold fewer than six hours. */}
      <ol
        className="hours"
        aria-labelledby="hours-heading"
        style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
      >
        {hours.map((h) => {
          const band = bandForGust(h.gustMph)
          return (
            <li key={h.time} className="hour" data-band={band.id}>
              <span className="sr-only">
                {hourLabel(h.time)}: gusts {mph(h.gustMph)} mph, sustained {mph(h.speedMph)} mph, from the{' '}
                {compassWord(h.dirDeg)}. {band.label}.
              </span>
              <span className="hour-time" aria-hidden="true">
                {hourLabel(h.time)}
              </span>
              <span className="hour-gust" aria-hidden="true">
                {mph(h.gustMph)}
              </span>
              <span className="hour-wind" aria-hidden="true">
                <WindArrow dirDeg={h.dirDeg} size={14} />
                {mph(h.speedMph)}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
