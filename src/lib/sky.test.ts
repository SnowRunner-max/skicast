import { skyLabel } from './sky'

const none = [{ coverage: null, weather: null, intensity: null }]

describe('skyLabel', () => {
  it('names the cloud cover in NWS terms when no weather is forecast', () => {
    expect(skyLabel(none, 5)).toBe('Clear')
    expect(skyLabel(none, 30)).toBe('Mostly clear')
    expect(skyLabel(none, 50)).toBe('Partly cloudy')
    expect(skyLabel(none, 72)).toBe('Mostly cloudy')
    expect(skyLabel([], 95)).toBe('Cloudy')
  })

  it('puts the weather in a sentence with its likelihood and intensity', () => {
    expect(skyLabel([{ coverage: 'chance', weather: 'snow', intensity: 'light' }], 80)).toBe('Chance of light snow')
    expect(skyLabel([{ coverage: 'likely', weather: 'snow_showers', intensity: null }], 80)).toBe('Snow showers likely')
    expect(skyLabel([{ coverage: 'definite', weather: 'snow', intensity: 'heavy' }], 100)).toBe('Heavy snow')
    expect(skyLabel([{ coverage: 'areas', weather: 'freezing_fog', intensity: null }], 100)).toBe('Areas of freezing fog')
  })

  it('leads with the first weather named', () => {
    expect(
      skyLabel(
        [
          { coverage: 'scattered', weather: 'snow_showers', intensity: 'light' },
          { coverage: 'isolated', weather: 'thunderstorms', intensity: null },
        ],
        60,
      ),
    ).toBe('Scattered light snow showers')
  })
})
