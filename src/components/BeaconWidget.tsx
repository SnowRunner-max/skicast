import { useCallback, useState, type ReactNode } from 'react'
import { agoLabel } from '../lib/time'
import type { Current } from '../lib/current'
import { bandForGust, mph } from '../lib/wind'
import type { Beacon, BeaconForecast } from '../types'
import { BottomSheet, type Snap } from './BottomSheet'
import { Credits, DataInfo, infoWarning } from './DataInfo'
import { ElevationGlyph, InfoGlyph, StationGlyph } from './Glyphs'
import { InfoDialog } from './InfoDialog'
import { NowWeather } from './NowWeather'
import { NowWind } from './NowWind'
import { SixHourWind } from './SixHourWind'
import { WarningGlyph } from './WarningGlyph'

interface Props {
  beacon: Beacon
  forecast: BeaconForecast | null
  /** The forecast with any fresh station readings laid over it. */
  current: Current | null
  loading: boolean
  error: string | null
  /** Current time in ms, for "Updated 4 min ago". */
  now: number
  onRefresh: () => void
  /** Bottom sheet over the map on an upright phone; a card beside the map otherwise (see useLayout). */
  variant: 'card' | 'sheet'
  onSheetSettle?: (visiblePx: number) => void
}

/** Past this age a forecast that failed to refresh is called out as old. */
const STALE_MS = 20 * 60 * 1000

/**
 * The beacon's name, then two facts about the spot, each led by a glyph: how
 * high it is, and where its weather station stands. Every point sits on its
 * station, so that one fact says both where the point is and what measures it.
 * At the sheet's peek stop it also carries the gust, in its band colour, since
 * nothing else is on screen.
 */
function Title({ beacon, current, snap }: { beacon: Beacon; current: Current | null; snap?: Snap }) {
  const band = current ? bandForGust(current.gustMph) : null
  return (
    <div className="widget-title">
      <div className="widget-title-text">
        <h2>{beacon.name}</h2>
        <ul className="place-facts">
          <li className="place-elevation">
            <ElevationGlyph />
            <span className="sr-only">Elevation </span>
            {beacon.weatherStation.elevationFt.toLocaleString('en-US')} ft
          </li>
          <li className="place-site">
            <StationGlyph />
            <span className="sr-only">Weather station: </span>
            <span>{beacon.pinnedTo}</span>
          </li>
        </ul>
      </div>
      {snap === 'peek' && current && band && (
        <p className="widget-title-gust" data-band={band.id} aria-hidden="true">
          {mph(current.gustMph)}
          <span className="widget-title-unit"> mph</span>
        </p>
      )}
    </div>
  )
}

/**
 * A line of its own under the title, only when the numbers are not a
 * station's: a warning when no station has anything fresh, or a note while the
 * first readings are on their way. A reporting station needs no line here: the
 * title already says where it stands, and the weather's heading says how old
 * its reading is.
 */
function SourceNotice({ current }: { current: Current }) {
  if (current.status === 'model') {
    return (
      <p className="source" data-source="model">
        <WarningGlyph />
        <span className="source-text">{infoWarning(current)}</span>
      </p>
    )
  }
  if (current.status === 'pending') {
    return (
      <p className="source" data-source="pending">
        <StationGlyph />
        <span className="source-text">Checking the weather station…</span>
      </p>
    )
  }
  return null
}

export function BeaconWidget({ beacon, forecast, current, loading, error, now, onRefresh, variant, onSheetSettle }: Props) {
  const ageMs = forecast ? now - Date.parse(forecast.fetchedAt) : 0
  const [infoOpen, setInfoOpen] = useState(false)

  let body: ReactNode
  if (forecast && current) {
    const warning = infoWarning(current)
    // It stands in for the gust's age too, which can be a little older (see README).
    const readingAge = current.status === 'station' ? agoLabel(current.observedAt ?? forecast.fetchedAt, now) : null
    body = (
      <>
        {error && ageMs > STALE_MS && (
          <p className="notice" role="status">
            Couldn't refresh. This is the forecast from {agoLabel(forecast.fetchedAt, now)}.
          </p>
        )}
        <SourceNotice current={current} />
        <NowWeather current={current} readingAge={readingAge} />
        <NowWind current={current} />
        <SixHourWind forecast={forecast} />
        <footer className="widget-footer">
          <p className="updated">
            <span>{loading ? 'Updating…' : `Updated ${agoLabel(forecast.fetchedAt, now)}`}</span>
            <button type="button" className="text-button" onClick={onRefresh} disabled={loading}>
              Refresh
            </button>
          </p>
          <button type="button" className="text-button about-button" onClick={() => setInfoOpen(true)}>
            <InfoGlyph />
            About this data
          </button>
        </footer>
        {infoOpen && (
          <InfoDialog title="About this data" warning={warning ?? undefined} onClose={() => setInfoOpen(false)}>
            <DataInfo beacon={beacon} current={current} now={now} />
            <Credits />
          </InfoDialog>
        )}
      </>
    )
  } else if (error) {
    body = (
      <div className="widget-empty" role="alert">
        <p>Couldn't load the forecast. Check your connection, then try again.</p>
        <button type="button" className="primary-button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Trying…' : 'Try again'}
        </button>
      </div>
    )
  } else {
    body = (
      <div className="widget-empty" role="status">
        <p>Loading the forecast…</p>
      </div>
    )
  }

  // Stable identities, so the sheet does not see a new header or callback on every clock tick.
  const header = useCallback(
    (snap: Snap) => <Title beacon={beacon} current={current} snap={snap} />,
    [beacon, current],
  )
  const noop = useCallback(() => {}, [])

  if (variant === 'sheet') {
    return (
      <BottomSheet header={header} onSettle={onSheetSettle ?? noop}>
        {body}
      </BottomSheet>
    )
  }
  return (
    <aside className="card widget-card" aria-label="Forecast">
      <Title beacon={beacon} current={current} />
      {body}
    </aside>
  )
}
