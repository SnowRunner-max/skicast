import { FORECAST_SOURCE, OBSERVATION_LIVE_MS } from '../config'
import { measuredBy, modeledFields, type Current } from '../lib/current'
import { agoLabel } from '../lib/time'
import { WIND_BANDS } from '../lib/wind'
import type { Beacon } from '../types'

/** "calm under 20, windy 20-39, strong 40 and up", built from the band table so the two cannot drift apart. */
const BAND_KEY = WIND_BANDS.map((band, i) => {
  const next = WIND_BANDS[i + 1]
  const range = next ? (i === 0 ? `under ${next.minGustMph}` : `${band.minGustMph}-${next.minGustMph - 1}`) : `${band.minGustMph} and up`
  return `${band.short.toLowerCase()} ${range}`
}).join(', ')

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
  const bands = <p>Gust bands in mph: {BAND_KEY}. This is only a rough guide for riders.</p>

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
