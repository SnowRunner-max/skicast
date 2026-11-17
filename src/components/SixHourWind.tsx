import { FORECAST_SOURCE } from '../config'
import { hourLabel } from '../lib/time'
import { bandForGust, compassWord, mph, peakGust } from '../lib/wind'
import type { BeaconForecast } from '../types'
import { WindArrow } from './WindArrow'

/** Wind for the next six hours, one column per hour, shaded by band. */
export function SixHourWind({ forecast }: { forecast: BeaconForecast }) {
  const hours = forecast.next6
  // The grid can run out before six hours are up (parseGrid drops hours with no wind), so count what is there.
  const peak = peakGust(hours)
  const heading = (
    <div className="hours-heading">
      <h3 id="hours-heading" className="section-label">
        Next {peak ? hours.length : 6} hours
      </h3>
      {peak && <p className="hours-key">{FORECAST_SOURCE.short} forecast</p>}
    </div>
  )
  if (!peak) {
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
      <p className="hours-key hours-legend">Large number is the gust, small number is sustained wind, in mph.</p>
      {/* Columns are set here, not in CSS, because the strip can hold fewer than six hours. */}
      <ol className="hours" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
        {hours.map((h) => {
          const band = bandForGust(h.gustMph)
          return (
            <li key={h.time} className="hour" data-band={band.id}>
              <span className="sr-only">
                {hourLabel(h.time)}: gusts {mph(h.gustMph)} mph, sustained {mph(h.speedMph)} mph, from the{' '}
                {compassWord(h.dirDeg)}. {band.short}.
              </span>
              <span className="hour-time" aria-hidden="true">
                {hourLabel(h.time)}
              </span>
              <WindArrow dirDeg={h.dirDeg} size={18} />
              <span className="hour-gust" aria-hidden="true">
                {mph(h.gustMph)}
              </span>
              <span className="hour-speed" aria-hidden="true">
                {mph(h.speedMph)}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="peak-line">
        Peak gust {mph(peak.gustMph)} mph at {hourLabel(peak.time)}
      </p>
    </section>
  )
}
