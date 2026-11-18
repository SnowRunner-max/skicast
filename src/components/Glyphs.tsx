import { WIND_PATH } from './SkyIcon'

/**
 * Small line glyphs that lead the facts under a beacon's name and the About
 * this data link, and stand for wind and temperature in the toolbar's switch. Drawn on the same 24-unit grid and stroke as the app's other
 * icons (see .glyph in index.css). Decorative: each sits beside words, or
 * words for screen readers, that say what it means.
 */

/** Two peaks: the height of the station. */
export function ElevationGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <path d="M2.5 19.5h19M3.5 19.5 10 7.5l6.5 12M14.4 15.6 17 11l4.5 8.5" />
    </svg>
  )
}

/** An i in a circle: more about the data, and who it is from. */
export function InfoGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.6M12 7.9v.1" />
    </svg>
  )
}

/** A mast sending out readings: the weather station, which is where every point sits. */
export function StationGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <circle cx="12" cy="9.5" r="1.6" />
      <path d="M12 11.6v8.9M8.8 6.3a4.6 4.6 0 0 0 0 6.4M15.2 6.3a4.6 4.6 0 0 1 0 6.4M6 3.6a8.4 8.4 0 0 0 0 11.8M18 3.6a8.4 8.4 0 0 1 0 11.8" />
    </svg>
  )
}

/** The same three gusting lines as the Mountain Forecast's windy sky: wind. */
export function WindGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <path d={WIND_PATH} />
    </svg>
  )
}

/** A thermometer, its stem running down into the bulb: temperature. */
export function ThermometerGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="glyph">
      <path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z" />
      <path d="M12 9.5v7.4" />
    </svg>
  )
}
