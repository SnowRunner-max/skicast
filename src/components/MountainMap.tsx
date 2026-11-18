import { memo, useMemo } from 'react'
import { BEACONS, beaconPoint } from '../data/beacons'
import { MAP, type MapLift } from '../data/mapPaths'
import type { Layout } from '../hooks/useLayout'
import { toScreen, usePanZoom, type Box, type Insets, type View } from '../hooks/usePanZoom'
import type { Current } from '../lib/current'
import { Beacon } from './Beacon'

interface Props {
  /** Resolved current values by beacon id, or null before the first forecast arrives. */
  currents: Record<string, Current> | null
  selectedId: string
  onSelect: (id: string) => void
  layout: Layout
  /** Height in pixels the bottom sheet covers, in the sheet layout; 0 otherwise. */
  sheetPx: number
}

const VIEW_BOX: Box = { x: 0, y: 0, width: MAP.viewBox.width, height: MAP.viewBox.height }

/** The viewBox carries generous padding; the desktop frame trims some of it so the lifts read larger. */
const TRIM = 36
const LIFTS_BOX: Box = { x: TRIM, y: TRIM, width: VIEW_BOX.width - 2 * TRIM, height: VIEW_BOX.height - 2 * TRIM }

const BEACON_POINTS = BEACONS.map((beacon) => ({ beacon, point: beaconPoint(beacon) }))

/** The beacons' bounding box, in map units. */
const BEACON_BOX: Box = (() => {
  const xs = BEACON_POINTS.map((p) => p.point.x)
  const ys = BEACON_POINTS.map((p) => p.point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
})()

/** Lifts and contours never change, so they render once and are moved by a transform. */
const StaticLayer = memo(function StaticLayer() {
  return (
    <>
      <g className="map-contours">
        {MAP.contours.map((contour, i) => (
          <path key={i} d={contour.d} data-index={contour.index || undefined} />
        ))}
      </g>
      <g className="map-lifts">
        {MAP.lifts.map((lift) => (
          <path key={lift.id} d={lift.d} data-kind={lift.kind} />
        ))}
      </g>
    </>
  )
})

interface PlacedLabel {
  lift: MapLift
  x: number
  y: number
  angle: number
}

/** Average glyph width of the 11.5px label text (.map-labels in index.css), for estimating a name's length without measuring it. */
const LABEL_CHAR_PX = 6.1
/** Two names closer than this, centre line to centre line, would touch. */
const LABEL_CLEARANCE_PX = 12

/**
 * Lifts that carry a name, in the order they get to claim space: the gondola
 * first, then longest line first, so the names a rider navigates by win when
 * there is not room for all of them. The order never changes, so it is worked
 * out once here rather than on every pan frame.
 */
const LABELLED_LIFTS = MAP.lifts
  .filter((lift) => lift.label)
  .map((lift) => ({ lift, len: Math.hypot(lift.x2 - lift.x1, lift.y2 - lift.y1) }))
  .sort((a, b) => Number(b.lift.kind === 'gondola') - Number(a.lift.kind === 'gondola') || b.len - a.len)

/**
 * Lift names sit along their lines at a constant size. A name is drawn only
 * when its line is long enough on screen and it would not run into a beacon or
 * another name, so more names appear as you zoom in.
 */
function placeLabels(view: View, obstacles: Box[]): PlacedLabel[] {
  const taken: { x: number; y: number }[] = []
  const placed: PlacedLabel[] = []

  for (const { lift, len } of LABELLED_LIFTS) {
    const textWidth = lift.label!.length * LABEL_CHAR_PX
    // The name has to fit on its own line with a little to spare at each end.
    if (len * view.k < textWidth + 18) continue

    const { x: x1, y: y1 } = toScreen(view, { x: lift.x1, y: lift.y1 })
    const { x: x2, y: y2 } = toScreen(view, { x: lift.x2, y: lift.y2 })
    // Text runs along the line, flipped where needed so it never reads upside down.
    let angle = Math.atan2(y2 - y1, x2 - x1)
    if (angle > Math.PI / 2) angle -= Math.PI
    if (angle < -Math.PI / 2) angle += Math.PI
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    // Baseline sits 5px off the line; collisions are checked along the text's middle.
    const x = (x1 + x2) / 2 + sin * 5
    const y = (y1 + y2) / 2 - cos * 5
    const cx = x + sin * 4
    const cy = y - cos * 4

    const samples: { x: number; y: number }[] = []
    for (let t = -textWidth / 2; t <= textWidth / 2; t += 8) samples.push({ x: cx + cos * t, y: cy + sin * t })

    const blocked = samples.some(
      (s) =>
        taken.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < LABEL_CLEARANCE_PX) ||
        obstacles.some((o) => s.x > o.x && s.x < o.x + o.width && s.y > o.y && s.y < o.y + o.height),
    )
    if (blocked) continue
    taken.push(...samples)
    placed.push({ lift, x, y, angle: (angle * 180) / Math.PI })
  }
  return placed
}

/**
 * Screen-space boxes a beacon and its label cover, for keeping lift names
 * clear of them. The label boxes are a generous fixed size (the longest short
 * name with its gust above it) rather than measured, so this stays a pure
 * function of the view. If .beacon-label's type size changes in index.css,
 * these want another look.
 */
function beaconObstacles(x: number, y: number, side: 'left' | 'right' | 'below'): Box[] {
  const mark = { x: x - 20, y: y - 20, width: 40, height: 40 }
  if (side === 'below') return [mark, { x: x - 34, y: y + 16, width: 68, height: 42 }]
  if (side === 'left') return [mark, { x: x - 90, y: y - 20, width: 72, height: 40 }]
  return [mark, { x: x + 18, y: y - 20, width: 72, height: 40 }]
}

/**
 * Screen-space room kept clear around what the map frames, so nothing drawn
 * over the map covers a beacon. The numbers follow from the overlays:
 *
 *  - Map controls are 44px buttons 10px in from the edge: a row along the top
 *    over a sheet, a column down the right-hand edge beside a card.
 *  - A beacon is a 44px tap target centred on its station. Its label reaches
 *    about 72px to one side, or about 34px below (see beaconObstacles).
 */
function insetsFor(layout: Layout, sheetPx: number): Insets {
  switch (layout) {
    case 'sheet':
      return {
        top: 78, // the controls row (10 + 44) and half a beacon below it
        right: 44, // the right-most beacon's label sits below it, so only half that label
        bottom: sheetPx + 56, // the sheet, then a label below the lowest beacon
        left: 78, // a label to the left of the left-most beacon
      }
    case 'split':
      return {
        top: 34, // half a beacon and its selection ring
        right: 98, // as above, plus the controls column (10 + 44)
        bottom: 56,
        left: 78,
      }
    case 'wide':
      // Framing every lift leaves the beacons well inside the frame; this only keeps lines off the border.
      return { top: 16, right: 16, bottom: 16, left: 64 }
  }
}

export function MountainMap({ currents, selectedId, onSelect, layout, sheetPx }: Props) {
  const { ref, size, view, zoomBy, reset, handlers } = usePanZoom({
    // Small screens frame the beacons, which are the point of the page; a
    // desktop has room for the whole lift network around them.
    fitBox: layout === 'wide' ? LIFTS_BOX : BEACON_BOX,
    insets: insetsFor(layout, sheetPx),
    bounds: VIEW_BOX,
  })

  // Beacons are positioned in screen pixels, outside the scaled SVG group, so
  // they stay the same size (and stay tappable) at every zoom level.
  const beacons = useMemo(
    () => (view ? BEACON_POINTS.map(({ beacon, point }) => ({ beacon, ...toScreen(view, point) })) : []),
    [view],
  )

  const labels = useMemo(
    () =>
      view
        ? placeLabels(
            view,
            beacons.flatMap((b) => beaconObstacles(b.x, b.y, b.beacon.labelSide)),
          )
        : [],
    [view, beacons],
  )

  return (
    <div className="map" ref={ref} {...handlers}>
      {view && (
        <svg
          className="map-svg"
          width={size.width}
          height={size.height}
          role="img"
          aria-label="Lift map of Mammoth Mountain seen from town, with the summit at the top"
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <StaticLayer />
          </g>
          <g className="map-terminals" aria-hidden="true">
            {MAP.stations.map((s) => {
              const { x, y } = toScreen(view, s)
              return <circle key={s.osmId} cx={x} cy={y} r={view.k > 1.2 ? 3 : 2.2} />
            })}
          </g>
          <g className="map-labels" aria-hidden="true">
            {labels.map(({ lift, x, y, angle }) => (
              <text key={lift.id} x={x} y={y} transform={`rotate(${angle} ${x} ${y})`} textAnchor="middle">
                {lift.label}
              </text>
            ))}
          </g>
        </svg>
      )}

      <div className="map-beacons">
        {beacons.map(({ beacon, x, y }) => (
          <Beacon
            key={beacon.id}
            beacon={beacon}
            current={currents?.[beacon.id] ?? null}
            selected={beacon.id === selectedId}
            x={x}
            y={y}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="map-north" aria-label="North is toward the bottom of the map" role="img">
        <svg width="34" height="34" viewBox="-17 -17 34 34" aria-hidden="true">
          <g transform={`rotate(${MAP.northAngle})`}>
            <path d="M0 8V-9M-4 -5 0 -10 4 -5" />
          </g>
        </svg>
        <span aria-hidden="true">N</span>
      </div>

      <div className="map-controls">
        <button type="button" className="icon-button" aria-label="Zoom in" onClick={() => zoomBy(1.6)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button type="button" className="icon-button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.6)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button type="button" className="icon-button" aria-label="Fit the map to the screen" onClick={reset}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
          </svg>
        </button>
      </div>
      {/* The OpenStreetMap credit is in the info dialog with the other sources, not repeated over the map. */}
    </div>
  )
}
