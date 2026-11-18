import { MAP } from '../data/mapPaths'
import { BAND_SCALE_MAX_MPH, bandForGust, compassPoint, compassWord, mph, WIND_BANDS } from '../lib/wind'
import type { Current } from '../lib/current'
import { windArrowAngle } from './WindArrow'

/** Each band's share of the meter, from the band table so the two cannot drift apart. */
const METER_SEGMENTS = WIND_BANDS.map((band, i) => ({
  id: band.id,
  span: (WIND_BANDS[i + 1]?.minGustMph ?? BAND_SCALE_MAX_MPH) - band.minGustMph,
}))

/**
 * Where the gust sits across the wind bands: a thin bar split into the bands,
 * the one the gust is in drawn at full strength, and a marker at the gust.
 * Decorative: the band word above it says the same thing.
 */
function BandMeter({ gustMph }: { gustMph: number }) {
  const band = bandForGust(gustMph)
  const at = (Math.min(Math.max(gustMph, 0), BAND_SCALE_MAX_MPH) / BAND_SCALE_MAX_MPH) * 100
  return (
    <div className="band-meter" aria-hidden="true">
      {METER_SEGMENTS.map((s) => (
        <span
          key={s.id}
          className="band-meter-segment"
          data-band={s.id}
          data-current={s.id === band.id || undefined}
          style={{ flexGrow: s.span }}
        />
      ))}
      {/* Kept a marker's half-width (7px, see .band-meter-marker) inside each end, so a calm or a 90 mph gust stays on the bar. */}
      <span className="band-meter-marker" style={{ left: `clamp(7px, ${at}%, calc(100% - 7px))` }} />
    </div>
  )
}

/**
 * The wind itself, the way a compass shows it: the sustained speed in the
 * middle, and an arrow through it the way the wind blows. Drawn in the map's
 * frame, so the arrow matches the beacons'; the N mark gives true north.
 */
function WindDial({ speedMph, dirDeg }: { speedMph: number; dirDeg: number }) {
  return (
    <svg
      className="dial"
      width="94"
      height="94"
      viewBox="-47 -47 94 94"
      role="img"
      aria-label={`Sustained wind ${mph(speedMph)} miles per hour from the ${compassWord(dirDeg)}`}
    >
      <circle className="dial-rim" r="34" />
      <g transform={`rotate(${MAP.northAngle})`}>
        <path className="dial-tick" d="M0 -34V-29" />
        <text className="dial-north" y="-41" transform={`rotate(${-MAP.northAngle} 0 -41)`}>
          N
        </text>
      </g>
      {/*
        Broken in the middle, where the speed sits: head on one side, tail on
        the other, each reaching just inside the rim. The gap (20) clears the
        corners of a two-figure speed and "mph" at any angle.
      */}
      <g transform={`rotate(${windArrowAngle(dirDeg)})`}>
        <path className="dial-arrow" d="M0 -20V-31.5M-5.5 -26 0 -32 5.5 -26M0 20V28.5" />
        <circle className="dial-tail" cy="30.8" r="2.2" />
      </g>
      <text className="dial-speed" y="2">
        {mph(speedMph)}
      </text>
      <text className="dial-unit" y="14">
        mph
      </text>
    </svg>
  )
}

/** Current wind: the gust is the one hero number on screen, with its band; the dial holds the sustained wind. */
export function NowWind({ current }: { current: Current }) {
  const { gustMph, speedMph, dirDeg, sources, status } = current
  // When some values are measured, say which ones are not. A point with no station is labelled once, at the top.
  const note = (source: 'station' | 'model') => status === 'station' && source === 'model'
  const band = bandForGust(gustMph)
  return (
    <section className="widget-section wind" aria-labelledby="wind-heading" data-band={band.id}>
      <div className="wind-main">
        <div className="wind-gust">
          <h3 id="wind-heading" className="section-label">
            Gusts{note(sources.gust) ? ', forecast' : ''}
          </h3>
          <p className="hero" aria-label={`Gusts ${mph(gustMph)} miles per hour`}>
            {mph(gustMph)}
            <span className="hero-unit">mph</span>
          </p>
          <p className="band-word">{band.label}</p>
        </div>
        <div className="wind-dial">
          <WindDial speedMph={speedMph} dirDeg={dirDeg} />
          <p className="wind-from" aria-hidden="true">
            From {compassPoint(dirDeg)}
          </p>
          {(note(sources.speed) || note(sources.dir)) && <p className="wind-note">Forecast</p>}
        </div>
      </div>
      <BandMeter gustMph={gustMph} />
    </section>
  )
}
