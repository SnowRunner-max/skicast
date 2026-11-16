import { memo, useMemo } from 'react'
import { BEACONS, stationFor } from '../data/beacons'
import { MAP, type MapLift } from '../data/mapPaths'
import { usePanZoom, type Box, type Insets, type View } from '../hooks/usePanZoom'
import type { Current } from '../lib/current'
import { Beacon } from './Beacon'

interface Props {
  /** Resolved current values by beacon id, or null before the first forecast arrives. */
  currents: Record<string, Current> | null
  selectedId: string
  onSelect: (id: string) => void
  /** Phone layout: frame the five beacons rather than every lift. */
  compact: boolean
  /** Height in pixels covered by the bottom sheet. */
  bottomInset: number
}

const VIEW_BOX: Box = { x: 0, y: 0, width: MAP.viewBox.width, height: MAP.viewBox.height }

/** The viewBox carries generous padding; the desktop frame trims some of it so the lifts read larger. */
const TRIM = 36
const LIFTS_BOX: Box = { x: TRIM, y: TRIM, width: VIEW_BOX.width - 2 * TRIM, height: VIEW_BOX.height - 2 * TRIM }

const BEACON_POINTS = BEACONS.map((beacon) => ({ beacon, station: stationFor(beacon) }))

/** The five beacons' bounding box, in map units. */
const BEACON_BOX: Box = (() => {
  const xs = BEACON_POINTS.map((p) => p.station.x)
  const ys = BEACON_POINTS.map((p) => p.station.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
})()

/** Lifts and contours never change, so they render once and are moved by a transform. */
const StaticLayer = memo(function StaticLayer() {
  return (
    <>
      <g className="map-contours">
        {MAP.contours.map((d, i) => (
          <path key={i} d={d} />
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

const LABEL_CHAR_PX = 6.1
const LABEL_CLEARANCE_PX = 12

/**
 * Lift names sit along their lines at a constant size. A name is drawn only
 * when its line is long enough on screen and it would not run into a beacon or
 * another name, so more names appear as you zoom in.
 */
function placeLabels(view: View, obstacles: Box[]): PlacedLabel[] {
  const taken: { x: number; y: number }[] = []
  const placed: PlacedLabel[] = []
  const lifts = MAP.lifts
    .filter((l) => l.label)
    .map((l) => ({ lift: l, len: Math.hypot(l.x2 - l.x1, l.y2 - l.y1) }))
    .sort((a, b) => Number(b.lift.kind === 'gondola') - Number(a.lift.kind === 'gondola') || b.len - a.len)

  for (const { lift, len } of lifts) {
    const textWidth = lift.label!.length * LABEL_CHAR_PX
    if (len * view.k < textWidth + 18) continue

    const x1 = lift.x1 * view.k + view.x
    const y1 = lift.y1 * view.k + view.y
    const x2 = lift.x2 * view.k + view.x
    const y2 = lift.y2 * view.k + view.y
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

/** Screen-space box a beacon and its label cover, for keeping lift names clear of it. */
function beaconObstacles(x: number, y: number, side: 'left' | 'right' | 'below'): Box[] {
  const mark = { x: x - 20, y: y - 20, width: 40, height: 40 }
  if (side === 'below') return [mark, { x: x - 34, y: y + 16, width: 68, height: 42 }]
  if (side === 'left') return [mark, { x: x - 90, y: y - 20, width: 72, height: 40 }]
  return [mark, { x: x + 18, y: y - 20, width: 72, height: 40 }]
}

export function MountainMap({ currents, selectedId, onSelect, compact, bottomInset }: Props) {
  // Screen-space padding so beacon labels at the edges stay inside the frame.
  const insets: Insets = compact
    ? { top: 78, right: 44, bottom: bottomInset + 56, left: 78 }
    : { top: 16, right: 16, bottom: 16, left: 64 }
  const { ref, size, view, zoomBy, reset, handlers } = usePanZoom({
    fitBox: compact ? BEACON_BOX : LIFTS_BOX,
    insets,
    bounds: VIEW_BOX,
  })

  const beacons = useMemo(
    () =>
      view
        ? BEACON_POINTS.map(({ beacon, station }) => ({
            beacon,
            x: station.x * view.k + view.x,
            y: station.y * view.k + view.y,
          }))
        : [],
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
            {MAP.stations.map((s) => (
              <circle key={s.osmId} cx={s.x * view.k + view.x} cy={s.y * view.k + view.y} r={view.k > 1.2 ? 3 : 2.2} />
            ))}
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

      <p className="map-attribution" style={compact ? { bottom: bottomInset + 8 } : undefined}>
        Lift data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  )
}
