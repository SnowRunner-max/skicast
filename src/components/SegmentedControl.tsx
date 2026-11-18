import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { atRest, project, rubberband, SNAPPY, stepSpring, type SpringState } from '../lib/spring'

export interface Segment<T extends string> {
  value: T
  /** Spoken name; the segment itself shows only its icon. */
  label: string
  icon: ReactNode
}

interface Props<T extends string> {
  /** Names the group for screen readers: "Show". */
  label: string
  segments: readonly Segment<T>[]
  value: T
  onChange: (value: T) => void
}

/** A finger wobbles a few pixels during a tap; under this it is still a tap. */
const DRAG_SLOP_PX = 6
/** Release speed is measured over this much of the drag's end. */
const VELOCITY_WINDOW_MS = 80
/** A small control stops a flick sooner than a scroll view would. */
const DECELERATION = 0.99

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A segmented control in the iOS manner: icons on a track, with a thumb under
 * the chosen one. Tapping a segment sends the thumb there on a spring, from
 * wherever it is and at whatever speed it already has, so a second tap
 * mid-flight just turns it round. The thumb can also be dragged: it follows
 * the finger, resists past either end, and on release is carried on by the
 * finger's speed to the segment it would come to rest over.
 *
 * The value only changes when a tap lands or a drag is let go, never part way
 * through, so whatever it controls changes once.
 */
export function SegmentedControl<T extends string>({ label, segments, value, onChange }: Props<T>) {
  const track = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  const spring = useRef<SpringState>({ x: 0, v: 0 })
  const target = useRef(0)
  const frame = useRef(0)
  const index = Math.max(0, segments.findIndex((s) => s.value === value))
  /** Segment under a finger that is down but not dragging, for feedback on press rather than release. */
  const [pressed, setPressed] = useState<number | null>(null)
  /** While dragging, the segment the thumb is over: its icon lights before the finger lifts. */
  const [over, setOver] = useState<number | null>(null)
  const [grabbed, setGrabbed] = useState(false)

  const drag = useRef<{
    pointerId: number
    startX: number
    /** Thumb position when the finger came down. */
    from: number
    onThumb: boolean
    moving: boolean
    samples: { x: number; t: number }[]
  } | null>(null)
  /** The browser follows a drag with a click on whatever is under the finger; that click must not choose again. */
  const suppressClick = useRef(false)

  /** Width of one segment, read from the layout so CSS stays the one place it is set. */
  const segmentPx = () => track.current?.querySelector('button')?.offsetWidth || 44

  const paint = () => {
    if (thumb.current) thumb.current.style.transform = `translateX(${spring.current.x}px)`
  }

  /** Runs the spring to `target` from where the thumb is now. */
  const animate = useCallback(() => {
    cancelAnimationFrame(frame.current)
    if (reducedMotion()) {
      spring.current = { x: target.current, v: 0 }
      paint()
      return
    }
    let last = performance.now()
    const tick = (now: number) => {
      // Capped so a frame after the tab was hidden does not jump the thumb across.
      const dt = Math.min(Math.max(now - last, 0) / 1000, 1 / 30)
      last = now
      spring.current = stepSpring(spring.current, target.current, dt, SNAPPY)
      const done = atRest(spring.current, target.current)
      if (done) spring.current = { x: target.current, v: 0 }
      paint()
      // Not "while it is moving": it starts from rest, and the first frame can come with no time elapsed.
      if (!done) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [])

  // The first frame is already in place; only later changes move.
  const placed = useRef(false)
  useLayoutEffect(() => {
    target.current = index * segmentPx()
    if (!placed.current) {
      placed.current = true
      spring.current = { x: target.current, v: 0 }
      paint()
    } else if (!drag.current?.moving) {
      animate()
    }
  }, [index, animate])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const segmentAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect()
    const i = Math.floor((clientX - rect.left) / segmentPx())
    return Math.min(segments.length - 1, Math.max(0, i))
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    suppressClick.current = false
    const rect = track.current!.getBoundingClientRect()
    const local = e.clientX - rect.left
    const w = segmentPx()
    const onThumb = local >= spring.current.x && local <= spring.current.x + w
    if (onThumb) {
      // Caught mid-flight, it stops under the finger rather than finishing its trip first.
      cancelAnimationFrame(frame.current)
      spring.current = { x: spring.current.x, v: 0 }
      setGrabbed(true)
    }
    setPressed(segmentAt(e.clientX))
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      from: spring.current.x,
      onThumb,
      moving: false,
      samples: [{ x: e.clientX, t: e.timeStamp }],
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    if (!d.moving) {
      if (!d.onThumb || Math.abs(dx) < DRAG_SLOP_PX) return
      d.moving = true
      setPressed(null)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // The pointer was released between events; the drag just ends.
      }
    }
    d.samples.push({ x: e.clientX, t: e.timeStamp })
    while (d.samples.length > 2 && e.timeStamp - d.samples[0]!.t > VELOCITY_WINDOW_MS) d.samples.shift()

    const w = segmentPx()
    const max = (segments.length - 1) * w
    const x = d.from + dx
    spring.current = {
      x: x < 0 ? -rubberband(-x, w) : x > max ? max + rubberband(x - max, w) : x,
      v: 0,
    }
    paint()
    const near = Math.min(segments.length - 1, Math.max(0, Math.round(spring.current.x / w)))
    setOver((o) => (o === near ? o : near))
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    setPressed(null)
    setGrabbed(false)
    setOver(null)
    if (!d.moving) {
      // A tap on the thumb that held it still: let it finish where it was going. A tap's click does the choosing.
      if (d.onThumb) animate()
      return
    }
    suppressClick.current = true
    // Measured up to the release itself, so a finger that stopped before lifting throws nothing.
    const recent = [...d.samples, { x: e.clientX, t: e.timeStamp }].filter((s) => e.timeStamp - s.t <= VELOCITY_WINDOW_MS)
    const first = recent[0]!
    const last = recent[recent.length - 1]!
    const dt = last.t - first.t
    const velocity = e.type === 'pointercancel' || dt <= 0 ? 0 : ((last.x - first.x) / dt) * 1000
    const w = segmentPx()
    const landing = spring.current.x + project(velocity, DECELERATION)
    const i = Math.min(segments.length - 1, Math.max(0, Math.round(landing / w)))
    // The thumb leaves the finger at the finger's speed, so there is no seam between dragging and settling.
    spring.current = { x: spring.current.x, v: velocity }
    target.current = i * w
    animate()
    if (i !== index) onChange(segments[i]!.value)
  }

  const lit = over ?? index

  return (
    <div
      ref={track}
      className="segmented"
      role="group"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <span ref={thumb} className="segmented-thumb" data-grabbed={grabbed || undefined} aria-hidden="true" />
      {segments.map((segment, i) => (
        <button
          key={segment.value}
          type="button"
          aria-label={segment.label}
          aria-pressed={i === index}
          data-lit={i === lit || undefined}
          data-pressed={i === pressed || undefined}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false
              return
            }
            if (i !== index) onChange(segment.value)
          }}
        >
          {segment.icon}
        </button>
      ))}
    </div>
  )
}
