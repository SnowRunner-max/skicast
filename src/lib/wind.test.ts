import { bandForGust, blowingToward, compassPoint, compassWord, peakGust, WIND_BANDS } from './wind'
import type { WindHour } from '../types'

const hour = (time: string, gustMph: number): WindHour => ({ time, gustMph, speedMph: gustMph / 2, dirDeg: 270 })

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

  it('uses the labels from the plan', () => {
    expect(WIND_BANDS.map((b) => b.label)).toEqual([
      'Calm',
      'Windy, upper lifts may hold',
      'Strong, expect upper-mountain holds',
    ])
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

describe('peakGust', () => {
  it('finds the highest gust', () => {
    const peak = peakGust([hour('2026-11-15T13:00', 31), hour('2026-11-15T15:00', 52), hour('2026-11-15T16:00', 44)])
    expect(peak?.time).toBe('2026-11-15T15:00')
  })

  it('keeps the earliest hour on a tie', () => {
    expect(peakGust([hour('a', 30), hour('b', 30)])?.time).toBe('a')
  })

  it('returns null for no hours', () => {
    expect(peakGust([])).toBeNull()
  })
})
