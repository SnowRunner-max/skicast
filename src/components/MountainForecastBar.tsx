import { FORECAST_SOURCE } from '../config'
import type { MountainForecast, MountainSlot } from '../lib/mountainForecast'
import { mph } from '../lib/wind'
import { SkyIcon } from './SkyIcon'

/**
 * Height of the Mountain Forecast's own row under the toolbar on an upright
 * phone, where there is no room for it beside the brand. Set inline from here
 * so BottomSheet can leave room for it without a second copy in CSS.
 */
export const FORECAST_ROW_PX = 46

function spoken(slot: MountainSlot, now: boolean): string {
  const when = now ? 'Now' : slot.label
  const wind = `wind ${mph(slot.windMph)} mph${now && slot.windSource === 'model' ? ', forecast' : ''}`
  return `${when}: ${slot.sky}, ${wind}.`
}

function Slot({ slot, now }: { slot: MountainSlot; now: boolean }) {
  return (
    <li className="mf-slot" data-now={now || undefined} title={`${slot.label}: ${slot.sky}`}>
      <span className="sr-only">{spoken(slot, now)}</span>
      <span className="mf-time" aria-hidden="true">
        {slot.label}
      </span>
      <span className="mf-main" aria-hidden="true">
        <SkyIcon icon={slot.icon} size={now ? 22 : 20} />
        <span className="mf-wind">
          {mph(slot.windMph)}
          {now && <span className="mf-unit"> mph</span>}
        </span>
      </span>
    </li>
  )
}

interface Props {
  forecast: MountainForecast | null
  loading: boolean
  error: string | null
}

/**
 * The whole mountain at a glance, in the toolbar: the weather now as an icon
 * with the summit's sustained wind, then the next four hours to its right.
 * Mountain weather is broader than one station, so this does not change with
 * the beacon selected.
 */
export function MountainForecastBar({ forecast, loading, error }: Props) {
  const heading = (
    <h2 id="mountain-forecast-heading" className="mf-heading">
      <span className="mf-title">Mountain forecast</span>
      <span className="mf-source">{FORECAST_SOURCE.short}, summit wind</span>
    </h2>
  )
  if (!forecast) {
    return (
      <section className="mountain-forecast" aria-label="Mountain forecast">
        {/* Names itself even where the heading is hidden, so an empty bar never reads as a missing one. */}
        <p className="mf-empty">
          Mountain forecast {loading || !error ? 'loading…' : 'not available right now'}
        </p>
      </section>
    )
  }
  const stationNote = forecast.windStation ? `, measured at ${forecast.windStation.name}` : ''
  return (
    <section
      className="mountain-forecast"
      aria-labelledby="mountain-forecast-heading"
      aria-describedby="mountain-forecast-note"
    >
      {heading}
      <p id="mountain-forecast-note" className="sr-only">
        Weather for the whole mountain from the {FORECAST_SOURCE.name}. Wind is sustained wind at the summit, not
        gusts{stationNote}.
      </p>
      <ol className="mf-slots">
        <Slot slot={forecast.now} now />
        {forecast.next.map((slot) => (
          <Slot key={slot.time} slot={slot} now={false} />
        ))}
      </ol>
    </section>
  )
}
