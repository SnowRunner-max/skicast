import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import sample from './lib/__fixtures__/open-meteo-sample.json'
import { clearForecastCache } from './hooks/useForecast'
import { clearObservationCache } from './hooks/useObservations'
import { nwsResponse } from './lib/__fixtures__/nws'

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

/** Stands in for every network call: Open-Meteo gets `forecast`, the weather stations get `stations`. */
function stubFetch(forecast: () => Promise<Response>, stations: (url: string) => Promise<Response> = noStations) {
  const fetchMock = vi.fn((url: string | URL | Request) =>
    String(url).startsWith('https://api.weather.gov/') ? stations(String(url)) : forecast(),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const forecastCalls = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.filter((c) => String(c[0]).startsWith('https://api.open-meteo.com/'))

const ok = () => Promise.resolve(new Response(JSON.stringify(sample), { status: 200 }))
const noStations = () => Promise.resolve(new Response('down', { status: 503 }))

/** Light wind at McCoy and Canyon, a temperature and a gust at the summit, temperature only at Eagle. */
const stationsReporting = (url: string) => {
  const now = Date.now()
  const readings: Record<string, Parameters<typeof nwsResponse>[1]> = {
    MTH03: [{ minAgo: 4, tempC: -5 }, { minAgo: 100, tempC: -5, gustKmh: 60 }],
    MTH20: [{ minAgo: 4, tempC: -3, speedKmh: 6, dirDeg: 20, gustKmh: 14 }],
    MTH19: [{ minAgo: 4, tempC: 1, speedKmh: 5, dirDeg: 200, gustKmh: 16 }],
    MTH17: [{ minAgo: 4, tempC: 1 }],
  }
  const id = /stations\/(\w+)\//.exec(url)?.[1] ?? ''
  return Promise.resolve(new Response(JSON.stringify(nwsResponse(now, readings[id] ?? []))))
}

describe('App', () => {
  it('loads all five beacons with one forecast request and selects Summit', async () => {
    const fetchMock = stubFetch(ok)
    render(<App />)

    const summit = await screen.findByRole('button', { name: /^Summit, gusts 24 mph from the southwest/ })
    expect(summit).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^McCoy Station, gusts 24 mph/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Main Lodge, gusts 25 mph/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Canyon Lodge, gusts 20 mph/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Eagle Lodge, gusts 19 mph/ })).toBeInTheDocument()

    expect(forecastCalls(fetchMock)).toHaveLength(1)
    expect(String(forecastCalls(fetchMock)[0]![0])).toContain('https://api.open-meteo.com/v1/forecast?latitude=')
    expect(screen.getByRole('heading', { name: 'Summit' })).toBeInTheDocument()
  })

  it('opens another beacon in the widget when it is tapped', async () => {
    stubFetch(ok)
    render(<App />)

    const eagle = await screen.findByRole('button', { name: /^Eagle Lodge, gusts 19 mph/ })
    await userEvent.click(eagle)

    expect(eagle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Eagle Lodge' })).toBeInTheDocument()
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

  it('says so when the forecast cannot be loaded, and retries', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response('nope', { status: 500 })))
    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the forecast")
    expect(screen.getByRole('button', { name: 'Summit, forecast not loaded' })).toBeInTheDocument()

    fetchMock.mockImplementation(ok)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: /^Summit, gusts 24 mph/ })).toBeInTheDocument()
  })

  it('shows measured values on the map where a station has them, and the forecast where it does not', async () => {
    stubFetch(ok, stationsReporting)
    render(<App />)

    // McCoy and Canyon: measured gusts (14 and 16 km/h are 9 and 10 mph), not the forecast's 24 and 20.
    expect(await screen.findByRole('button', { name: 'McCoy Station, gusts 9 mph from the north-northeast' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Canyon Lodge, gusts 10 mph from the south-southwest' })).toBeInTheDocument()
    // Summit: its 60 km/h gust (37 mph) is 100 minutes old, but it is measured.
    expect(screen.getByRole('button', { name: /^Summit, gusts 37 mph from the southwest$/ })).toBeInTheDocument()
    // Eagle reports temperature only, and Main Lodge has no station: both gusts are the forecast's.
    expect(screen.getByRole('button', { name: 'Eagle Lodge, gusts 19 mph from the south-southwest, not from a weather station' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Main Lodge, gusts 25 mph.*not from a weather station$/ })).toBeInTheDocument()
  })

  it('falls back to the forecast everywhere, with a warning, when the stations cannot be reached', async () => {
    stubFetch(ok, noStations)
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Summit, gusts 24 mph from the southwest, not from a weather station' })).toBeInTheDocument()
    expect(screen.getByText('Not from weather station.')).toBeInTheDocument()
  })

  it('credits OpenStreetMap on the map', async () => {
    stubFetch(ok)
    render(<App />)
    await screen.findByRole('button', { name: /^Summit, gusts/ })
    expect(screen.getAllByRole('link', { name: 'OpenStreetMap contributors' })[0]).toHaveAttribute(
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
