import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import sample from '../lib/__fixtures__/open-meteo-sample.json'
import { BEACONS } from '../data/beacons'
import { parseForecast } from '../lib/openMeteo'
import { BeaconWidget } from './BeaconWidget'

const FETCHED_AT = '2026-11-16T05:20:00.000Z'
const forecasts = parseForecast(sample, BEACONS, FETCHED_AT)
const summit = forecasts[0]!
const fourMinLater = Date.parse(FETCHED_AT) + 4 * 60_000

function renderWidget(overrides: Partial<Parameters<typeof BeaconWidget>[0]> = {}) {
  const onRefresh = vi.fn()
  render(
    <BeaconWidget
      beacon={summit.beacon}
      forecast={summit}
      loading={false}
      error={null}
      now={fourMinLater}
      onRefresh={onRefresh}
      variant="card"
      {...overrides}
    />,
  )
  return { onRefresh }
}

describe('BeaconWidget', () => {
  it('names the beacon and what it is pinned to', () => {
    renderWidget()
    expect(screen.getByRole('heading', { name: 'Summit' })).toBeInTheDocument()
    expect(screen.getByText('11,053 ft, Panorama Gondola top station')).toBeInTheDocument()
  })

  it('shows current weather', () => {
    renderWidget()
    expect(screen.getByText('21°F')).toBeInTheDocument()
    expect(screen.getByText('Feels like 7°')).toBeInTheDocument()
    expect(screen.getByText('Clear')).toBeInTheDocument()
    expect(screen.getByText('No precipitation, 0% cloud cover')).toBeInTheDocument()
  })

  it('makes the current gust the hero number, with band, direction and sustained speed', () => {
    renderWidget()
    expect(screen.getByLabelText('Gusts 24 miles per hour')).toHaveClass('hero')
    expect(screen.getByText('Windy, upper lifts may hold')).toBeInTheDocument()
    expect(screen.getByLabelText('From the southwest')).toHaveTextContent('From SW')
    expect(screen.getByText('Sustained 18 mph')).toBeInTheDocument()
  })

  it('lists the next six hours with numbers, not color alone, and names the peak', () => {
    renderWidget()
    const hours = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(hours).toHaveLength(6)
    expect(hours[0]).toHaveTextContent('10 PM: gusts 25 mph, sustained 18 mph, from the southwest. Windy.')
    expect(hours[0]).toHaveAttribute('data-band', 'windy')
    expect(screen.getByText('Peak gust 28 mph at 11 PM')).toBeInTheDocument()
  })

  it('says when it was updated and that these are forecast points', () => {
    renderWidget()
    expect(screen.getByText('Updated 4 min ago')).toBeInTheDocument()
    expect(screen.getByText(/forecast points, not weather stations/)).toBeInTheDocument()
    expect(screen.getByText(/calm under 20, windy 20 to 39, strong 40 and up/)).toBeInTheDocument()
  })

  it('refreshes on request', async () => {
    const { onRefresh } = renderWidget()
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('shows a loading line before the first forecast', () => {
    renderWidget({ forecast: null, loading: true })
    expect(screen.getByRole('status')).toHaveTextContent('Loading the forecast…')
  })

  it('offers a retry when the first load fails', async () => {
    const { onRefresh } = renderWidget({ forecast: null, error: 'Open-Meteo answered 500' })
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the forecast")
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('keeps an older forecast on screen when a refresh fails, and says how old it is', () => {
    renderWidget({ error: 'offline', now: Date.parse(FETCHED_AT) + 3 * 3_600_000 })
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't refresh. This is the forecast from 3 hr ago.")
    expect(screen.getByLabelText('Gusts 24 miles per hour')).toBeInTheDocument()
  })

  it('labels a strong-wind beacon as strong', () => {
    const windy = { ...summit, now: { ...summit.now, gustMph: 52.4, dirDeg: 270 } }
    renderWidget({ forecast: windy })
    expect(screen.getByText('Strong, expect upper-mountain holds')).toBeInTheDocument()
    expect(screen.getByLabelText('From the west')).toHaveTextContent('From W')
  })
})
