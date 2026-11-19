import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { clearForecastCache } from './hooks/useForecast'
import { clearObservationCache } from './hooks/useObservations'
import { nwsResponse } from './lib/__fixtures__/nws'
import { mammothGrids } from './lib/__fixtures__/nwsGrid'
import { STATIONS } from './data/stations'

// jsdom does no layout; give the map a size so it can place the beacons.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 375 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 700 })
})

beforeEach(() => {
  clearForecastCache()
  clearObservationCache()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const isForecast = (url: unknown) => String(url).startsWith('https://api.weather.gov/gridpoints/')

/** Stands in for every network call: the NWS forecast grid gets `forecast`, the weather stations get `stations`. */
function stubFetch(forecast: (url: string) => Promise<Response>, stations: (url: string) => Promise<Response> = noStations) {
  const fetchMock = vi.fn((url: string | URL | Request) => (isForecast(url) ? forecast(String(url)) : stations(String(url))))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const forecastCalls = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.filter((c) => isForecast(c[0]))

/** Each grid square's forecast from the shared Mammoth scenario. */
const ok = (url: string) => {
  const key = /gridpoints\/(\w+\/\d+,\d+)$/.exec(url)?.[1] ?? ''
  const grid = mammothGrids(Date.now())[key]
  return Promise.resolve(grid ? new Response(JSON.stringify(grid)) : new Response('no such square', { status: 404 }))
}
const noStations = () => Promise.resolve(new Response('down', { status: 503 }))

const isSnapshot = (url: string) => url.startsWith('./api/stations')

/** /api/stations's answer: Top Station in a storm, 3 minutes ago, and nothing else. */
function snapshot(now: number) {
  return {
    version: 1,
    fetchedAt: new Date(now - 60_000).toISOString(),
    fields: {},
    stations: {
      'MM-SUM': {
        name: 'Top Stn/Summit - 11,053ft',
        lat: 37.63059,
        lon: -119.03282,
        elevationFt: 11034,
        readings: {
          '5min': { at: new Date(now - 3 * 60_000).toISOString(), values: { Temp: 12.6, WindSpeed: 49, WindMax: 55.2, WindDir: 213 } },
        },
      },
    },
  }
}

/**
 * The National Weather Service's station readings, with nothing from /api/stations (Mammoth's site down): light wind at
 * McCoy and Canyon; a temperature and an old gust at Top Station; temperature only at Top of Eagle; nothing from Sesame.
 */
const stationsReporting = (url: string) => {
  const now = Date.now()
  const readings: Record<string, Parameters<typeof nwsResponse>[1]> = {
    MTH03: [{ minAgo: 4, tempC: -5 }, { minAgo: 100, tempC: -5, gustKmh: 60 }],
    MTH12: [{ minAgo: 4, speedKmh: 20, dirDeg: 270 }], // Gondola 2 Tower 10, beside Top Station: never shown for the summit
    MTH20: [{ minAgo: 4, tempC: -3, speedKmh: 6, dirDeg: 20, gustKmh: 14 }],
    MTH19: [{ minAgo: 4, tempC: 1, speedKmh: 5, dirDeg: 200, gustKmh: 16 }],
    MTH22: [{ minAgo: 4, tempC: 1 }],
  }
  if (isSnapshot(url)) return Promise.resolve(new Response('not found', { status: 404 }))
  const id = /stations\/(\w+)\//.exec(url)?.[1] ?? ''
  return Promise.resolve(new Response(JSON.stringify(nwsResponse(now, readings[id] ?? []))))
}

/** Mammoth's own feed for Top Station, NWS for the rest. */
const mammothReporting = (url: string) =>
  isSnapshot(url) ? Promise.resolve(new Response(JSON.stringify(snapshot(Date.now())))) : stationsReporting(url)

describe('App', () => {
  it('loads all eight beacons with one forecast request per grid square and selects Summit', async () => {
    const fetchMock = stubFetch(ok)
    render(<App />)

    const summit = await screen.findByRole('button', { name: /^Summit, gusts 24 mph from the southwest/ })
    expect(summit).toHaveAttribute('aria-pressed', 'true')
    for (const name of [
      /^McCoy Station, gusts 24 mph/,
      /^Top of Broadway, gusts 24 mph/,
      /^Top of Gold Rush, gusts 24 mph/,
      /^Cloud Nine, gusts 24 mph/,
      /^Sesame, gusts 24 mph/,
      /^Top of Eagle, gusts 19 mph/,
      /^Canyon Lodge, gusts 20 mph/,
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }

    expect(forecastCalls(fetchMock).map((c) => String(c[0])).sort()).toEqual([
      'https://api.weather.gov/gridpoints/REV/57,17',
      'https://api.weather.gov/gridpoints/REV/57,18',
      'https://api.weather.gov/gridpoints/REV/58,17',
      'https://api.weather.gov/gridpoints/REV/58,18',
    ])
    expect(screen.getByRole('heading', { name: 'Summit' })).toBeInTheDocument()
  })

  it('opens another beacon in the widget when it is tapped', async () => {
    stubFetch(ok)
    render(<App />)

    const eagle = await screen.findByRole('button', { name: /^Top of Eagle, gusts 19 mph/ })
    await userEvent.click(eagle)

    expect(eagle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Top of Eagle' })).toBeInTheDocument()
    expect(screen.getByLabelText('Gusts 19 miles per hour')).toBeInTheDocument()
    expect(screen.getByText('Calm')).toBeInTheDocument()
  })

  it('shows the saved forecast right away on reload, before the network answers', async () => {
    stubFetch(ok)
    const first = render(<App />)
    await screen.findByRole('button', { name: /^Summit, gusts 24 mph/ })
    first.unmount()

    clearForecastCache() // a reload drops the in-memory copy; localStorage remains
    const fetchMock = stubFetch(() => new Promise<Response>(() => {}))
    render(<App />)
    expect(screen.getByRole('button', { name: /^Summit, gusts 24 mph/ })).toBeInTheDocument()
    // The saved copy is fresh (under 10 minutes old), so no new request is made.
    expect(forecastCalls(fetchMock)).toHaveLength(0)
  })

  it('drops a saved forecast over six hours old, since its next six hours are all past', async () => {
    stubFetch(ok)
    const first = render(<App />)
    await screen.findByRole('button', { name: /^Summit, gusts 24 mph/ })
    first.unmount()

    // Age the saved copy past the limit, as if the phone had been in a pocket all day.
    const key = 'skicast:forecast:v4'
    const saved = JSON.parse(localStorage.getItem(key)!) as { fetchedAt: string }[]
    const old = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString()
    localStorage.setItem(key, JSON.stringify(saved.map((f) => ({ ...f, fetchedAt: old }))))

    clearForecastCache()
    const fetchMock = stubFetch(() => new Promise<Response>(() => {}))
    render(<App />)
    expect(screen.queryByRole('button', { name: /^Summit, gusts/ })).not.toBeInTheDocument()
    expect(forecastCalls(fetchMock).length).toBeGreaterThan(0)
  })

  it('says so when the forecast cannot be loaded, and retries', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response('nope', { status: 500 })))
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the forecast")
    expect(screen.getByRole('button', { name: 'Summit, forecast not loaded' })).toBeInTheDocument()

    fetchMock.mockImplementation((url) => (isForecast(url) ? ok(String(url)) : noStations()))
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: /^Summit, gusts 24 mph/ })).toBeInTheDocument()
  })

  it('shows measured values on the map where a station has them, and the forecast where it does not', async () => {
    stubFetch(ok, stationsReporting)
    render(<App />)

    // McCoy and Canyon: measured gusts (14 and 16 km/h are 9 and 10 mph), not the forecast's 24 and 20.
    expect(await screen.findByRole('button', { name: 'McCoy Station, gusts 9 mph from the north-northeast' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Canyon Lodge, gusts 10 mph from the south-southwest' })).toBeInTheDocument()
    // Summit: Top Station's 60 km/h gust (37 mph) is 100 minutes old, but it is measured; the direction is the forecast's.
    expect(screen.getByRole('button', { name: 'Summit, gusts 37 mph from the southwest' })).toBeInTheDocument()
    // Top of Eagle sends temperature only, and Sesame sent nothing: both gusts are the forecast's.
    expect(screen.getByRole('button', { name: 'Top of Eagle, gusts 19 mph from the south-southwest, not from a weather station' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sesame, gusts 24 mph.*not from a weather station$/ })).toBeInTheDocument()
  })

  it('reads every Mammoth station but draws only the beacons', async () => {
    const fetchMock = stubFetch(ok, stationsReporting)
    render(<App />)
    await screen.findByRole('button', { name: 'McCoy Station, gusts 9 mph from the north-northeast' })

    const stationUrls = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('https://api.weather.gov/stations/'))
    // With nothing from Mammoth, every station NWS carries is asked of NWS.
    expect(stationUrls).toHaveLength(STATIONS.filter((s) => s.nwsId).length)
    expect(stationUrls.some((u) => u.includes('/stations/MTH02/'))).toBe(true)
    expect(screen.queryByRole('button', { name: /^Top of 22/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Upper Gondola/ })).not.toBeInTheDocument()
  })

  it('falls back to the forecast everywhere, with a warning, when the stations cannot be reached', async () => {
    stubFetch(ok, noStations)
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Summit, gusts 24 mph from the southwest, not from a weather station' })).toBeInTheDocument()
    expect(screen.getByText('Not from weather station.')).toBeInTheDocument()
  })

  it('shows the Mountain Forecast in the toolbar: now and the next four hours, from the summit', async () => {
    stubFetch(ok)
    render(<App />)

    // Headed by where it is for, in a word; the source and "sustained, not gusts" are in its description.
    const bar = await screen.findByRole('region', { name: 'Mountain forecast Summit' })
    expect(screen.getByRole('banner')).toContainElement(bar)
    expect(bar).toHaveAccessibleDescription(/National Weather Service\. Wind is sustained wind at the summit, not gusts\.$/)
    const slots = within(bar).getAllByRole('listitem')
    expect(slots).toHaveLength(5)
    // The summit square's sustained wind, not its gusts (24 mph): 17.7 now, then 17.9, 17.9, 17.4, 16.8.
    expect(slots[0]).toHaveTextContent(/^Now: (Sunny|Clear), wind 18 mph, forecast\./)
    expect(slots.slice(1).map((s) => /wind (\d+) mph/.exec(s.textContent ?? '')?.[1])).toEqual(['18', '18', '17', '17'])
  })

  it("reads Mammoth's own feed first, and asks NWS only for the stations it has nothing fresh for", async () => {
    const fetchMock = stubFetch(ok, mammothReporting)
    render(<App />)

    // Top Station's own wind, which the NWS copy drops: sustained 49 mph from 213 degrees, gusting 55.
    expect(await screen.findByRole('button', { name: /^Summit, gusts 55 mph from the south-southwest/ })).toBeInTheDocument()
    // McCoy is not in the snapshot, so it comes from NWS.
    expect(screen.getByRole('button', { name: 'McCoy Station, gusts 9 mph from the north-northeast' })).toBeInTheDocument()

    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls.filter(isSnapshot)).toHaveLength(1)
    expect(urls.some((u) => u.includes('/stations/MTH03/'))).toBe(false)
    expect(urls.some((u) => u.includes('/stations/MTH20/'))).toBe(true)
  })

  it('keeps the Mountain Forecast on the summit whichever beacon is selected, with the measured wind when there is one', async () => {
    stubFetch(ok, mammothReporting)
    render(<App />)

    const bar = await screen.findByRole('region', { name: /Mountain forecast/ })
    expect(await within(bar).findByText(/^Now: .*, wind 49 mph\.$/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Canyon Lodge, gusts/ }))
    expect(within(bar).getByText(/^Now: .*, wind 49 mph\.$/)).toBeInTheDocument()
  })

  it('switches the toolbar and the map between wind and temperature, and remembers the choice', async () => {
    stubFetch(ok, stationsReporting)
    const first = render(<App />)
    await screen.findByRole('button', { name: 'Summit, gusts 37 mph from the southwest' })

    // A segmented control in the toolbar, wind first and chosen.
    const show = within(screen.getByRole('banner')).getByRole('group', { name: 'Show' })
    expect(within(show).getByRole('button', { name: 'Wind' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(show).getByRole('button', { name: 'Temperature' }))
    expect(within(show).getByRole('button', { name: 'Temperature' })).toHaveAttribute('aria-pressed', 'true')

    // The map: Top Station's -5 °C is 23 °F. Sesame sent nothing, so its temperature is the forecast's.
    expect(screen.getByRole('button', { name: 'Summit, 23 degrees Fahrenheit' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Top of Eagle, 34 degrees Fahrenheit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sesame, -?\d+ degrees Fahrenheit, not from a weather station$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /gusts/ })).not.toBeInTheDocument()

    // The toolbar: the summit's temperature now, then the forecast's for each hour, each with its degree sign.
    const bar = screen.getByRole('region', { name: 'Mountain forecast Summit' })
    expect(bar).toHaveAccessibleDescription(/Temperature is the air at the summit, in degrees Fahrenheit, measured at Top Station\.$/)
    const slots = within(bar).getAllByRole('listitem')
    expect(slots[0]).toHaveTextContent(/^Now: .+, 23 degrees\./)
    expect(slots[0]).toHaveTextContent(/23°F$/)
    for (const slot of slots.slice(1)) expect(slot).toHaveTextContent(/, -?\d+ degrees\..*-?\d+°$/)

    // Kept for next time.
    first.unmount()
    render(<App />)
    const again = within(screen.getByRole('banner')).getByRole('group', { name: 'Show' })
    expect(within(again).getByRole('button', { name: 'Temperature' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(again).getByRole('button', { name: 'Wind' }))
    expect(await screen.findByRole('button', { name: 'Summit, gusts 37 mph from the southwest' })).toBeInTheDocument()
  })

  it('credits OpenStreetMap on the map itself, and again with the other sources in About this data', async () => {
    stubFetch(ok)
    render(<App />)
    await screen.findByRole('button', { name: /^Summit, gusts/ })
    // OSMF's guidelines want the credit with the map, readable without a tap.
    expect(screen.getByRole('link', { name: '© OpenStreetMap' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')

    await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'OpenStreetMap contributors' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    )
  })

  it('switches between light and dark', async () => {
    stubFetch(ok)
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(document.documentElement).toHaveClass('dark')
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
