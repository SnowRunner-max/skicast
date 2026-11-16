import { agoLabel, hourLabel } from './time'

describe('hourLabel', () => {
  it.each([
    ['2026-11-15T00:00', '12 AM'],
    ['2026-11-15T09:00', '9 AM'],
    ['2026-11-15T12:00', '12 PM'],
    ['2026-11-15T15:00', '3 PM'],
    ['2026-11-15T23:00', '11 PM'],
  ])('%s is %s', (iso, label) => {
    expect(hourLabel(iso)).toBe(label)
  })
})

describe('agoLabel', () => {
  const at = '2026-11-15T20:00:00.000Z'
  const ms = Date.parse(at)
  it.each([
    [20_000, 'just now'],
    [4 * 60_000 + 30_000, '4 min ago'],
    [59 * 60_000, '59 min ago'],
    [3 * 3_600_000, '3 hr ago'],
    [26 * 3_600_000, '1 day ago'],
  ])('%s ms later reads %s', (delta, label) => {
    expect(agoLabel(at, ms + delta)).toBe(label)
  })
})
