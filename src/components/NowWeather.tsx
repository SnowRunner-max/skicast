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
 * clouds are never measured there, so they are always the forecast's. That is
 * true of every point, so it is said once, in the info dialog, not here.
 * While a station is reporting, the heading also carries the age of its
 * reading at the far end, the way the hourly strip's heading carries its
 * source. As the first thing under the title, it stands for every measured
 * value on the panel.
 */
export function NowWeather({ current, readingAge }: { current: Current; readingAge: string | null }) {
  const { tempF, feelsF, sky, precipIn, cloudPct, sources, status } = current
  // A station that sends no temperature is the exception, so that one is marked where it shows.
  const mixed = status === 'station'
  return (
    <section className="widget-section weather" aria-labelledby="weather-heading">
      <div className="section-head">
        <h3 id="weather-heading" className="section-label">
          Weather now
        </h3>
        {readingAge && (
          <p className="section-aside">
            <span className="sr-only">Measured </span>
            {readingAge}
          </p>
        )}
      </div>
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
        </p>
      </div>
    </section>
  )
}
