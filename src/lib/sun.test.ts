import { isDaylight, sunElevationDeg } from './sun'

// Mammoth's summit.
const LAT = 37.6311
const LON = -119.0326

describe('sunElevationDeg', () => {
  it('puts the midday sun about where the almanac does in mid November', () => {
    // Solar noon at Mammoth on 17 November 2026 is about 11:41 PST; the sun stands about 33° high.
    const el = sunElevationDeg(Date.parse('2026-11-17T19:41:00Z'), LAT, LON)
    expect(el).toBeGreaterThan(31.5)
    expect(el).toBeLessThan(34)
  })
})

describe('isDaylight', () => {
  it('calls mid-morning and mid-afternoon day', () => {
    expect(isDaylight(Date.parse('2026-11-17T17:00:00Z'), LAT, LON)).toBe(true) // 9 AM PST
    expect(isDaylight(Date.parse('2026-11-17T23:30:00Z'), LAT, LON)).toBe(true) // 3:30 PM PST
  })

  it('calls the evening and the small hours night', () => {
    expect(isDaylight(Date.parse('2026-11-18T02:00:00Z'), LAT, LON)).toBe(false) // 6 PM PST
    expect(isDaylight(Date.parse('2026-11-17T12:00:00Z'), LAT, LON)).toBe(false) // 4 AM PST
  })

  it('turns at sunrise and sunset, to within a few minutes', () => {
    // Sunrise about 6:35 and sunset about 4:47 PST that day.
    expect(isDaylight(Date.parse('2026-11-17T14:25:00Z'), LAT, LON)).toBe(false)
    expect(isDaylight(Date.parse('2026-11-17T14:45:00Z'), LAT, LON)).toBe(true)
    expect(isDaylight(Date.parse('2026-11-18T00:40:00Z'), LAT, LON)).toBe(true)
    expect(isDaylight(Date.parse('2026-11-18T00:55:00Z'), LAT, LON)).toBe(false)
  })
})
