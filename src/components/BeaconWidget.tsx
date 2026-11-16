import { useCallback, type ReactNode } from 'react'
import { agoLabel } from '../lib/time'
import { bandForGust, mph, WIND_BANDS } from '../lib/wind'
import type { Beacon, BeaconForecast } from '../types'
import { BottomSheet, type Snap } from './BottomSheet'
import { NowWeather } from './NowWeather'
import { NowWind } from './NowWind'
import { SixHourWind } from './SixHourWind'

interface Props {
  beacon: Beacon
  forecast: BeaconForecast | null
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

const BAND_KEY = WIND_BANDS.map((band, i) => {
  const next = WIND_BANDS[i + 1]
  const range = next ? (i === 0 ? `under ${next.minGustMph}` : `${band.minGustMph} to ${next.minGustMph - 1}`) : `${band.minGustMph} and up`
  return `${band.short.toLowerCase()} ${range}`
}).join(', ')

function Title({ beacon, forecast, snap }: { beacon: Beacon; forecast: BeaconForecast | null; snap?: Snap }) {
  const band = forecast ? bandForGust(forecast.now.gustMph) : null
  return (
    <div className="widget-title">
      <div>
        <h2>{beacon.name}</h2>
        <p>
          {beacon.elevationFt.toLocaleString('en-US')} ft, {beacon.pinnedTo}
        </p>
      </div>
      {snap === 'peek' && forecast && band && (
        <p className="widget-title-gust band-line" data-band={band.id} aria-hidden="true">
          <span className="band-dot" />
          {mph(forecast.now.gustMph)} mph
        </p>
      )}
    </div>
  )
}

export function BeaconWidget({ beacon, forecast, loading, error, now, onRefresh, variant, onSheetSettle }: Props) {
  const ageMs = forecast ? now - Date.parse(forecast.fetchedAt) : 0

  let body: ReactNode
  if (forecast) {
    body = (
      <>
        {error && ageMs > STALE_MS && (
          <p className="notice" role="status">
            Couldn't refresh. This is the forecast from {agoLabel(forecast.fetchedAt, now)}.
          </p>
        )}
        <NowWeather forecast={forecast} />
        <NowWind forecast={forecast} />
        <SixHourWind forecast={forecast} />
        <footer className="widget-footer">
          <p className="updated">
            <span>{loading ? 'Updating…' : `Updated ${agoLabel(forecast.fetchedAt, now)}`}</span>
            <button type="button" className="text-button" onClick={onRefresh} disabled={loading}>
              Refresh
            </button>
          </p>
          <p>
            These are forecast points, not weather stations: each shows a model forecast for that spot, not a measured
            reading. Ridge-top gusts can run higher than forecast.
          </p>
          <p>Gust bands in mph: {BAND_KEY}. Rough guides for riders, not Mammoth's rules for running lifts.</p>
          <p>
            Weather data by{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
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
    (snap: Snap) => <Title beacon={beacon} forecast={forecast} snap={snap} />,
    [beacon, forecast],
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
      <Title beacon={beacon} forecast={forecast} />
      {body}
    </aside>
  )
}
