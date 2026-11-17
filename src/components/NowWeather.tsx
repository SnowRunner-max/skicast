import type { Current } from '../lib/current'

function precipText(inches: number): string {
  if (inches <= 0) return 'No precipitation'
  if (inches < 0.01) return 'Trace of precipitation'
  // NWS forecasts precipitation in blocks of up to six hours, so this is that block's hourly average.
  return `About ${inches.toFixed(2)} in of precipitation an hour`
}

/**
 * Current weather: temperature and feels-like, sky, precipitation, cloud cover.
 * Temperature is measured when the point has a station; sky, precipitation and
 * clouds are never measured there, so they are always the forecast's.
 */
export function NowWeather({ current }: { current: Current }) {
  const { tempF, feelsF, sky, precipIn, cloudPct, sources, status } = current
  const mixed = status === 'station'
  return (
    <section className="widget-section weather" aria-labelledby="weather-heading">
      <h3 id="weather-heading" className="section-label">
        Weather now
      </h3>
      <div className="weather-row">
        <p className="weather-temp">
          <span className="weather-temp-value">{Math.round(tempF)}°F</span>
          <span className="weather-detail">Feels like {Math.round(feelsF)}°</span>
          {mixed && sources.temp === 'model' && <span className="weather-detail">Forecast</span>}
        </p>
        <p className="weather-sky">
          <span className="weather-sky-value">{sky}</span>
          <span className="weather-detail">
            {precipText(precipIn)}, {Math.round(cloudPct)}% cloud cover
          </span>
          {mixed && <span className="weather-detail">Sky is from the forecast</span>}
        </p>
      </div>
    </section>
  )
}
