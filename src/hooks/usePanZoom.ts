import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** screen = map * k + (x, y) */
export interface View {
  k: number
  x: number
  y: number
}
export interface Box {
  x: number
  y: number
  width: number
  height: number
}
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}
export interface Size {
  width: number
  height: number
}

const DRAG_THRESHOLD_PX = 5
/** At this scale one screen pixel is about one metre on the Mammoth map. */
const MAX_SCALE = 6

/** Where a point in map units lands on screen under `view`. */
export function toScreen(view: View, p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x * view.k + view.x, y: p.y * view.k + view.y }
}

/** The view that centres `box` in what is left of `size` once `insets` are kept clear, as large as it will go. */
export function fitView(size: Size, box: Box, insets: Insets): View {
  const w = Math.max(1, size.width - insets.left - insets.right)
  const h = Math.max(1, size.height - insets.top - insets.bottom)
  const k = Math.min(w / box.width, h / box.height)
  return {
    k,
    x: insets.left + (w - box.width * k) / 2 - box.x * k,
    y: insets.top + (h - box.height * k) / 2 - box.y * k,
  }
}

interface Options {
  /** What the map frames on load and on reset. */
  fitBox: Box
  /** Screen-space padding kept clear around fitBox (labels, the bottom sheet). */
  insets: Insets
  /** The whole map; panning keeps part of it on screen. */
  bounds: Box
}

/**
 * A small pan-zoom helper for the lift map: drag to pan, pinch or scroll to
 * zoom, double-click to zoom in. Returns a transform; the caller decides how to
 * draw with it, so markers and labels can stay a constant size.
 */
export function usePanZoom({ fitBox, insets, bounds }: Options) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const [view, setView] = useState<View | null>(null)
  /** True once the reader has panned or zoomed. From then on the map is theirs and is not re-framed for them. */
  const touched = useRef(false)

  // The gesture callbacks below are created once, so they read the current
  // size and limits through this ref rather than closing over stale values.
  const limits = useRef({ minK: 0.05, size, bounds })
  limits.current = {
    // Zooming out stops a little past whichever is smaller: the whole map, or the framed view.
    minK: size.width > 0 ? Math.min(fitView(size, bounds, NO_INSETS).k, fitView(size, fitBox, insets).k) * 0.85 : 0.05,
    size,
    bounds,
  }

  const clamp = useCallback((v: View): View => {
    const { minK, size: s, bounds: b } = limits.current
    const k = Math.min(MAX_SCALE, Math.max(minK, v.k))
    // Keep at least a strip of the map on screen.
    const keep = Math.min(120, s.width / 3, s.height / 3)
    const x = Math.min(s.width - keep - b.x * k, Math.max(keep - (b.x + b.width) * k, v.x))
    const y = Math.min(s.height - keep - b.y * k, Math.max(keep - (b.y + b.height) * k, v.y))
    return { k, x, y }
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    if (typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The box and insets are taken apart into numbers so callers can pass fresh
  // object literals on every render without the framing running again.
  const { x: fx, y: fy, width: fw, height: fh } = fitBox
  const { top, right, bottom, left } = insets
  const home = useCallback(
    (s: Size) => fitView(s, { x: fx, y: fy, width: fw, height: fh }, { top, right, bottom, left }),
    [fx, fy, fw, fh, top, right, bottom, left],
  )

  /** Middle of the part of the frame the insets leave clear, as of the last layout. */
  const lastCentre = useRef<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    if (size.width === 0 || size.height === 0) return
    const centre = { x: (left + size.width - right) / 2, y: (top + size.height - bottom) / 2 }
    const prev = lastCentre.current
    lastCentre.current = centre
    // Frame the map until the reader moves it themselves.
    if (!touched.current) {
      setView(home(size))
      return
    }
    // After that the scale is theirs, but the frame can still change under
    // them: a phone turned on its side, the sheet dropped to its peek stop.
    // Whatever was in the middle of the clear area stays in the middle of the
    // new one. Measuring from the clear area rather than the frame matters:
    // over a sheet, the frame's own middle is hidden behind the sheet.
    if (prev && (prev.x !== centre.x || prev.y !== centre.y)) {
      const dx = centre.x - prev.x
      const dy = centre.y - prev.y
      setView((v) => (v ? clamp({ ...v, x: v.x + dx, y: v.y + dy }) : v))
    }
  }, [size, home, clamp, top, right, bottom, left])

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      touched.current = true
      setView((v) => {
        if (!v) return v
        // Clamp the scale before working out the offset: the point under the
        // cursor only stays put if the offset uses the scale actually applied.
        const k = Math.min(MAX_SCALE, Math.max(limits.current.minK, v.k * factor))
        const ratio = k / v.k
        return clamp({ k, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio })
      })
    },
    [clamp],
  )

  const panBy = useCallback(
    (dx: number, dy: number) => {
      touched.current = true
      setView((v) => (v ? clamp({ ...v, x: v.x + dx, y: v.y + dy }) : v))
    },
    [clamp],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const s = limits.current.size
      zoomAt(factor, s.width / 2, s.height / 2)
    },
    [zoomAt],
  )

  const reset = useCallback(() => {
    touched.current = false
    const s = limits.current.size
    if (s.width > 0) setView(home(s))
  }, [home])

  // ---- Pointer gestures ----
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef({ startX: 0, startY: 0, dragging: false, suppressClick: false })

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = ref.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  /** Keeps a drag alive when the pointer leaves the map. Fails harmlessly if the pointer is already gone. */
  const capture = (pointerId: number) => {
    try {
      ref.current?.setPointerCapture(pointerId)
    } catch {
      // The pointer was released between events; the gesture just ends.
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 1) {
      gesture.current = { startX: p.x, startY: p.y, dragging: false, suppressClick: false }
    } else {
      // A second finger: this is a pinch, never a tap.
      gesture.current.dragging = true
      gesture.current.suppressClick = true
      for (const id of pointers.current.keys()) capture(id)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const p = local(e)
    const g = gesture.current

    if (pointers.current.size === 1) {
      if (!g.dragging && Math.hypot(p.x - g.startX, p.y - g.startY) > DRAG_THRESHOLD_PX) {
        g.dragging = true
        g.suppressClick = true
        capture(e.pointerId)
      }
      pointers.current.set(e.pointerId, p)
      if (g.dragging) panBy(p.x - prev.x, p.y - prev.y)
      return
    }

    const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1]
    pointers.current.set(e.pointerId, p)
    if (!other) return
    // Pinch: the midpoint between the fingers moves by half of this finger's
    // movement, and the scale changes by how much the gap between them grew.
    const before = Math.hypot(prev.x - other.x, prev.y - other.y)
    const after = Math.hypot(p.x - other.x, p.y - other.y)
    const midX = (p.x + other.x) / 2
    const midY = (p.y + other.y) / 2
    panBy((p.x - prev.x) / 2, (p.y - prev.y) / 2)
    if (before > 0 && after > 0) zoomAt(after / before, midX, midY)
  }

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) gesture.current.dragging = false
  }

  /** A drag that ends over a beacon must not select it. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (gesture.current.suppressClick) {
      gesture.current.suppressClick = false
      e.stopPropagation()
      e.preventDefault()
    }
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('button, a')) return
    const p = local(e)
    zoomAt(1.8, p.x, p.y)
  }

  // Wheel needs a non-passive listener so the page does not scroll or zoom under the map.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      // ctrlKey marks a trackpad pinch, which reports small deltas.
      const speed = e.ctrlKey ? 0.012 : 0.0022
      zoomAt(Math.exp(-e.deltaY * speed), e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  return {
    ref,
    size,
    view,
    zoomBy,
    reset,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
      onDoubleClick,
    },
  }
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
