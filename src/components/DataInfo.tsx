import { FORECAST_SOURCE, OBSERVATION_LIVE_MS } from '../config'
import { measuredBy, modeledFields, type Current } from '../lib/current'
import { agoLabel } from '../lib/time'
import { WIND_BANDS } from '../lib/wind'
import type { Beacon } from '../types'

/** "Under 20 mph", "20-39 mph", "40 mph and up", from the band table so the two cannot drift apart. */
function bandRange(i: number): string {
  const band = WIND_BANDS[i]!
  const next = WIND_BANDS[i + 1]
  if (!next) return `${band.minGustMph} mph and up`
  return i === 0 ? `Under ${next.minGustMph} mph` : `${band.minGustMph}-${next.minGustMph - 1} mph`
}

/**
 * What the colours under the gust mean, one band to a row, each led by a
 * piece of the band meter. This is also where "upper lifts may hold" lives,
 * one level below the screen, which shows the band's name alone.
 */
function BandKey() {
  return (
    <>
      <p className="band-key-intro">Gust bands, a rough guide for riders:</p>
      <ul className="band-key">
        {WIND_BANDS.map((band, i) => (
          <li key={band.id} data-band={band.id}>
            <span className="band-key-swatch" aria-hidden="true" />
            <span className="band-key-name">{band.label}</span>{' '}
            <span className="band-key-range">
              {bandRange(i)}
              {band.lifts && `, ${band.lifts}`}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Who the data is from. Shown once, at the foot of the info dialog. */
export function Credits() {
  return (
    <p className="credits">
      Forecast and station readings from the{' '}
      <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">
        National Weather Service
      </a>
      . Lift data ©{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        OpenStreetMap contributors
      </a>
      .
    </p>
  )
}

const MODEL = `the ${FORECAST_SOURCE.name} forecast`

/** The forecast is per 2.5 km grid square, not per point, and riders should know neighbouring beacons can match. */
const GRID = 'It covers the 2.5 km square around this point, so nearby points can show the same forecast.'

/** "sustained wind and wind direction" from ["sustained wind", "wind direction"]. */
function list(items: string[]): string {
  if (items.length < 2) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** The heading line that tops the info modal when the point is not from a station, or null. */
export function infoWarning(current: Current): string | null {
  return current.status === 'model' ? 'Not from weather station.' : null
}

/** What the info modal says about where this point's numbers come from. */
export function DataInfo({ beacon, current, now }: { beacon: Beacon; current: Current; now: number }) {
  const bands = <BandKey />

  if (current.status === 'pending') {
    return (
      <>
        <p>
          Checking the weather station for this location. Until it answers, everything shown is from {MODEL}.
        </p>
        {bands}
      </>
    )
  }

  if (current.status === 'model') {
    return (
      <>
        <p>
          Real time weather not available for this location. Current weather and the next hours are from {MODEL}.{' '}
          {GRID} Ridge-top gusts and gusts on lift can run higher than forecast.
        </p>
        {bands}
      </>
    )
  }

  const observedAt = current.observedAt
  const fresh = observedAt !== null && now - Date.parse(observedAt) <= OBSERVATION_LIVE_MS
  // Sky, cloud cover and precipitation are never measured at these stations.
  const notMeasured = [...modeledFields(current), 'sky', 'cloud cover', 'precipitation']
  const label = (s: { name: string; id: string }) => `${s.name} (${s.id})`
  const several = current.stations.length > 1
  const measuredAt = several
    ? `Measured at ${current.stations.length === 2 ? 'two' : current.stations.length} stations, reported through the National Weather Service: ${measuredBy(
        current,
      )
        .map(([station, fields]) => `${list(fields)} at ${label(station)}`)
        .join(', ')}.`
    : `Measured at ${label(current.stations[0] ?? beacon.weatherStation)}, reported through the National Weather Service.`
  return (
    <>
      <p>
        {fresh
          ? 'Current weather is real time.'
          : `Current weather is the station's latest reading, taken ${observedAt ? agoLabel(observedAt, now) : 'a while ago'}.`}{' '}
        The forecast is from the {FORECAST_SOURCE.name}. {GRID} Ridge-top gusts and gusts on lift can run higher than forecast.
      </p>
      <p>
        {measuredAt}
        {current.sources.gust === 'station' && ' Gusts are the latest the station has sent, which can lag the wind.'}
      </p>
      <p>
        Not measured at {several ? 'these stations' : 'this station'}, so from {MODEL}: {list(notMeasured)}.
      </p>
      {bands}
    </>
  )
}
