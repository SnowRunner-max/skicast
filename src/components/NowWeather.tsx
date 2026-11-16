import { skyLabel } from '../lib/sky'
import type { BeaconForecast } from '../types'

function precipText(inches: number): string {
  if (inches <= 0) return 'No precipitation'
  if (inches < 0.01) return 'Trace of precipitation'
  return `${inches.toFixed(2)} in of precipitation this hour`
}

/** Current weather: temperature and feels-like, sky, precipitation, cloud cover. */
export function NowWeather({ forecast }: { forecast: BeaconForecast }) {
  const { tempF, feelsF, code, precipIn, cloudPct } = forecast.now
  return (
    <section className="widget-section weather" aria-labelledby="weather-heading">
      <h3 id="weather-heading" className="section-label">
        Weather now
      </h3>
      <div className="weather-row">
        <p className="weather-temp">
          <span className="weather-temp-value">{Math.round(tempF)}°F</span>
          <span className="weather-detail">Feels like {Math.round(feelsF)}°</span>
        </p>
        <p className="weather-sky">
          <span className="weather-sky-value">{skyLabel(code)}</span>
          <span className="weather-detail">
            {precipText(precipIn)}, {Math.round(cloudPct)}% cloud cover
          </span>
        </p>
      </div>
    </section>
  )
}
