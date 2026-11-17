import type { CSSProperties } from 'react'
import { agoLabel } from '../lib/time'
import type { MountainForecast } from '../lib/mountainForecast'
import type { Theme } from '../hooks/useTheme'
import { FORECAST_ROW_PX, MountainForecastBar } from './MountainForecastBar'

interface Props {
  fetchedAt: string | null
  loading: boolean
  error: string | null
  now: number
  theme: Theme
  onToggleTheme: () => void
  mountain: MountainForecast | null
}

export function Header({ fetchedAt, loading, error, now, theme, onToggleTheme, mountain }: Props) {
  let status = ''
  if (loading) status = fetchedAt ? 'Updating…' : 'Loading…'
  else if (fetchedAt) status = `Updated ${agoLabel(fetchedAt, now)}`
  else if (error) status = 'No forecast'

  return (
    <header className="toolbar" style={{ '--forecast-row': `${FORECAST_ROW_PX}px` } as CSSProperties}>
      <div className="toolbar-brand">
        <h1>Skicast</h1>
        <p>Mammoth Mountain</p>
      </div>
      <MountainForecastBar forecast={mountain} loading={loading} error={error} />
      <div className="toolbar-actions">
        <p className="toolbar-status" aria-live="polite">
          {status}
        </p>
        <button
          type="button"
          className="icon-button"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 14.2A8 8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2Z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}
