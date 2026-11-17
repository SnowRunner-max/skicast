/**
 * Unit conversions for the NWS API, shared by the station readings (nws.ts)
 * and the grid forecast (nwsForecast.ts).
 *
 * NWS tags every number with a WMO unit code and does not promise which one a
 * given station or layer uses, so each table lists every unit seen in the
 * wild. A code that is not in the table is treated as unreadable by the
 * callers rather than guessed at: a wrong unit would show a plausible-looking
 * wrong number, which is worse than falling back to another source.
 */
export type UnitTable = Readonly<Record<string, (n: number) => number>>

export const cToF = (c: number): number => (c * 9) / 5 + 32
export const fToC = (f: number): number => ((f - 32) * 5) / 9

export const TO_FAHRENHEIT: UnitTable = {
  'wmoUnit:degC': cToF,
  'wmoUnit:degF': (f) => f,
}

/** Celsius, for the lapse-rate correction, which is worked out in metric. */
export const TO_CELSIUS: UnitTable = {
  'wmoUnit:degC': (c) => c,
  'wmoUnit:degF': fToC,
}

export const TO_MPH: UnitTable = {
  'wmoUnit:km_h-1': (k) => k * 0.621371,
  'wmoUnit:m_s-1': (m) => m * 2.236936,
}

export const TO_DEGREES: UnitTable = { 'wmoUnit:degree_(angle)': (d) => d }
export const TO_PERCENT: UnitTable = { 'wmoUnit:percent': (p) => p }
export const TO_INCHES: UnitTable = { 'wmoUnit:mm': (mm) => mm / 25.4 }
