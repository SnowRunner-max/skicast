import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import sample from './lib/__fixtures__/open-meteo-sample.json'
import { clearForecastCache } from './hooks/useForecast'

// jsdom does no layout; give the map a size so it can place the beacons.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 375 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 700 })
})

beforeEach(() => {
  clearForecastCache()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(response: () => Promise<Response>) {
  const fetchMock = vi.fn((_url: string | URL | Request) => response())
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const ok = () => Promise.resolve(new Response(JSON.stringify(sample), { status: 200 }))

describe('App', () => {
  it('loads all five beacons with one request and selects Summit', async () => {
    const fetchMock = stubFetch(ok)
    render(<App />)

    const summit = await screen.findByRole('button', { name: 'Summit, gusts 24 mph from the southwest' })
    expect(summit).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^McCoy Station, gusts 24 mph/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Main Lodge, gusts 25 mph/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Canyon Lodge, gusts 20 mph/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Eagle Lodge, gusts 19 mph/ })).toBeInTheDocument()

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0]![0])).toContain('https://api.open-meteo.com/v1/forecast?latitude=')
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
    expect(fetchMock).not.toHaveBeenCalled()
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
