/**
 * Builds the lift map. Run by hand; the outputs are checked in.
 *
 *   npm run map:fetch     OpenStreetMap lifts  -> src/data/mammoth-lifts.geojson, then build
 *   npm run map:terrain   USGS 3DEP elevations -> src/data/mammoth-terrain.json, then build
 *   npm run map:build     GeoJSON (+ terrain)  -> src/data/mapPaths.ts
 *
 * After a fetch, review the GeoJSON diff against the current official trail map
 * (lift names, which lifts exist, where they start and end). Fix mistakes in OSM
 * itself where you can, or in REVIEW below.
 *
 * Lift data © OpenStreetMap contributors (ODbL). Elevation data: USGS 3DEP (public domain).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fromViewMetres, toViewMetres, screenAngle, type Point } from '../src/lib/projection'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GEOJSON_PATH = resolve(ROOT, 'src/data/mammoth-lifts.geojson')
const TERRAIN_PATH = resolve(ROOT, 'src/data/mammoth-terrain.json')
const MAP_PATH = resolve(ROOT, 'src/data/mapPaths.ts')

// ---- Settings -------------------------------------------------------------

/** Area pulled from OSM: Mammoth Mountain Ski Area, including the Village Gondola. */
const BBOX = { south: 37.612, west: -119.075, north: 37.662, east: -118.985 }

/** Projection origin, near the middle of the lift network. */
const ORIGIN = { lat0: 37.64, lon0: -119.02 }

/**
 * Compass bearing that points up the screen. 201° puts Main, Canyon and Eagle
 * lodges on a level line along the bottom with the summit above them, which is
 * the trail-map view from town.
 */
const VIEW_BEARING_DEG = 201

const VIEW_WIDTH = 1000
const PADDING = 56

/** Lift types drawn on the map. Magic carpets, platters and station buildings are left out. */
const LIFT_KINDS = new Set(['gondola', 'chair_lift', 'mixed_lift', 'cable_car'])

/**
 * Hand review, keyed by OSM way id. `label: null` draws the line without a name.
 * The Panorama Gondola is two ways in OSM (lower and upper); it gets one label.
 */
const REVIEW: Record<number, { name?: string; label?: string | null; skip?: boolean }> = {
  1525905377: { name: 'Panorama Gondola', label: null },
  10897351: { name: 'Panorama Gondola' },
}

/** Terrain grid: spacing between samples, and how far it reaches past the lifts. */
const TERRAIN_SPACING_M = 90
const TERRAIN_MARGIN_X_M = 1200
const TERRAIN_MARGIN_Y_M = 4000
const CONTOUR_INTERVAL_M = 80

const USER_AGENT = 'skicast-build-map/0.1'

// ---- Types ----------------------------------------------------------------

interface OsmNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}
interface OsmWay {
  type: 'way'
  id: number
  nodes: number[]
  tags?: Record<string, string>
}
type OsmElement = OsmNode | OsmWay | { type: 'relation'; id: number }

interface LiftFeature {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: [number, number][] }
  properties: {
    osmId: number
    aerialway: string
    name: string
    ref?: string
    seats?: number
    fromNode: number
    toNode: number
  }
}
interface StationFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { osmId: number; aerialway: 'station'; lifts: string[] }
}
interface LiftCollection {
  type: 'FeatureCollection'
  source: string
  licence: string
  fetched: string
  features: (LiftFeature | StationFeature)[]
}

interface Terrain {
  source: string
  fetched: string
  lat0: number
  lon0: number
  bearingDeg: number
  /** View-metre coordinates of sample [0][0]; rows run up the screen. */
  x0: number
  y0: number
  spacingM: number
  cols: number
  rows: number
  /** Row-major elevations in metres. */
  elevM: number[]
}

// ---- Fetch: OpenStreetMap -------------------------------------------------

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 45_000): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

async function fetchFromOverpass(): Promise<OsmElement[]> {
  const { south, west, north, east } = BBOX
  const query = `[out:json][timeout:40];way["aerialway"](${south},${west},${north},${east});out body;>;out skel qt;`
  let lastError: unknown
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Overpass: ${endpoint}`)
      const data = (await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      })) as { elements: OsmElement[] }
      if (data.elements.length > 0) return data.elements
      lastError = new Error('empty result')
    } catch (err) {
      lastError = err
      console.log(`  failed: ${String(err)}`)
    }
  }
  throw new Error(`All Overpass endpoints failed: ${String(lastError)}`)
}

/** Fallback when Overpass is down: the main OSM API, in tiles to stay under its node limit. */
async function fetchFromOsmApi(): Promise<OsmElement[]> {
  const cols = 3
  const rows = 2
  const dLon = (BBOX.east - BBOX.west) / cols
  const dLat = (BBOX.north - BBOX.south) / rows
  const byKey = new Map<string, OsmElement>()
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const w = BBOX.west + c * dLon
      const s = BBOX.south + r * dLat
      const bbox = [w, s, w + dLon, s + dLat].map((n) => n.toFixed(5)).join(',')
      console.log(`OSM API: bbox ${bbox}`)
      const data = (await fetchJson(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, {}, 120_000)) as {
        elements: OsmElement[]
      }
      for (const el of data.elements) byKey.set(`${el.type}/${el.id}`, el)
    }
  }
  return [...byKey.values()]
}

function toGeoJson(elements: OsmElement[], source: string): LiftCollection {
  const nodes = new Map<number, OsmNode>()
  for (const el of elements) if (el.type === 'node') nodes.set(el.id, el as OsmNode)

  const lifts: LiftFeature[] = []
  const stationLifts = new Map<number, string[]>()

  for (const el of elements) {
    if (el.type !== 'way') continue
    const way = el as OsmWay
    const kind = way.tags?.aerialway
    const name = way.tags?.name
    if (!kind || !LIFT_KINDS.has(kind) || !name) continue

    const coordinates: [number, number][] = []
    for (const id of way.nodes) {
      const n = nodes.get(id)
      if (!n) throw new Error(`Way ${way.id} (${name}) is missing node ${id}`)
      coordinates.push([n.lon, n.lat])
    }
    const fromNode = way.nodes[0]!
    const toNode = way.nodes[way.nodes.length - 1]!
    const seats = Number(way.tags?.['aerialway:occupancy'])
    lifts.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {
        osmId: way.id,
        aerialway: kind,
        name,
        ...(way.tags?.ref ? { ref: way.tags.ref } : {}),
        ...(Number.isFinite(seats) && seats > 0 ? { seats } : {}),
        fromNode,
        toNode,
      },
    })
    for (const id of [fromNode, toNode]) {
      stationLifts.set(id, [...(stationLifts.get(id) ?? []), name])
    }
  }

  lifts.sort((a, b) => a.properties.name.localeCompare(b.properties.name) || a.properties.osmId - b.properties.osmId)

  const stations: StationFeature[] = [...stationLifts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, names]) => {
      const n = nodes.get(id)!
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [n.lon, n.lat] },
        properties: { osmId: id, aerialway: 'station', lifts: names.sort() },
      }
    })

  return {
    type: 'FeatureCollection',
    source,
    licence: 'Lift data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
    fetched: new Date().toISOString().slice(0, 10),
    features: [...lifts, ...stations],
  }
}

async function fetchLifts(): Promise<void> {
  let elements: OsmElement[]
  let source: string
  try {
    elements = await fetchFromOverpass()
    source = 'OpenStreetMap via Overpass API'
  } catch (err) {
    console.log(`${String(err)}\nFalling back to the OSM API.`)
    elements = await fetchFromOsmApi()
    source = 'OpenStreetMap API 0.6'
  }
  const geojson = toGeoJson(elements, source)
  writeFileSync(GEOJSON_PATH, JSON.stringify(geojson, null, 1) + '\n')
  const liftCount = geojson.features.filter((f) => f.geometry.type === 'LineString').length
  console.log(`Wrote ${liftCount} lifts to ${GEOJSON_PATH}`)
}

// ---- Layout ---------------------------------------------------------------

function readLifts(): LiftCollection {
  if (!existsSync(GEOJSON_PATH)) throw new Error('No GeoJSON yet. Run `npm run map:fetch` first.')
  return JSON.parse(readFileSync(GEOJSON_PATH, 'utf8')) as LiftCollection
}

const VIEW = { ...ORIGIN, bearingDeg: VIEW_BEARING_DEG }

interface Layout {
  scale: number
  tx: number
  ty: number
  width: number
  height: number
  /** Lift extents in view metres. */
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function layoutFor(geojson: LiftCollection): Layout {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const f of geojson.features) {
    if (f.geometry.type !== 'LineString') continue
    if (REVIEW[(f as LiftFeature).properties.osmId]?.skip) continue
    for (const [lon, lat] of f.geometry.coordinates) {
      const m = toViewMetres(VIEW, lat, lon)
      minX = Math.min(minX, m.x)
      maxX = Math.max(maxX, m.x)
      minY = Math.min(minY, m.y)
      maxY = Math.max(maxY, m.y)
    }
  }
  const scale = (VIEW_WIDTH - 2 * PADDING) / (maxX - minX)
  return {
    scale,
    tx: PADDING - minX * scale,
    ty: PADDING + maxY * scale,
    width: VIEW_WIDTH,
    height: Math.round((maxY - minY) * scale + 2 * PADDING),
    minX,
    maxX,
    minY,
    maxY,
  }
}

// ---- Fetch: USGS terrain --------------------------------------------------

async function fetchTerrain(): Promise<void> {
  const layout = layoutFor(readLifts())
  const x0 = Math.floor((layout.minX - TERRAIN_MARGIN_X_M) / TERRAIN_SPACING_M) * TERRAIN_SPACING_M
  const y0 = Math.floor((layout.minY - TERRAIN_MARGIN_Y_M) / TERRAIN_SPACING_M) * TERRAIN_SPACING_M
  const cols = Math.ceil((layout.maxX + TERRAIN_MARGIN_X_M - x0) / TERRAIN_SPACING_M) + 1
  const rows = Math.ceil((layout.maxY + TERRAIN_MARGIN_Y_M - y0) / TERRAIN_SPACING_M) + 1

  const points: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { lat, lon } = fromViewMetres(VIEW, x0 + c * TERRAIN_SPACING_M, y0 + r * TERRAIN_SPACING_M)
      points.push([Number(lon.toFixed(6)), Number(lat.toFixed(6))])
    }
  }

  const elevM = new Array<number>(points.length).fill(NaN)
  const BATCH = 400
  for (let start = 0; start < points.length; start += BATCH) {
    const batch = points.slice(start, start + BATCH)
    const body = new URLSearchParams({
      geometry: JSON.stringify({ points: batch, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryMultipoint',
      returnFirstValueOnly: 'true',
      f: 'json',
    })
    let data: { samples?: { locationId: number; value: string }[] } | undefined
    for (let attempt = 1; attempt <= 3 && !data?.samples; attempt++) {
      try {
        data = (await fetchJson(
          'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples',
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() },
          60_000,
        )) as typeof data
      } catch (err) {
        console.log(`  batch at ${start} failed (attempt ${attempt}): ${String(err)}`)
      }
    }
    if (!data?.samples) throw new Error(`USGS elevation request failed at point ${start}`)
    for (const s of data.samples) {
      const v = Number(s.value)
      if (Number.isFinite(v)) elevM[start + s.locationId] = Math.round(v)
    }
    console.log(`USGS 3DEP: ${Math.min(start + BATCH, points.length)} / ${points.length}`)
  }

  const missing = elevM.filter((v) => Number.isNaN(v)).length
  if (missing > 0) throw new Error(`${missing} terrain samples came back empty`)

  const terrain: Terrain = {
    source: 'USGS 3D Elevation Program (3DEP), public domain',
    fetched: new Date().toISOString().slice(0, 10),
    ...VIEW,
    x0,
    y0,
    spacingM: TERRAIN_SPACING_M,
    cols,
    rows,
    elevM,
  }
  writeFileSync(TERRAIN_PATH, JSON.stringify(terrain) + '\n')
  console.log(`Wrote ${cols} x ${rows} terrain grid to ${TERRAIN_PATH}`)
}

// ---- Contours (marching squares) -----------------------------------------

/** Contour polylines in view metres, one list per level. */
function contourLines(t: Terrain, interval: number): Point[][] {
  const at = (c: number, r: number) => t.elevM[r * t.cols + c]!
  const lo = Math.min(...t.elevM)
  const hi = Math.max(...t.elevM)
  const lines: Point[][] = []

  for (let level = Math.ceil(lo / interval) * interval; level < hi; level += interval) {
    // A crossing lives on a grid edge, so the edge is an exact key for stitching.
    const crossing = new Map<string, Point>()
    const segments: [string, string][] = []
    const cross = (c1: number, r1: number, c2: number, r2: number): string => {
      const key = `${c1},${r1},${c2},${r2}`
      if (!crossing.has(key)) {
        const a = at(c1, r1)
        const b = at(c2, r2)
        const f = (level - a) / (b - a)
        crossing.set(key, {
          x: t.x0 + (c1 + (c2 - c1) * f) * t.spacingM,
          y: t.y0 + (r1 + (r2 - r1) * f) * t.spacingM,
        })
      }
      return key
    }

    for (let r = 0; r < t.rows - 1; r++) {
      for (let c = 0; c < t.cols - 1; c++) {
        const above = (cc: number, rr: number) => at(cc, rr) >= level
        const idx =
          (above(c, r) ? 1 : 0) | (above(c + 1, r) ? 2 : 0) | (above(c + 1, r + 1) ? 4 : 0) | (above(c, r + 1) ? 8 : 0)
        if (idx === 0 || idx === 15) continue
        const bottom = () => cross(c, r, c + 1, r)
        const right = () => cross(c + 1, r, c + 1, r + 1)
        const top = () => cross(c, r + 1, c + 1, r + 1)
        const left = () => cross(c, r, c, r + 1)
        switch (idx) {
          case 1:
          case 14:
            segments.push([left(), bottom()])
            break
          case 2:
          case 13:
            segments.push([bottom(), right()])
            break
          case 3:
          case 12:
            segments.push([left(), right()])
            break
          case 4:
          case 11:
            segments.push([right(), top()])
            break
          case 6:
          case 9:
            segments.push([bottom(), top()])
            break
          case 7:
          case 8:
            segments.push([left(), top()])
            break
          case 5:
          case 10: {
            // Saddle: split by the cell's mean height.
            const mean = (at(c, r) + at(c + 1, r) + at(c + 1, r + 1) + at(c, r + 1)) / 4
            const joinLowCorners = (mean >= level) === (idx === 5)
            if (joinLowCorners) {
              segments.push([left(), top()], [bottom(), right()])
            } else {
              segments.push([left(), bottom()], [right(), top()])
            }
            break
          }
        }
      }
    }

    // Stitch segments into polylines.
    const byKey = new Map<string, number[]>()
    segments.forEach(([a, b], i) => {
      byKey.set(a, [...(byKey.get(a) ?? []), i])
      byKey.set(b, [...(byKey.get(b) ?? []), i])
    })
    const used = new Array<boolean>(segments.length).fill(false)
    const walk = (startSeg: number, startKey: string): string[] => {
      const keys = [startKey]
      let seg = startSeg
      let key = startKey
      for (;;) {
        used[seg] = true
        const [a, b] = segments[seg]!
        key = a === key ? b : a
        keys.push(key)
        const next = (byKey.get(key) ?? []).find((i) => !used[i])
        if (next === undefined) return keys
        seg = next
      }
    }
    const chains: string[][] = []
    // Open lines first (they start where an edge has a single segment), then closed loops.
    for (const [key, segs] of byKey) {
      if (segs.length === 1 && !used[segs[0]!]) chains.push(walk(segs[0]!, key))
    }
    segments.forEach(([a], i) => {
      if (!used[i]) chains.push(walk(i, a))
    })
    for (const chain of chains) {
      if (chain.length >= 5) lines.push(chain.map((k) => crossing.get(k)!))
    }
  }
  return lines
}

/** One round of Chaikin corner cutting; keeps the ends of open lines. */
function smooth(line: Point[]): Point[] {
  const closed = line[0]!.x === line[line.length - 1]!.x && line[0]!.y === line[line.length - 1]!.y
  const out: Point[] = closed ? [] : [line[0]!]
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!
    const b = line[i + 1]!
    out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
    out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
  }
  if (closed) out.push(out[0]!)
  else out.push(line[line.length - 1]!)
  return out
}

/** Douglas-Peucker. */
function simplify(line: Point[], tolerance: number): Point[] {
  if (line.length < 3) return line
  const keep = new Array<boolean>(line.length).fill(false)
  keep[0] = keep[line.length - 1] = true
  const stack: [number, number][] = [[0, line.length - 1]]
  while (stack.length) {
    const [i0, i1] = stack.pop()!
    const a = line[i0]!
    const b = line[i1]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    let worst = 0
    let worstIdx = -1
    for (let i = i0 + 1; i < i1; i++) {
      const p = line[i]!
      const d = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len
      if (d > worst) {
        worst = d
        worstIdx = i
      }
    }
    if (worst > tolerance && worstIdx > 0) {
      keep[worstIdx] = true
      stack.push([i0, worstIdx], [worstIdx, i1])
    }
  }
  return line.filter((_, i) => keep[i])
}

// ---- Build: mapPaths.ts ---------------------------------------------------

const r1 = (n: number) => Math.round(n * 10) / 10

function pathD(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r1(p.x)} ${r1(p.y)}`).join('')
}

function build(): void {
  const geojson = readLifts()
  const layout = layoutFor(geojson)
  const toSvg = (m: Point): Point => ({ x: layout.tx + m.x * layout.scale, y: layout.ty - m.y * layout.scale })
  const projectLonLat = ([lon, lat]: [number, number]) => toSvg(toViewMetres(VIEW, lat, lon))

  const lifts = geojson.features
    .filter((f): f is LiftFeature => f.geometry.type === 'LineString')
    .filter((f) => !REVIEW[f.properties.osmId]?.skip)
    .map((f) => {
      const review = REVIEW[f.properties.osmId] ?? {}
      const pts = simplify(f.geometry.coordinates.map(projectLonLat), 0.25)
      const first = pts[0]!
      const last = pts[pts.length - 1]!
      const name = review.name ?? f.properties.name
      return {
        id: f.properties.osmId,
        name,
        label: review.label === undefined ? name : review.label,
        kind: f.properties.aerialway === 'gondola' ? 'gondola' : 'chair',
        seats: f.properties.seats ?? null,
        d: pathD(pts),
        x1: r1(first.x),
        y1: r1(first.y),
        x2: r1(last.x),
        y2: r1(last.y),
      }
    })

  const stations = geojson.features
    .filter((f): f is StationFeature => f.geometry.type === 'Point')
    .map((f) => {
      const [lon, lat] = f.geometry.coordinates
      const p = projectLonLat([lon, lat])
      return { osmId: f.properties.osmId, lat, lon, x: r1(p.x), y: r1(p.y) }
    })

  let contours: string[] = []
  let world = { x: 0, y: 0, width: layout.width, height: layout.height }
  if (existsSync(TERRAIN_PATH)) {
    const terrain = JSON.parse(readFileSync(TERRAIN_PATH, 'utf8')) as Terrain
    if (terrain.lat0 !== VIEW.lat0 || terrain.lon0 !== VIEW.lon0 || terrain.bearingDeg !== VIEW.bearingDeg) {
      throw new Error('Terrain grid was sampled for a different projection. Run `npm run map:terrain` again.')
    }
    contours = contourLines(terrain, CONTOUR_INTERVAL_M)
      .map((line) => simplify(smooth(line).map(toSvg), 0.35))
      .filter((line) => line.length >= 3)
      .map(pathD)
    const topLeft = toSvg({ x: terrain.x0, y: terrain.y0 + (terrain.rows - 1) * terrain.spacingM })
    world = {
      x: r1(topLeft.x),
      y: r1(topLeft.y),
      width: r1((terrain.cols - 1) * terrain.spacingM * layout.scale),
      height: r1((terrain.rows - 1) * terrain.spacingM * layout.scale),
    }
  } else {
    console.log('No terrain file; building without contours. Run `npm run map:terrain` to add them.')
  }

  const projection = {
    ...VIEW,
    scale: Number(layout.scale.toFixed(6)),
    tx: r1(layout.tx),
    ty: r1(layout.ty),
  }

  const out = `// GENERATED by scripts/build-map.ts from src/data/mammoth-lifts.geojson. Do not edit by hand.
// Lift data © OpenStreetMap contributors (ODbL), fetched ${geojson.fetched}. Contours from USGS 3DEP (public domain).
import type { Projection } from '../lib/projection'

export interface MapLift {
  /** OSM way id. */
  id: number
  name: string
  /** Name drawn on the map, or null to draw the line unlabelled. */
  label: string | null
  kind: 'gondola' | 'chair'
  seats: number | null
  /** SVG path, bottom station first. */
  d: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface MapStation {
  /** OSM node id of the lift's end station. */
  osmId: number
  lat: number
  lon: number
  x: number
  y: number
}

export interface MapData {
  /** Frame that fits every lift, with padding. */
  viewBox: { width: number; height: number }
  /** Area covered by terrain contours; larger than the viewBox. */
  world: { x: number; y: number; width: number; height: number }
  projection: Projection
  /** Screen rotation of true north, degrees clockwise from up. */
  northAngle: number
  lifts: MapLift[]
  stations: MapStation[]
  contours: string[]
}

export const MAP: MapData = ${JSON.stringify(
    {
      viewBox: { width: layout.width, height: layout.height },
      world,
      projection,
      northAngle: r1(screenAngle(VIEW, 0)),
      lifts,
      stations,
      contours,
    },
    null,
    1,
  )}
`
  writeFileSync(MAP_PATH, out)
  console.log(
    `Wrote ${lifts.length} lifts, ${stations.length} stations and ${contours.length} contour lines to ${MAP_PATH} (${layout.width} x ${layout.height})`,
  )
}

// ---- Main -----------------------------------------------------------------

const args = new Set(process.argv.slice(2))
if (args.has('--fetch')) await fetchLifts()
if (args.has('--terrain')) await fetchTerrain()
build()
