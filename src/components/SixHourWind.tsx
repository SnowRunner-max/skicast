import { FORECAST_MODEL } from '../config'
import { hourLabel } from '../lib/time'
import { bandForGust, compassWord, mph, peakGust } from '../lib/wind'
import type { BeaconForecast } from '../types'
import { WindArrow } from './WindArrow'

/** Wind for the next six hours, one column per hour, shaded by band. */
export function SixHourWind({ forecast }: { forecast: BeaconForecast }) {
  const hours = forecast.next6
  const peak = peakGust(hours)
  if (hours.length === 0 || !peak) {
    return (
      <section className="widget-section" aria-labelledby="hours-heading">
        <h3 id="hours-heading" className="section-label">
          Next 6 hours
        </h3>
        <p className="weather-detail">Hourly wind is not available right now.</p>
      </section>
    )
  }
  return (
    <section className="widget-section" aria-labelledby="hours-heading">
      <div className="hours-heading">
        <h3 id="hours-heading" className="section-label">
          Next {hours.length} hours
        </h3>
        <p className="hours-key">{FORECAST_MODEL.label} forecast</p>
      </div>
      <p className="hours-key hours-legend">Large number is the gust, small number is sustained wind, in mph.</p>
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
