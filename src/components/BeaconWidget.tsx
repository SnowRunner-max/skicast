import { useCallback, useState, type ReactNode } from 'react'
import { agoLabel } from '../lib/time'
import type { Current } from '../lib/current'
import { bandForGust, mph } from '../lib/wind'
import type { Beacon, BeaconForecast } from '../types'
import { BottomSheet, type Snap } from './BottomSheet'
import { DataInfo, infoWarning } from './DataInfo'
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
  /** Side card on desktop, bottom sheet on phones. */
  variant: 'card' | 'sheet'
  onSheetSettle?: (visiblePx: number) => void
}

/** Past this age a forecast that failed to refresh is called out as old. */
const STALE_MS = 20 * 60 * 1000

function Title({ beacon, current, snap }: { beacon: Beacon; current: Current | null; snap?: Snap }) {
  const band = current ? bandForGust(current.gustMph) : null
  return (
    <div className="widget-title">
      <div>
        <h2>{beacon.name}</h2>
        <p>
          {beacon.elevationFt.toLocaleString('en-US')} ft, {beacon.pinnedTo}
        </p>
      </div>
      {snap === 'peek' && current && band && (
        <p className="widget-title-gust band-line" data-band={band.id} aria-hidden="true">
          <span className="band-dot" />
          {mph(current.gustMph)} mph
        </p>
      )}
    </div>
  )
}

export function BeaconWidget({ beacon, forecast, current, loading, error, now, onRefresh, variant, onSheetSettle }: Props) {
  const ageMs = forecast ? now - Date.parse(forecast.fetchedAt) : 0
  const [infoOpen, setInfoOpen] = useState(false)

  let body: ReactNode
  if (forecast && current) {
    const warning = infoWarning(current)
    body = (
      <>
        {error && ageMs > STALE_MS && (
          <p className="notice" role="status">
            Couldn't refresh. This is the forecast from {agoLabel(forecast.fetchedAt, now)}.
          </p>
        )}
        <div className="source-row">
          <p className="source-line" data-source={current.status}>
            {current.status === 'model' && <WarningGlyph />}
            {current.status === 'station' &&
              `Measured at ${beacon.weatherStation?.name}, ${agoLabel(current.observedAt ?? forecast.fetchedAt, now)}`}
            {current.status === 'model' && warning}
            {current.status === 'pending' && 'Checking the weather station…'}
          </p>
          <button type="button" className="text-button" onClick={() => setInfoOpen(true)}>
            About this data
          </button>
        </div>
        {infoOpen && (
          <InfoDialog title="About this data" warning={warning ?? undefined} onClose={() => setInfoOpen(false)}>
            <DataInfo beacon={beacon} current={current} now={now} />
          </InfoDialog>
        )}
        <NowWeather current={current} />
        <NowWind current={current} now={now} />
        <SixHourWind forecast={forecast} />
        <footer className="widget-footer">
          <p className="updated">
            <span>{loading ? 'Updating…' : `Updated ${agoLabel(forecast.fetchedAt, now)}`}</span>
            <button type="button" className="text-button" onClick={onRefresh} disabled={loading}>
              Refresh
            </button>
          </p>
          <p>
            Forecast by{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
            . Station readings via the{' '}
            <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">
              National Weather Service
            </a>
            . Lift data ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap contributors
            </a>
            .
          </p>
        </footer>
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
