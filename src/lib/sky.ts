/** One entry of the NWS grid forecast's `weather` layer, trimmed to what Skicast reads. */
export interface NwsWeather {
  /** How likely or widespread: "chance", "likely", "scattered", "areas", "definite" and so on. */
  coverage: string | null
  /** "snow", "rain_showers", "thunderstorms", "fog" and so on; null for none. */
  weather: string | null
  /** "very_light", "light", "moderate" or "heavy". */
  intensity: string | null
}

/** How the coverage reads in a sentence. Unlisted ones ("definite", none) leave the weather to stand alone. */
const COVERAGE: Record<string, (w: string) => string> = {
  slight_chance: (w) => `slight chance of ${w}`,
  chance: (w) => `chance of ${w}`,
  likely: (w) => `${w} likely`,
  areas: (w) => `areas of ${w}`,
  isolated: (w) => `isolated ${w}`,
  scattered: (w) => `scattered ${w}`,
  numerous: (w) => `numerous ${w}`,
  patchy: (w) => `patchy ${w}`,
  widespread: (w) => `widespread ${w}`,
  occasional: (w) => `occasional ${w}`,
  intermittent: (w) => `intermittent ${w}`,
  periods: (w) => `periods of ${w}`,
  frequent: (w) => `frequent ${w}`,
  brief: (w) => `brief ${w}`,
  few: (w) => `a few ${w}`,
}

const INTENSITY: Record<string, string> = { very_light: 'very light ', light: 'light ', heavy: 'heavy ' }

/** NWS sky-cover words, by the eighths of sky covered: clear up to 1/8, then mostly clear, partly, mostly cloudy, cloudy at 8/8. */
function cloudWords(pct: number): string {
  if (!Number.isFinite(pct)) return 'Unknown sky'
  if (pct < 12.5) return 'Clear'
  if (pct < 37.5) return 'Mostly clear'
  if (pct < 62.5) return 'Partly cloudy'
  if (pct < 87.5) return 'Mostly cloudy'
  return 'Cloudy'
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The sky in plain words: the first weather the forecast names
 * ("Chance of light snow"), or with none, the cloud cover ("Partly cloudy").
 */
export function skyLabel(weather: readonly NwsWeather[], cloudPct: number): string {
  const w = weather.find((x) => typeof x?.weather === 'string' && x.weather.length > 0)
  if (!w) return cloudWords(cloudPct)
  const what = `${(w.intensity && INTENSITY[w.intensity]) ?? ''}${w.weather!.replace(/_/g, ' ')}`
  const phrase = w.coverage && COVERAGE[w.coverage] ? COVERAGE[w.coverage]!(what) : what
  return capitalize(phrase)
}
