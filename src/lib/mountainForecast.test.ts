import { BEACONS } from '../data/beacons'
import { resolveCurrent } from './current'
import { MOUNTAIN_BEACON_ID, mountainForecast, skyIcon } from './mountainForecast'
import { beaconForecast, parseGrid } from './nwsForecast'
import { gridResponse, type HourSpec } from './__fixtures__/nwsGrid'
import type { NwsWeather } from './sky'

const none: NwsWeather[] = [{ coverage: null, weather: null, intensity: null }]
const day = { weather: none, cloudPct: 0, daylight: true }
const w = (weather: string, intensity: string | null = null, coverage: string | null = 'likely'): NwsWeather[] => [
  { coverage, weather, intensity },
]

describe('skyIcon', () => {
  it('draws the cloud cover, as a sun by day and a moon by night', () => {
    expect(skyIcon({ ...day, cloudPct: 5 }, 5)).toEqual({ icon: 'clear-day', sky: 'Sunny' })
    expect(skyIcon({ ...day, cloudPct: 30 }, 5)).toEqual({ icon: 'clear-day', sky: 'Mostly sunny' })
    expect(skyIcon({ ...day, cloudPct: 5, daylight: false }, 5)).toEqual({ icon: 'clear-night', sky: 'Clear' })
    expect(skyIcon({ ...day, cloudPct: 50 }, 5)).toEqual({ icon: 'partly-day', sky: 'Partly cloudy' })
    expect(skyIcon({ ...day, cloudPct: 50, daylight: false }, 5).icon).toBe('partly-night')
    expect(skyIcon({ ...day, cloudPct: 75 }, 5)).toEqual({ icon: 'cloudy', sky: 'Mostly cloudy' })
    expect(skyIcon({ ...day, cloudPct: 100 }, 5)).toEqual({ icon: 'cloudy', sky: 'Cloudy' })
  })

  it('splits snow into light and heavy by intensity', () => {
    expect(skyIcon({ ...day, weather: w('snow', 'light') }, 5).icon).toBe('light-snow')
    expect(skyIcon({ ...day, weather: w('snow_showers', null, 'chance') }, 5).icon).toBe('light-snow')
    expect(skyIcon({ ...day, weather: w('snow', 'moderate') }, 5).icon).toBe('heavy-snow')
    expect(skyIcon({ ...day, weather: w('snow', 'heavy') }, 5)).toEqual({ icon: 'heavy-snow', sky: 'Heavy snow likely' })
  })

  it('reads a rain and snow mix as snow, and thunder over both', () => {
    const mix = [...w('rain', 'light'), ...w('snow', 'light')]
    expect(skyIcon({ ...day, weather: mix }, 5).icon).toBe('light-snow')
    expect(skyIcon({ ...day, weather: w('rain_showers') }, 5).icon).toBe('rain')
    expect(skyIcon({ ...day, weather: [...mix, ...w('thunderstorms')] }, 5).icon).toBe('thunder')
    expect(skyIcon({ ...day, weather: w('freezing_fog', null, 'areas') }, 5).icon).toBe('fog')
  })

  it('draws a slight chance as the sky, and keeps the words', () => {
    expect(skyIcon({ ...day, weather: w('snow', 'light', 'slight_chance'), cloudPct: 50 }, 5)).toEqual({
      icon: 'partly-day',
      sky: 'Slight chance of light snow',
    })
  })

  it('never draws an hour without cloud cover as clear', () => {
    expect(skyIcon({ ...day, cloudPct: null }, 5)).toEqual({ icon: 'unknown', sky: 'Sky not forecast' })
    expect(skyIcon({ ...day, cloudPct: null }, 30)).toEqual({ icon: 'windy', sky: 'Windy' })
    // What is falling is still known, and still drawn.
    expect(skyIcon({ ...day, cloudPct: null, weather: w('snow', 'heavy') }, 5)).toEqual({
      icon: 'heavy-snow',
      sky: 'Heavy snow likely',
    })
  })

  it('calls strong sustained wind windy when nothing is falling', () => {
    expect(skyIcon(day, 24).icon).toBe('clear-day')
    expect(skyIcon(day, 25)).toEqual({ icon: 'windy', sky: 'Sunny and windy' })
    // Snow in a gale is still drawn as snow.
    expect(skyIcon({ ...day, weather: w('snow', 'heavy') }, 40).icon).toBe('heavy-snow')
  })
})

describe('mountainForecast', () => {
  // 11:20 AM PST on a mid-November day, so every hour shown is daylight.
  const nowMs = Date.parse('2026-11-17T19:20:00.000Z')
  const summit = BEACONS.find((b) => b.id === MOUNTAIN_BEACON_ID)!
  const base: HourSpec = { tempF: 20, gustMph: 30, dirDeg: 229, speedMph: 10 }
  const grid = gridResponse(
    nowMs,
    [
      { ...base, speedMph: 14, cloudPct: 45 },
      { ...base, speedMph: 16, cloudPct: 80 },
      { ...base, speedMph: 18, cloudPct: 95, weather: w('snow_showers', 'light', 'chance') },
      { ...base, speedMph: 22, cloudPct: 100, weather: w('snow', 'heavy') },
      { ...base, speedMph: 31, cloudPct: 20 },
      { ...base, speedMph: 20, cloudPct: 10 },
      { ...base, speedMph: 20, cloudPct: 10 },
    ],
    11053 * 0.3048,
  )
  const forecast = beaconForecast(summit, parseGrid(grid, nowMs), new Date(nowMs).toISOString())

  it('shows this hour and the next four, one hour apart', () => {
    const m = mountainForecast(forecast, null, nowMs)
    expect(m.now).toMatchObject({ label: 'Now', time: '2026-11-17T11:00', icon: 'partly-day', windMph: 14 })
    expect(m.next.map((s) => [s.label, s.icon, Math.round(s.windMph)])).toEqual([
      ['12 PM', 'cloudy', 16],
      ['1 PM', 'light-snow', 18],
      ['2 PM', 'heavy-snow', 22],
      ['3 PM', 'windy', 31],
    ])
  })

  it('takes the current wind from the summit as the Summit beacon shows it, measured when it can be', () => {
    const current = resolveCurrent(forecast, {
      MTH12: {
        stationId: 'MTH12',
        observedAt: '2026-11-17T19:10:00.000Z',
        tempF: null,
        speedMph: 27,
        gustMph: null,
        gustAt: null,
        dirDeg: 250,
      },
    })
    const m = mountainForecast(forecast, current, nowMs)
    // Measured, and strong enough to call the clear-ish hour windy; the later hours stay the forecast's.
    expect(m.now).toMatchObject({ windMph: 27, windSource: 'station', icon: 'windy' })
    expect(m.windStation?.id).toBe('MTH12')
    expect(m.next[0]).toMatchObject({ windMph: 16, windSource: 'model' })
  })

  it('uses the forecast wind, and says so, when no station has it', () => {
    const m = mountainForecast(forecast, resolveCurrent(forecast, {}), nowMs)
    expect(m.now).toMatchObject({ windMph: 14, windSource: 'model' })
    expect(m.windStation).toBeNull()
  })

  it("gives each hour the summit's temperature, measured now when Top Station has it", () => {
    const warming = gridResponse(
      nowMs,
      [12, 14, 17, 19, 22, 23, 23].map((tempF) => ({ ...base, tempF })),
      // The grid square at the station's own height, so no lapse-rate correction.
      11053 * 0.3048,
    )
    const f = beaconForecast(summit, parseGrid(warming, nowMs), new Date(nowMs).toISOString())
    const forecastOnly = mountainForecast(f, resolveCurrent(f, {}), nowMs)
    expect(Math.round(forecastOnly.now.tempF!)).toBe(12)
    expect(forecastOnly.now.tempSource).toBe('model')
    expect(forecastOnly.tempStation).toBeNull()
    expect(forecastOnly.next.map((s) => Math.round(s.tempF!))).toEqual([14, 17, 19, 22])

    const measured = mountainForecast(
      f,
      resolveCurrent(f, {
        MTH03: {
          stationId: 'MTH03',
          observedAt: '2026-11-17T19:10:00.000Z',
          tempF: 9.5,
          speedMph: null,
          gustMph: null,
          gustAt: null,
          dirDeg: null,
        },
      }),
      nowMs,
    )
    expect(measured.now).toMatchObject({ tempF: 9.5, tempSource: 'station' })
    expect(measured.tempStation?.id).toBe('MTH03')
    // The wind here is still the forecast's: each value keeps its own source.
    expect(measured.windStation).toBeNull()
  })

  it('shows no temperature for an hour saved before hours carried one', () => {
    const old = structuredClone(forecast)
    for (const h of old.next6) delete (h as { tempF?: number | null }).tempF
    expect(mountainForecast(old, null, nowMs).next.every((s) => s.tempF === null)).toBe(true)
  })

  it('keeps a missing cloud cover unknown through parsing and a save to localStorage', () => {
    const raw = structuredClone(grid)
    // NWS leaves the layer's later hours out.
    raw.properties.skyCover.values = raw.properties.skyCover.values.slice(0, 1)
    const parsed = beaconForecast(summit, parseGrid(raw, nowMs), new Date(nowMs).toISOString())
    const saved = JSON.parse(JSON.stringify(parsed)) as typeof parsed
    expect(saved.next6[0]!.cloudPct).toBeNull()
    expect(mountainForecast(saved, null, nowMs).next[0]).toMatchObject({ icon: 'unknown', sky: 'Sky not forecast' })
  })

  it('shows what there is when the forecast runs out early', () => {
    const short = { ...forecast, next6: forecast.next6.slice(0, 2) }
    expect(mountainForecast(short, null, nowMs).next).toHaveLength(2)
  })
})
