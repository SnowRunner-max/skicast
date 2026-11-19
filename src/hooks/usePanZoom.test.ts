import { describe, expect, it } from 'vitest'
import { fitView, toScreen } from './usePanZoom'

describe('fitView', () => {
  const size = { width: 400, height: 800 }
  const box = { x: 100, y: 50, width: 200, height: 100 }
  const none = { top: 0, right: 0, bottom: 0, left: 0 }

  it('scales the box to the limiting side and centres it', () => {
    const view = fitView(size, box, none)
    // Width limits: 400 / 200.
    expect(view.k).toBe(2)
    expect(toScreen(view, { x: box.x, y: box.y + box.height / 2 })).toEqual({ x: 0, y: 400 })
    expect(toScreen(view, { x: box.x + box.width, y: box.y + box.height / 2 })).toEqual({ x: 400, y: 400 })
  })

  it('centres in what the insets leave clear, so a bottom sheet never covers the framed box', () => {
    const view = fitView(size, box, { top: 60, right: 0, bottom: 340, left: 0 })
    const middle = toScreen(view, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    // Clear area runs from 60 to 460, so its middle is 260.
    expect(middle).toEqual({ x: 200, y: 260 })
  })

  it('never divides by a non-positive area when the insets eat the whole frame', () => {
    const view = fitView({ width: 100, height: 100 }, box, { top: 80, right: 80, bottom: 80, left: 80 })
    expect(Number.isFinite(view.k)).toBe(true)
    expect(view.k).toBeGreaterThan(0)
  })
})
