/** How long a fetched forecast is reused before asking again. */
export const FORECAST_TTL_MS = 10 * 60 * 1000

/** Forecast times are shown in the mountain's time zone, wherever the reader is. */
export const MOUNTAIN_TIME_ZONE = 'America/Los_Angeles'

/**
 * Where the forecast comes from, named here so the on-screen copy is true by
 * construction. The National Weather Service's gridded forecast (NDFD): the
 * Reno office's forecasters start from NOAA's National Blend of Models and
 * edit it, on a 2.5 km grid. It is public domain, free for any use, and
 * served from the same keyless, cross-origin API as the station readings.
 */
export const FORECAST_SOURCE = { name: 'National Weather Service', short: 'NWS' } as const

/** Give up on a slow forecast request so the screen can say so and offer a retry. */
export const FORECAST_TIMEOUT_MS = 10_000

/**
 * The National Weather Service's public API: the forecast, and the fallback
 * for any station Mammoth's own feed has nothing fresh for. It is free, needs
 * no key and allows cross-origin reads.
 */
export const NWS_BASE_URL = 'https://api.weather.gov'

/**
 * Where the app reads Mammoth's own station readings: a function on the same
 * host (netlify/functions/stations.ts) that asks Mammoth's station site and
 * caches the answer for a minute. Relative, like the rest of the build.
 */
export const MAMMOTH_SNAPSHOT_URL = './api/stations'

/** Give up on Mammoth's readings and read NWS instead. Leaves room for the function to wait on Mammoth's site (8 s at most). */
export const MAMMOTH_TIMEOUT_MS = 10_000

/**
 * Mammoth's reading takes precedence while it is at most this old, even when
 * NWS has a newer one. Stations report every 5 minutes, so this is one report
 * plus one missed cycle: only after that is the station treated as stalled and
 * NWS asked, and a newer NWS reading used. An older Mammoth reading is still
 * kept if NWS has nothing newer.
 */
export const MAMMOTH_FRESH_MS = 10 * 60 * 1000

/** Station readings are refetched this often: Mammoth's stations report every 5 minutes, and NWS caches for 5. */
export const OBSERVATION_TTL_MS = 5 * 60 * 1000

/**
 * How many recent readings to pull per station. Stations report every 5 to 10
 * minutes; 48 covers about four hours, enough to find the latest gust.
 */
export const OBSERVATION_LIMIT = 48

/**
 * A station reading older than this is ignored and the point falls back to the
 * model. The NWS feed sometimes runs an hour or more behind, so this is
 * generous; the screen always says how old the reading is.
 */
export const OBSERVATION_MAX_AGE_MS = 2 * 60 * 60 * 1000

/**
 * Gusts are held to a looser limit. A station's gust only appears in the feed
 * after NWS quality screening, so it is typically 1 to 2 hours old. A measured
 * gust that old still beats the model here (the summit station reports 10 mph
 * or more above the forecast all day), and the screen says how old it is.
 */
export const OBSERVATION_GUST_MAX_AGE_MS = 3 * 60 * 60 * 1000

/** Give up on a slow station so the rest of the screen is never held up. */
export const OBSERVATION_TIMEOUT_MS = 8000

/** A station reading this fresh is called real time; older ones are described by their age instead. */
export const OBSERVATION_LIVE_MS = 30 * 60 * 1000
