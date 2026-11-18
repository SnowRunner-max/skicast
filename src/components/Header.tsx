import type { CSSProperties } from 'react'
import { agoLabel } from '../lib/time'
import type { MountainForecast } from '../lib/mountainForecast'
import type { Measure } from '../hooks/useMeasure'
import type { Theme } from '../hooks/useTheme'
import { ThermometerGlyph, WindGlyph } from './Glyphs'
import { FORECAST_ROW_PX, MountainForecastBar } from './MountainForecastBar'
import { SegmentedControl, type Segment } from './SegmentedControl'

const MEASURES: readonly Segment<Measure>[] = [
  { value: 'wind', label: 'Wind', icon: <WindGlyph /> },
  { value: 'temp', label: 'Temperature', icon: <ThermometerGlyph /> },
]

interface Props {
  fetchedAt: string | null
  loading: boolean
  error: string | null
  now: number
  theme: Theme
  onToggleTheme: () => void
  mountain: MountainForecast | null
  measure: Measure
  onMeasureChange: (measure: Measure) => void
}

export function Header({ fetchedAt, loading, error, now, theme, onToggleTheme, mountain, measure, onMeasureChange }: Props) {
  let status = ''
  // Where the toolbar is narrow the age stands alone; "Updated" is what gives way to the switch (see index.css).
  let short = ''
  if (loading) status = fetchedAt ? 'Updating…' : 'Loading…'
  else if (fetchedAt) {
    const ago = agoLabel(fetchedAt, now)
    status = `Updated ${ago}`
    short = ago[0]!.toUpperCase() + ago.slice(1)
  } else if (error) status = 'No forecast'

  return (
    <header className="toolbar" style={{ '--forecast-row': `${FORECAST_ROW_PX}px` } as CSSProperties}>
      <div className="toolbar-brand">
        <h1>Skicast</h1>
        <p>Mammoth Mountain</p>
      </div>
      <MountainForecastBar forecast={mountain} loading={loading} error={error} measure={measure} />
      <div className="toolbar-actions">
        <p className="toolbar-status" aria-live="polite">
          {short ? (
            <>
              <span className="toolbar-status-full">{status}</span>
              <span className="toolbar-status-short">{short}</span>
            </>
          ) : (
            status
          )}
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
        <SegmentedControl label="Show" segments={MEASURES} value={measure} onChange={onMeasureChange} />
      </div>
    </header>
  )
}
