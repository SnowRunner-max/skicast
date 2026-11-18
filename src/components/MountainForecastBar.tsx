import { FORECAST_SOURCE } from '../config'
import type { Measure } from '../hooks/useMeasure'
import type { MountainForecast, MountainSlot } from '../lib/mountainForecast'
import { mph } from '../lib/wind'
import { SkyIcon } from './SkyIcon'

/**
 * Height of the Mountain Forecast's own row under the toolbar on an upright
 * phone, where there is no room for it beside the brand. Set inline from here
 * so BottomSheet can leave room for it without a second copy in CSS.
 */
export const FORECAST_ROW_PX = 46

/** Whole degrees, the way every temperature is shown. */
const degrees = (tempF: number) => Math.round(tempF)

function spoken(slot: MountainSlot, now: boolean, measure: Measure): string {
  const when = now ? 'Now' : slot.label
  const forecastNote = (source: MountainSlot['windSource']) => (now && source === 'model' ? ', forecast' : '')
  const value =
    measure === 'temp'
      ? slot.tempF === null
        ? 'temperature not forecast'
        : `${degrees(slot.tempF)} degrees${forecastNote(slot.tempSource)}`
      : `wind ${mph(slot.windMph)} mph${forecastNote(slot.windSource)}`
  return `${when}: ${slot.sky}, ${value}.`
}

/**
 * The number beside the sky. Only Now carries its unit; the hours after it
 * read as the same thing. A temperature keeps its degree sign everywhere, so a
 * bare hour can never be mistaken for a wind speed.
 */
function Value({ slot, now, measure }: { slot: MountainSlot; now: boolean; measure: Measure }) {
  if (measure === 'temp') {
    return (
      <span className="mf-value">
        {slot.tempF === null ? '–' : `${degrees(slot.tempF)}°`}
        {now && slot.tempF !== null && <span className="mf-unit">F</span>}
      </span>
    )
  }
  return (
    <span className="mf-value">
      {mph(slot.windMph)}
      {now && <span className="mf-unit"> mph</span>}
    </span>
  )
}

function Slot({ slot, now, measure }: { slot: MountainSlot; now: boolean; measure: Measure }) {
  return (
    <li className="mf-slot" data-now={now || undefined} title={`${slot.label}: ${slot.sky}`}>
      <span className="sr-only">{spoken(slot, now, measure)}</span>
      <span className="mf-time" aria-hidden="true">
        {slot.label}
      </span>
      <span className="mf-main" aria-hidden="true">
        <SkyIcon icon={slot.icon} size={now ? 22 : 20} />
        <Value slot={slot} now={now} measure={measure} />
      </span>
    </li>
  )
}

interface Props {
  forecast: MountainForecast | null
  loading: boolean
  error: string | null
  /** Whether each hour shows the summit's sustained wind or its temperature, as the toolbar's switch says. */
  measure: Measure
}

/**
 * The whole mountain at a glance, in the toolbar: the weather now as an icon
 * with the summit's sustained wind or temperature, then the next four hours to
 * its right. Mountain weather is broader than one station, so this does not
 * change with the beacon selected.
 */
export function MountainForecastBar({ forecast, loading, error, measure }: Props) {
  const heading = (
    <h2 id="mountain-forecast-heading" className="mf-heading">
      {/* The space keeps the two apart for screen readers; the flex layout drops it on screen. */}
      <span className="mf-title">Mountain forecast</span>{' '}
      <span className="mf-source">Summit</span>
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
  const station = measure === 'temp' ? forecast.tempStation : forecast.windStation
  const stationNote = station ? `, measured at ${station.name}` : ''
  const what =
    measure === 'temp'
      ? `Temperature is the air at the summit, in degrees Fahrenheit${stationNote}.`
      : `Wind is sustained wind at the summit, not gusts${stationNote}.`
  return (
    <section
      className="mountain-forecast"
      aria-labelledby="mountain-forecast-heading"
      aria-describedby="mountain-forecast-note"
    >
      {heading}
      <p id="mountain-forecast-note" className="sr-only">
        Weather for the whole mountain from the {FORECAST_SOURCE.name}. {what}
      </p>
      <ol className="mf-slots">
        <Slot slot={forecast.now} now measure={measure} />
        {forecast.next.map((slot) => (
          <Slot key={slot.time} slot={slot} now={false} measure={measure} />
        ))}
      </ol>
    </section>
  )
}
