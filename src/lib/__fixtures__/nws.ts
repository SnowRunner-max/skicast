/** Builders for NWS station-observation responses, so tests read as the situation they describe. */

export interface Reading {
  /** Minutes before `now` that the reading was taken. */
  minAgo: number
  /** Degrees Celsius, as NWS sends it. */
  tempC?: number | null
  /** km/h, as NWS sends it. */
  speedKmh?: number | null
  gustKmh?: number | null
  dirDeg?: number | null
  /** Quality flag applied to every value in this reading. */
  qc?: string
}

const value = (v: number | null | undefined, unitCode: string, qc: string) => ({
  value: v ?? null,
  unitCode,
  qualityControl: qc,
})

export function nwsResponse(nowMs: number, readings: Reading[]) {
  return {
    features: readings.map((r) => ({
      properties: {
        timestamp: new Date(nowMs - r.minAgo * 60_000).toISOString(),
        temperature: value(r.tempC, 'wmoUnit:degC', r.qc ?? 'V'),
        windSpeed: value(r.speedKmh, 'wmoUnit:km_h-1', r.qc ?? 'V'),
        windGust: value(r.gustKmh, 'wmoUnit:km_h-1', r.qc ?? 'S'),
        windDirection: value(r.dirDeg, 'wmoUnit:degree_(angle)', r.qc ?? 'V'),
      },
    })),
  }
}
