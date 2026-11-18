import { BAND_SCALE_MAX_MPH, bandForGust, blowingToward, compassPoint, compassWord, WIND_BANDS } from './wind'

describe('bandForGust', () => {
  it.each([
    [0, 'calm'],
    [19.9, 'calm'],
    [20, 'windy'],
    [39.9, 'windy'],
    [40, 'strong'],
    [85, 'strong'],
  ])('%s mph is %s', (gust, id) => {
    expect(bandForGust(gust).id).toBe(id)
  })

  it('names each band in one word, with what it can mean for the lifts kept for the info dialog', () => {
    expect(WIND_BANDS.map((b) => [b.label, b.lifts])).toEqual([
      ['Calm', ''],
      ['Windy', 'upper lifts may hold'],
      ['Strong', 'expect upper-mountain holds'],
    ])
  })

  it('draws the meter to 60 mph, so the strong band is as wide as the windy one', () => {
    expect(BAND_SCALE_MAX_MPH).toBe(60)
  })
})

describe('compass', () => {
  it.each([
    [0, 'N', 'north'],
    [360, 'N', 'north'],
    [11, 'N', 'north'],
    [12, 'NNE', 'north-northeast'],
    [229, 'SW', 'southwest'],
    [270, 'W', 'west'],
    [348.75, 'N', 'north'],
    [-90, 'W', 'west'],
  ])('%s° is %s', (deg, point, word) => {
    expect(compassPoint(deg)).toBe(point)
    expect(compassWord(deg)).toBe(word)
  })

  it('wind from the west blows toward the east', () => {
    expect(blowingToward(270)).toBe(90)
    expect(blowingToward(10)).toBe(190)
  })
})
