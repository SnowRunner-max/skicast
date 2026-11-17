import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { FORECAST_ROW_PX } from './MountainForecastBar'

export type Snap = 'peek' | 'half' | 'full'

/** The drag handle and the title row. Set as an inline height below, so CSS has no second copy to keep in step. */
const HEADER_PX = 84
/** At the peek stop the header shows, with a sliver of the body so the sheet reads as something to pull up. */
const PEEK_PX = HEADER_PX + 8
/**
 * Room left above a fully open sheet: the 56px toolbar, the Mountain Forecast
 * row under it and its border, plus a strip of map so the sheet still looks
 * like a sheet. This assumes the toolbar is not pushed down by a top
 * safe-area inset, which holds in a browser tab; an installed, full-screen
 * build would need to add the inset here.
 */
const TOOLBAR_CLEARANCE_PX = 68 + FORECAST_ROW_PX
/**
 * The resting stop is 46% of the screen: enough for the title, where the
 * numbers come from and the temperature, while the map keeps the larger half.
 * The floor is the least those three fit in; it only wins below about 520px
 * of height. Keep it low: a small phone's browser viewport is around 550px
 * tall (an iPhone SE in Safari), and every pixel of floor above 46% comes
 * straight out of a map that is already a thin strip there.
 * The ceiling stops a tall tablet from opening a mostly empty sheet.
 */
const HALF_FRACTION = 0.46
const HALF_MIN_PX = 240
const HALF_MAX_PX = 460

/**
 * How much of the screen the sheet covers at each stop. Exported because App
 * needs the half height before the sheet has mounted, to frame the map above it.
 */
export function snapHeights(viewportHeight: number): Record<Snap, number> {
  const full = Math.max(PEEK_PX, viewportHeight - TOOLBAR_CLEARANCE_PX)
  const half = Math.min(Math.max(viewportHeight * HALF_FRACTION, HALF_MIN_PX), HALF_MAX_PX, full)
  return { peek: PEEK_PX, half: Math.round(half), full }
}

interface Props {
  /** Title row; always visible, and the handle for dragging. */
  header: (snap: Snap) => ReactNode
  children: ReactNode
  /** Called when the sheet settles, with the height it covers. */
  onSettle: (visiblePx: number) => void
}

/**
 * The phone layout's widget container: a sheet over the map that rests half
 * open, drags up to full height and down to a one-line peek.
 */
export function BottomSheet({ header, children, onSettle }: Props) {
  const [viewport, setViewport] = useState(() => window.innerHeight)
  const [snap, setSnap] = useState<Snap>('half')
  const [dragPx, setDragPx] = useState<number | null>(null)
  const heights = snapHeights(viewport)
  const visible = dragPx ?? heights[snap]

  // innerHeight, not a CSS unit, because the stops are needed as numbers for
  // dragging. It tracks the visible viewport, so the stops follow a mobile
  // browser's toolbar as it shows and hides, and a turn of the phone.
  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const settled = heights[snap]
  useEffect(() => {
    onSettle(settled)
  }, [settled, onSettle])

  const drag = useRef<{
    startY: number
    startVisible: number
    /** Height the sheet covers right now; kept here so pointer-up never reads stale state. */
    visible: number
    moved: boolean
    lastY: number
    lastT: number
    /** Finger speed in px/ms, positive downward. */
    v: number
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = {
      startY: e.clientY,
      startVisible: heights[snap],
      visible: heights[snap],
      moved: false,
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.startY
    if (!d.moved) {
      // A finger wobbles a few pixels during a tap; under this it is still a tap on the handle.
      if (Math.abs(dy) < 6) return
      d.moved = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // The pointer was released between events; the drag just ends.
      }
    }
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    // The sheet can be dragged a little below the peek stop, so it feels held rather than stuck, and springs back.
    d.visible = Math.min(heights.full, Math.max(PEEK_PX - 24, d.startVisible - dy))
    setDragPx(d.visible)
  }

  const onPointerEnd = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    // Carry a flick a little further, then settle on the nearest stop: where
    // the sheet would be 140ms on at the finger's last speed. That is enough
    // for a quick flick from half to reach full without a slow drag overshooting.
    const projected = d.visible - d.v * 140
    const nearest = (Object.keys(heights) as Snap[]).reduce((best, s) =>
      Math.abs(heights[s] - projected) < Math.abs(heights[best] - projected) ? s : best,
    )
    // The browser follows a drag that ends on the handle with a click; that click must not toggle the sheet.
    suppressClick.current = true
    setSnap(nearest)
    setDragPx(null)
  }

  const suppressClick = useRef(false)
  const onToggle = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setSnap((s) => (s === 'half' ? 'full' : 'half'))
  }, [])

  // At the peek stop the body is off screen; keep it out of the tab order too.
  // (React 18 has no `inert` prop, so it goes on as a plain attribute.)
  const inertWhenPeeking = snap === 'peek' && dragPx === null ? ({ inert: '' } as object) : {}

  return (
    // Always full height and slid down by a transform, so dragging never
    // changes layout: only the body's height follows, to keep its scrolling
    // inside the part that is on screen.
    <section
      className="sheet"
      data-snap={snap}
      data-dragging={dragPx !== null}
      aria-label="Forecast"
      style={{ height: heights.full, transform: `translateY(${heights.full - visible}px)` }}
    >
      <div
        className="sheet-header"
        style={{ height: HEADER_PX }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <button
          type="button"
          className="sheet-handle"
          aria-expanded={snap === 'full'}
          aria-label={snap === 'full' ? 'Shrink the forecast panel' : 'Expand the forecast panel'}
          onClick={onToggle}
        >
          <span aria-hidden="true" />
        </button>
        {header(snap)}
      </div>
      <div className="sheet-body" style={{ height: Math.max(0, visible - HEADER_PX) }} {...inertWhenPeeking}>
        {children}
      </div>
    </section>
  )
}
