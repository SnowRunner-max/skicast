import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resolveCurrent } from '../lib/current'
import { mammothForecasts } from '../lib/__fixtures__/nwsGrid'
import type { Observation } from '../types'
import { BeaconWidget } from './BeaconWidget'

const FETCHED_AT = '2026-11-16T05:20:00.000Z'
const forecasts = mammothForecasts(Date.parse(FETCHED_AT), FETCHED_AT)
const byId = (id: string) => forecasts.find((f) => f.beacon.id === id)!
const summit = byId('summit')
const fourMinLater = Date.parse(FETCHED_AT) + 4 * 60_000

/** Readings keyed by station id, as the app holds them. */
const at = (...readings: Observation[]) => Object.fromEntries(readings.map((o) => [o.stationId, o]))

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
      current={resolveCurrent(summit, {})}
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

/** The line saying where the numbers come from, found by the label it carries for screen readers. */
const sourceLine = () => screen.getByText('Source:').closest('p')!

/** The band key in the info dialog, one row per band. */
const bandKeyRows = (dialog: HTMLElement) =>
  within(dialog)
    .getAllByRole('listitem')
    .map((li) => li.textContent)

describe('BeaconWidget', () => {
  it('names the beacon, then its height and what it is pinned to as separate facts', () => {
    renderWidget()
    expect(screen.getByRole('heading', { name: 'Summit' })).toBeInTheDocument()
    expect(screen.getByText('11,053 ft')).toBeInTheDocument()
    expect(screen.getByText('Panorama Gondola top station')).toBeInTheDocument()
  })

  it('shows current weather', () => {
    renderWidget()
    expect(screen.getByText('21°F')).toBeInTheDocument()
    expect(screen.getByText('Feels like 6°')).toBeInTheDocument()
    expect(screen.getByText('Clear')).toBeInTheDocument()
    expect(screen.getByText('No precipitation, 0% cloud cover')).toBeInTheDocument()
  })

  it('makes the current gust the hero number with its band in a word, and puts the sustained wind in the dial', () => {
    renderWidget()
    expect(screen.getByLabelText('Gusts 24 miles per hour')).toHaveClass('hero')
    expect(screen.getByRole('heading', { name: 'Gusts' })).toBeInTheDocument()
    expect(screen.getByText('Windy')).toBeInTheDocument()
    const dial = screen.getByRole('img', { name: 'Sustained wind 18 miles per hour from the southwest' })
    expect(dial).toHaveTextContent('18')
    expect(screen.getByText('From SW')).toBeInTheDocument()
    // The words "sustained" and the long band label are gone from the screen; the dial and the info dialog carry them.
    expect(screen.queryByText(/^Sustained/)).not.toBeInTheDocument()
    expect(screen.queryByText(/upper lifts may hold/)).not.toBeInTheDocument()
  })

  it('lists the next six hours with numbers, not color alone, with no key or peak line to read', () => {
    renderWidget()
    const hours = within(screen.getByRole('list', { name: 'Next 6 hours' })).getAllByRole('listitem')
    expect(hours).toHaveLength(6)
    expect(hours[0]).toHaveTextContent('10 PM: gusts 25 mph, sustained 18 mph, from the southwest. Windy.')
    expect(hours[0]).toHaveAttribute('data-band', 'windy')
    expect(screen.queryByText(/Large number is the gust/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Peak gust/)).not.toBeInTheDocument()
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
    const { onRefresh } = renderWidget({ forecast: null, error: 'NWS answered 500' })
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
    renderWidget({ forecast: windy, current: resolveCurrent(windy, {}) })
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /from the west$/ })).toBeInTheDocument()
    expect(screen.getByText('From W')).toBeInTheDocument()
  })

  it('puts the About this data link last, after the refresh row', () => {
    renderWidget()
    const about = screen.getByRole('button', { name: 'About this data' })
    const refresh = screen.getByRole('button', { name: 'Refresh' })
    expect(refresh.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(about.closest('footer')).not.toBeNull()
  })

  it('keeps the credits in the info dialog rather than on the panel', async () => {
    renderWidget()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('link', { name: 'National Weather Service' })).toHaveAttribute('href', 'https://www.weather.gov/')
    expect(within(dialog).getByRole('link', { name: 'OpenStreetMap contributors' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    )
  })

  describe('where the numbers come from', () => {
    const sesame = byId('sesame')
    const mccoy = byId('mccoy')

    it('shows the station reading and how old it is, and leads with the measured values', () => {
      renderWidget({ beacon: mccoy.beacon, forecast: mccoy, current: resolveCurrent(mccoy, at(mccoyStation)) })
      expect(sourceLine()).toHaveTextContent('Source: McCoy Station, 3 min ago')
      expect(screen.queryByText(/Measured at/)).not.toBeInTheDocument()
      expect(screen.getByLabelText('Gusts 9 miles per hour')).toBeInTheDocument()
      expect(screen.getByText('27°F')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Sustained wind 4 miles per hour from the northwest' })).toBeInTheDocument()
      expect(screen.getByText('From NW')).toBeInTheDocument()
      expect(screen.queryByText('Not from weather station.')).not.toBeInTheDocument()
    })

    it('marks the wind a station does not report as forecast, and lets the reading stand in for the gust\'s age', () => {
      renderWidget({ current: resolveCurrent(summit, at(summitStation)) })
      expect(screen.getByLabelText('Gusts 37 miles per hour')).toBeInTheDocument()
      // The gust is 100 minutes old against a 3-minute reading; only the reading's age is shown.
      expect(sourceLine()).toHaveTextContent('Source: Top Station, 3 min ago')
      expect(screen.queryByText(/Gust measured/)).not.toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Sustained wind 18 miles per hour from the southwest' })).toBeInTheDocument()
      expect(screen.getByText('Forecast')).toBeInTheDocument()
      // Sky is always the forecast's, so it is said once, in the info dialog.
      expect(screen.queryByText('Sky is from the forecast')).not.toBeInTheDocument()
    })

    it('labels the hourly strip with the forecast source', () => {
      renderWidget()
      expect(screen.getByText('NWS forecast')).toBeInTheDocument()
    })

    it('warns when the station has nothing fresh, in the widget and at the top of the info modal', async () => {
      renderWidget({ beacon: sesame.beacon, forecast: sesame, current: resolveCurrent(sesame, {}) })
      expect(screen.getByText('Not from weather station.')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
      const dialog = screen.getByRole('dialog', { name: 'About this data' })
      const text = dialog.textContent ?? ''
      expect(text.startsWith('Not from weather station.')).toBe(true)
      expect(dialog).toHaveTextContent(
        'Real time weather not available for this location. Current weather and the next hours are from the National Weather Service forecast. It covers the 2.5 km square around this point, so nearby points can show the same forecast. Ridge-top gusts and gusts on lift can run higher than forecast.',
      )
      expect(dialog).toHaveTextContent('Gust bands, a rough guide for riders:')
      expect(bandKeyRows(dialog)).toEqual([
        'Calm Under 20 mph',
        'Windy 20-39 mph, upper lifts may hold',
        'Strong 40 mph and up, expect upper-mountain holds',
      ])
    })

    it('does not cry wolf while a station point is still waiting for its readings', () => {
      renderWidget({ current: resolveCurrent(summit, undefined) })
      expect(screen.queryByText('Not from weather station.')).not.toBeInTheDocument()
      expect(screen.getByText('Checking the weather station…')).toBeInTheDocument()
    })

    it('calls fresh station readings real time, with no warning in the info modal', async () => {
      renderWidget({ beacon: mccoy.beacon, forecast: mccoy, current: resolveCurrent(mccoy, at(mccoyStation)) })
      await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent(
        'Current weather is real time. The forecast is from the National Weather Service. It covers the 2.5 km square around this point, so nearby points can show the same forecast. Ridge-top gusts and gusts on lift can run higher than forecast.',
      )
      expect(dialog).toHaveTextContent('Measured at McCoy Station (MTH20)')
      expect(dialog).not.toHaveTextContent('Not from weather station.')
      expect(bandKeyRows(dialog)[0]).toBe('Calm Under 20 mph')
    })

    it('lists what a partly reporting station leaves to the model', async () => {
      renderWidget({ current: resolveCurrent(summit, at(summitStation)) })
      await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
      expect(screen.getByRole('dialog')).toHaveTextContent(
        'Not measured at this station, so from the National Weather Service forecast: sustained wind, wind direction, sky, cloud cover and precipitation.',
      )
    })

    it('names both stations when the summit mixes Top Station with its backup, and what each one measured', async () => {
      const tower: Observation = { ...mccoyStation, stationId: 'MTH12', tempF: null, speedMph: 12, dirDeg: 250 }
      renderWidget({ current: resolveCurrent(summit, at(summitStation, tower)) })
      expect(sourceLine()).toHaveTextContent('Source: Top Station and Gondola 2 Tower 10, 3 min ago')
      expect(screen.getByRole('img', { name: 'Sustained wind 12 miles per hour from the west-southwest' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'About this data' }))
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent(
        'Measured at two stations, reported through the National Weather Service: temperature and gusts at Top Station (MTH03), sustained wind and wind direction at Gondola 2 Tower 10 (MTH12).',
      )
      expect(dialog).toHaveTextContent(
        'Not measured at these stations, so from the National Weather Service forecast: sky, cloud cover and precipitation.',
      )
    })

    it('describes an old reading by its age instead of calling it real time', async () => {
      const old = { ...mccoyStation, observedAt: new Date(fourMinLater - 75 * 60_000).toISOString() }
      renderWidget({ beacon: mccoy.beacon, forecast: mccoy, current: resolveCurrent(mccoy, at(old)) })
      expect(sourceLine()).toHaveTextContent('Source: McCoy Station, 1 hr ago')
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
