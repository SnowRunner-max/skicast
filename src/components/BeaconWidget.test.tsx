import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import sample from '../lib/__fixtures__/open-meteo-sample.json'
import { BEACONS } from '../data/beacons'
import { resolveCurrent } from '../lib/current'
import { parseForecast } from '../lib/openMeteo'
import type { Observation } from '../types'
import { BeaconWidget } from './BeaconWidget'

const FETCHED_AT = '2026-11-16T05:20:00.000Z'
const forecasts = parseForecast(sample, BEACONS, FETCHED_AT)
const summit = forecasts[0]!
const fourMinLater = Date.parse(FETCHED_AT) + 4 * 60_000

/** Top Station reports temperature and a gust, not sustained wind or direction. */
const summitStation: Observation = {
  stationId: 'MTH03',
  observedAt: new Date(fourMinLater - 3 * 60_000).toISOString(),
  tempF: 23,
  speedMph: null,
  gustMph: 37,
  gustAt: new Date(fourMinLater - 100 * 60_000).toISOString(),
  dirDeg: null,
}
const mccoyStation: Observation = {
  stationId: 'MTH20',
  observedAt: new Date(fourMinLater - 3 * 60_000).toISOString(),
  tempF: 27,
  speedMph: 4,
  gustMph: 9,
  gustAt: new Date(fourMinLater - 3 * 60_000).toISOString(),
  dirDeg: 315,
}

function renderWidget(overrides: Partial<Parameters<typeof BeaconWidget>[0]> = {}) {
  const onRefresh = vi.fn()
  render(
    <BeaconWidget
      beacon={summit.beacon}
      forecast={summit}
      current={resolveCurrent(summit, null)}
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

  it('says when the forecast was updated', () => {
    renderWidget()
    expect(screen.getByText('Updated 4 min ago')).toBeInTheDocument()
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
    renderWidget({ forecast: windy, current: resolveCurrent(windy, null) })
    expect(screen.getByText('Strong, expect upper-mountain holds')).toBeInTheDocument()
    expect(screen.getByLabelText('From the west')).toHaveTextContent('From W')
  })

  describe('where the numbers come from', () => {
    const main = forecasts[2]!
    const mccoy = forecasts[1]!

    it('shows the station reading and how old it is, and leads with the measured values', () => {
      renderWidget({ beacon: mccoy.beacon, forecast: mccoy, current: resolveCurrent(mccoy, mccoyStation) })
      expect(screen.getByText('Measured at McCoy Station, 3 min ago')).toBeInTheDocument()
      expect(screen.getByLabelText('Gusts 9 miles per hour')).toBeInTheDocument()
      expect(screen.getByText('27°F')).toBeInTheDocument()
      expect(screen.getByText('Sustained 4 mph')).toBeInTheDocument()
      expect(screen.getByLabelText('From the northwest')).toHaveTextContent('From NW')
      expect(screen.queryByText('Not from weather station.')).not.toBeInTheDocument()
    })

    it('marks the values a station does not report as forecast, and says how old a lagging gust is', () => {
      renderWidget({ current: resolveCurrent(summit, summitStation) })
      expect(screen.getByLabelText('Gusts 37 miles per hour')).toBeInTheDocument()
      expect(screen.getByText('Gust measured 1 hr ago')).toBeInTheDocument()
      expect(screen.getByText('Sustained 18 mph, forecast')).toBeInTheDocument()
      expect(screen.getByText('Sky is from the forecast')).toBeInTheDocument()
    })

    it('labels the hourly strip with the forecast model', () => {
      renderWidget()
      expect(screen.getByText('NOAA National Blend forecast')).toBeInTheDocument()
    })

    it('warns when the point has no station, in the widget and at the top of the info modal', async () => {
      renderWidget({ beacon: main.beacon, forecast: main, current: resolveCurrent(main, null) })
      expect(screen.getByText('Not from weather station.')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
      const dialog = screen.getByRole('dialog', { name: 'About this data' })
      const text = dialog.textContent ?? ''
      expect(text.startsWith('Not from weather station.')).toBe(true)
      expect(dialog).toHaveTextContent(
        'Real time weather not available for this location. Current weather and forecast are from NOAA National Blend and are for this specific point. Ridge-top gusts and gusts on lift can run higher than forecast.',
      )
      expect(dialog).toHaveTextContent(
        'Gust bands in mph: calm under 20, windy 20-39, strong 40 and up. This is only a rough guide for riders.',
      )
    })

    it('says so when a point has a station but it has nothing fresh', async () => {
      renderWidget({ current: resolveCurrent(summit, null) })
      expect(screen.getByText('Not from weather station.')).toBeInTheDocument()
    })

    it('does not cry wolf while a station point is still waiting for its readings', () => {
      renderWidget({ current: resolveCurrent(summit, undefined) })
      expect(screen.queryByText('Not from weather station.')).not.toBeInTheDocument()
      expect(screen.getByText('Checking the weather station…')).toBeInTheDocument()
    })

    it('calls fresh station readings real time, with no warning in the info modal', async () => {
      renderWidget({ beacon: mccoy.beacon, forecast: mccoy, current: resolveCurrent(mccoy, mccoyStation) })
      await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent(
        'Current weather is real time. Forecast is from NOAA National Blend and is for this specific point. Ridge-top gusts and gusts on lift can run higher than forecast.',
      )
      expect(dialog).toHaveTextContent('Measured at McCoy Station (MTH20)')
      expect(dialog).not.toHaveTextContent('Not from weather station.')
      expect(dialog).toHaveTextContent('Gust bands in mph: calm under 20, windy 20-39, strong 40 and up.')
    })

    it('lists what a partly reporting station leaves to the model', async () => {
      renderWidget({ current: resolveCurrent(summit, summitStation) })
      await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
      expect(screen.getByRole('dialog')).toHaveTextContent(
        'Not measured at this station, so from NOAA National Blend: sustained wind, wind direction, sky, cloud cover and precipitation.',
      )
    })

    it('describes an old reading by its age instead of calling it real time', async () => {
      const old = { ...mccoyStation, observedAt: new Date(fourMinLater - 75 * 60_000).toISOString() }
      renderWidget({ beacon: mccoy.beacon, forecast: mccoy, current: resolveCurrent(mccoy, old) })
      expect(screen.getByText('Measured at McCoy Station, 1 hr ago')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent("Current weather is the station's latest reading, taken 1 hr ago.")
      expect(dialog).not.toHaveTextContent('Current weather is real time.')
    })

    it('closes the info modal with Escape or Close, and returns focus to the button', async () => {
      renderWidget()
      const open = screen.getByRole('button', { name: 'About this data' })
      await userEvent.click(open)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(open).toHaveFocus()

      await userEvent.click(open)
      await userEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
