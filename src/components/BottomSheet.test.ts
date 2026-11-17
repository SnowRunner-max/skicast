import { describe, expect, it } from 'vitest'
import { snapHeights } from './BottomSheet'

describe('snapHeights', () => {
  // Browser viewport heights, not screen heights: a phone's own toolbars take 100px or more.
  const phones = [331, 548, 568, 664, 740, 780, 915]

  it.each(phones)('orders the stops peek < half <= full at %ipx', (h) => {
    const { peek, half, full } = snapHeights(h)
    expect(peek).toBeLessThan(half)
    expect(half).toBeLessThanOrEqual(full)
  })

  it('rests at 46% of the screen on an ordinary phone', () => {
    expect(snapHeights(664).half).toBe(305)
  })

  it('leaves a small phone more map than sheet', () => {
    const h = 548
    expect(snapHeights(h).half).toBeLessThan(h / 2)
  })

  it('never opens further than the space under the toolbar', () => {
    // A phone on its side, should the sheet layout ever be used there.
    const { half, full } = snapHeights(300)
    expect(half).toBe(full)
  })

  it('stops growing on a tall tablet', () => {
    expect(snapHeights(1366).half).toBe(460)
  })
})
