/**
 * Open-Meteo's free endpoint is for non-commercial use only. If Skicast ever
 * makes money, switch this to the paid host (customer-api.open-meteo.com) and
 * add the API key in src/lib/openMeteo.ts.
 */
export const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast'

/** How long a fetched forecast is reused before asking again. */
export const FORECAST_TTL_MS = 10 * 60 * 1000

/** Forecast times are shown in the mountain's time zone, wherever the reader is. */
export const MOUNTAIN_TIME_ZONE = 'America/Los_Angeles'

/**
 * The forecast model, named so the on-screen copy is true by construction.
 * NOAA's National Blend of Models (NBM): a 2.5 km grid, updated hourly, whose
 * gusts are already calibrated against recent observations. It replaced HRRR,
 * which Open-Meteo stops serving on 2026-11-30 (and whose 3 km gusts ran about
 * 9 mph low at the summit and 4-10 mph high at the base stations). Pinning it
 * keeps Open-Meteo's "best match" from changing underneath the label.
 */
export const FORECAST_MODEL = { id: 'ncep_nbm_conus', label: 'NOAA National Blend' } as const

/**
 * Mammoth Mountain's own weather stations report through the National Weather
 * Service's public API. It is free, needs no key and allows cross-origin reads.
 */
export const NWS_BASE_URL = 'https://api.weather.gov'

/** NWS caches observations for 5 minutes, so asking more often gains nothing. */
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
