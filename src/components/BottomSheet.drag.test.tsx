import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomSheet } from './BottomSheet'

/** The sheet's drag and tap handling. Its stop heights are covered in BottomSheet.test.ts. */
function renderSheet() {
  const onSettle = vi.fn()
  render(
    <BottomSheet header={() => <h2>Summit</h2>} onSettle={onSettle}>
      <p>Body</p>
    </BottomSheet>,
  )
  const header = screen.getByRole('heading', { name: 'Summit' }).parentElement!
  const handle = () => screen.getByRole('button', { name: /forecast panel/ })
  const snap = () => screen.getByRole('region', { name: 'Forecast' }).dataset.snap
  return { header, handle, snap, onSettle }
}

/** A slow vertical drag on the header from y=600 by `dy`, ending with no click, as when the finger lifts off the handle. */
function drag(header: HTMLElement, dy: number) {
  fireEvent.pointerDown(header, { pointerId: 1, clientY: 600, button: 0 })
  for (let i = 1; i <= 10; i++) fireEvent.pointerMove(header, { pointerId: 1, clientY: 600 + (dy * i) / 10 })
  fireEvent.pointerUp(header, { pointerId: 1, clientY: 600 + dy })
}

describe('BottomSheet', () => {
  it('rests half open and toggles to full on a tap of the handle', () => {
    const { handle, snap } = renderSheet()
    expect(snap()).toBe('half')
    fireEvent.click(handle())
    expect(snap()).toBe('full')
    expect(handle()).toHaveAttribute('aria-expanded', 'true')
  })

  it('settles on the stop nearest where a drag is let go', () => {
    const { header, snap, onSettle } = renderSheet()
    drag(header, 400)
    expect(snap()).toBe('peek')
    expect(onSettle).toHaveBeenLastCalledWith(84)
  })

  it('still answers a tap on the handle after a drag that ended without a click', () => {
    const { header, handle, snap } = renderSheet()
    drag(header, 400)
    expect(snap()).toBe('peek')
    fireEvent.pointerDown(handle(), { pointerId: 2, clientY: 600, button: 0 })
    fireEvent.pointerUp(handle(), { pointerId: 2, clientY: 600 })
    fireEvent.click(handle())
    expect(snap()).toBe('half')
  })

  it('ignores the click a browser sends at the end of a drag over the handle', () => {
    const { header, handle, snap } = renderSheet()
    drag(header, 400)
    fireEvent.click(handle())
    expect(snap()).toBe('peek')
  })

  it('keeps the body out of the tab order at the peek stop', () => {
    const { header } = renderSheet()
    const body = screen.getByText('Body').parentElement!
    expect(body).not.toHaveAttribute('inert')
    drag(header, 400)
    expect(body).toHaveAttribute('inert')
  })
})
