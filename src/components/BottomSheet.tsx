import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export type Snap = 'peek' | 'half' | 'full'

const HEADER_PX = 84
const PEEK_PX = HEADER_PX + 8

export function snapHeights(viewportHeight: number): Record<Snap, number> {
  return {
    peek: PEEK_PX,
    half: Math.round(Math.min(Math.max(viewportHeight * 0.46, 300), 460)),
    full: Math.max(PEEK_PX, viewportHeight - 68),
  }
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
    d.visible = Math.min(heights.full, Math.max(PEEK_PX - 24, d.startVisible - dy))
    setDragPx(d.visible)
  }

  const onPointerEnd = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    // Carry a flick a little further, then settle on the nearest stop.
    const projected = d.visible - d.v * 140
    const nearest = (Object.keys(heights) as Snap[]).reduce((best, s) =>
      Math.abs(heights[s] - projected) < Math.abs(heights[best] - projected) ? s : best,
    )
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
    <section
      className="sheet"
      data-snap={snap}
      data-dragging={dragPx !== null}
      aria-label="Forecast"
      style={{ height: heights.full, transform: `translateY(${heights.full - visible}px)` }}
    >
      <div
        className="sheet-header"
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
