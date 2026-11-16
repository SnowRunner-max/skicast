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
