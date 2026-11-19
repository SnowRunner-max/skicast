import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  atRest,
  prefersReducedMotion,
  project,
  rubberband,
  SNAPPY,
  stepSpring,
  THROWN,
  type SpringParams,
  type SpringState,
} from '../lib/spring'
import { FORECAST_ROW_PX } from './MountainForecastBar'

export type Snap = 'peek' | 'half' | 'full'

/** The drag handle and the title row. Set as an inline height below, so CSS has no second copy to keep in step. */
export const HEADER_PX = 84
/**
 * At the peek stop the header shows and nothing else: the body starts exactly
 * at the fold, so no half-cut line shows under the title, whichever beacon is
 * open. The grabber already says the sheet pulls up.
 */
const PEEK_PX = HEADER_PX
/**
 * Room left above a fully open sheet: the 56px toolbar, the Mountain Forecast
 * row under it and its border, plus a strip of map so the sheet still looks
 * like a sheet. This assumes the toolbar is not pushed down by a top
 * safe-area inset, which holds in a browser tab; an installed, full-screen
 * build would need to add the inset here.
 */
const TOOLBAR_CLEARANCE_PX = 68 + FORECAST_ROW_PX
/**
 * The resting stop is 46% of the screen: enough for the title, any warning
 * about where the numbers come from and the temperature, while the map keeps
 * the larger half. The floor is the least those fit in; it only wins below
 * about 520px of height. Keep it low: a small phone's browser viewport is around 550px
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
  /** Called when the sheet picks a stop, with the height it will cover there. */
  onSettle: (visiblePx: number) => void
}

/** A finger wobbles a few pixels during a tap; under this it is still a tap on the handle. */
const DRAG_SLOP_PX = 6
/** Release speed is measured over this much of the drag's end. */
const VELOCITY_WINDOW_MS = 80
/**
 * How far a flick carries before the nearest stop is chosen. Stopping sooner
 * than a scroll view (0.998) keeps a slow drag from sailing past its stop,
 * while a quick flick from half still reaches full.
 */
const DECELERATION = 0.99
/** Released faster than this (px/s), the sheet was thrown, and settles with a little bounce. */
const FLICK_PX_S = 300
/**
 * Past the peek or full stop the sheet resists and never travels more than
 * this. The section is drawn this much taller than the full stop, hanging below
 * the screen, so a sheet pulled or bounced above full shows more of itself,
 * never a gap under it.
 */
const OVERDRAG_PX = 40

/**
 * The phone layout's widget container: a sheet over the map that rests half
 * open, drags up to full height and down to a peek at its title alone.
 *
 * It moves on a spring (lib/spring.ts), written straight to the DOM each frame
 * rather than through React state. A finger can catch it mid-flight and it
 * stops under the finger; on release it leaves at the finger's speed toward
 * the stop that speed would carry it to, so dragging and settling have no seam.
 */
export function BottomSheet({ header, children, onSettle }: Props) {
  const [viewport, setViewport] = useState(() => window.innerHeight)
  const [snap, setSnap] = useState<Snap>('half')
  /** True from the moment a press becomes a drag until it is let go. */
  const [dragging, setDragging] = useState(false)
  const heights = snapHeights(viewport)
  const settled = heights[snap]

  // innerHeight, not a CSS unit, because the stops are needed as numbers for
  // dragging. It tracks the visible viewport, so the stops follow a mobile
  // browser's toolbar as it shows and hides, and a turn of the phone.
  useEffect(() => {
    const onResize = () => setViewport(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    onSettle(settled)
  }, [settled, onSettle])

  const section = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  /** Height the sheet covers on screen right now (x, px) and how fast that is changing (v, px/s, positive opening). */
  const spring = useRef<SpringState>({ x: settled, v: 0 })
  /** Height the spring is heading for: a stop, or the finger while dragging. */
  const target = useRef(settled)
  /** The spring for the current settle: THROWN after a flick, SNAPPY otherwise. */
  const params = useRef<SpringParams>(SNAPPY)
  const frame = useRef(0)
  const drag = useRef<{
    pointerId: number
    startY: number
    /** Height the sheet covered when the finger came down. */
    from: number
    moving: boolean
    samples: { y: number; t: number }[]
  } | null>(null)
  /** The full stop, read by `paint`, which is created once. */
  const fullPx = useRef(heights.full)
  fullPx.current = heights.full

  const paint = () => {
    const { x } = spring.current
    if (section.current) section.current.style.transform = `translateY(${fullPx.current - x}px)`
    // The body is as tall as the part on screen, or as the stop it is heading
    // for if that is taller: it never shrinks ahead of a sheet still sliding
    // down (which would leave a blank strip), and once settled its scrolling
    // stays inside what is visible.
    if (body.current) body.current.style.height = `${Math.max(0, Math.max(x, target.current) - HEADER_PX)}px`
  }

  /** Runs the spring to `target` from wherever the sheet is now, at whatever speed it has. */
  const animate = useCallback(() => {
    cancelAnimationFrame(frame.current)
    if (prefersReducedMotion()) {
      spring.current = { x: target.current, v: 0 }
      paint()
      return
    }
    let last = performance.now()
    const tick = (now: number) => {
      // Capped so a frame after the tab was hidden does not jump the sheet.
      const dt = Math.min(Math.max(now - last, 0) / 1000, 1 / 30)
      last = now
      spring.current = stepSpring(spring.current, target.current, dt, params.current)
      const done = atRest(spring.current, target.current)
      if (done) spring.current = { x: target.current, v: 0 }
      paint()
      if (!done) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [])

  // The first frame is drawn in place; a new stop, or a resize that moves one, springs there.
  const placed = useRef(false)
  useLayoutEffect(() => {
    if (drag.current?.moving) return
    target.current = settled
    if (!placed.current) {
      placed.current = true
      spring.current = { x: settled, v: 0 }
      paint()
    } else {
      animate()
    }
  }, [settled, heights.full, animate])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  /** The browser can follow a drag with a click on the handle; that click must not toggle the sheet. */
  const suppressClick = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Every press starts clean. A drag's trailing click often lands on the
    // header rather than the handle, and a flag left set would swallow the
    // next real tap on the handle.
    suppressClick.current = false
    // Caught mid-flight, the sheet stops under the finger rather than finishing its trip first.
    cancelAnimationFrame(frame.current)
    spring.current = { x: spring.current.x, v: 0 }
    params.current = SNAPPY
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      from: spring.current.x,
      moving: false,
      samples: [{ y: e.clientY, t: e.timeStamp }],
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dy = e.clientY - d.startY
    if (!d.moving) {
      if (Math.abs(dy) < DRAG_SLOP_PX) return
      d.moving = true
      setDragging(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // The pointer was released between events; the drag just ends.
      }
    }
    d.samples.push({ y: e.clientY, t: e.timeStamp })
    while (d.samples.length > 2 && e.timeStamp - d.samples[0]!.t > VELOCITY_WINDOW_MS) d.samples.shift()

    // Follows the finger 1:1 between the stops, and resists past either end.
    const raw = d.from - dy
    const { peek, full } = heights
    const x =
      raw < peek ? peek - rubberband(peek - raw, OVERDRAG_PX) : raw > full ? full + rubberband(raw - full, OVERDRAG_PX) : raw
    spring.current = { x, v: 0 }
    target.current = x
    paint()
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    if (!d.moving) {
      // A tap: let a sheet it caught carry on to its stop. The handle's click does any toggling.
      animate()
      return
    }
    setDragging(false)
    suppressClick.current = true
    // Measured up to the release itself, so a finger that stopped before lifting throws nothing.
    const recent = [...d.samples, { y: e.clientY, t: e.timeStamp }].filter((s) => e.timeStamp - s.t <= VELOCITY_WINDOW_MS)
    const first = recent[0]!
    const last = recent[recent.length - 1]!
    const dt = last.t - first.t
    // Opening is positive, so a finger moving up gives a positive speed.
    const velocity = e.type === 'pointercancel' || dt <= 0 ? 0 : (-(last.y - first.y) / dt) * 1000
    // Choose the stop the throw would come to rest nearest, not the one nearest the release.
    const landing = spring.current.x + project(velocity, DECELERATION)
    const nearest = (Object.keys(heights) as Snap[]).reduce((best, s) =>
      Math.abs(heights[s] - landing) < Math.abs(heights[best] - landing) ? s : best,
    )
    params.current = Math.abs(velocity) > FLICK_PX_S ? THROWN : SNAPPY
    // The sheet leaves the finger at the finger's speed.
    spring.current = { x: spring.current.x, v: velocity }
    target.current = heights[nearest]
    animate()
    setSnap(nearest)
  }

  const onToggle = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setSnap((s) => (s === 'half' ? 'full' : 'half'))
  }, [])

  // At the peek stop the body is off screen; keep it out of the tab order too.
  // (React 18 has no `inert` prop, so it goes on as a plain attribute.)
  const inertWhenPeeking = snap === 'peek' && !dragging ? ({ inert: '' } as object) : {}

  return (
    // Fixed height, slid by a transform that `paint` sets each frame, so
    // moving never changes layout. React leaves `transform` and the body's
    // height alone: they are not in the style props below.
    <section
      ref={section}
      className="sheet"
      data-snap={snap}
      aria-label="Forecast"
      style={{ height: heights.full + OVERDRAG_PX, bottom: -OVERDRAG_PX }}
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
      <div ref={body} className="sheet-body" {...inertWhenPeeking}>
        {children}
      </div>
    </section>
  )
}
