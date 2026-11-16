import { fromViewMetres, project, screenAngle, toViewMetres, type Projection } from './projection'
import { MAP } from '../data/mapPaths'
import { BEACONS, stationFor } from '../data/beacons'

const northUp: Projection = { lat0: 37.64, lon0: -119.02, bearingDeg: 0, scale: 1, tx: 0, ty: 0 }

describe('projection', () => {
  it('puts north up and east right at bearing 0', () => {
    const north = project(northUp, 37.65, -119.02)
    const east = project(northUp, 37.64, -119.01)
    expect(north.x).toBeCloseTo(0, 6)
    expect(north.y).toBeLessThan(0) // SVG y grows downward
    expect(east.x).toBeGreaterThan(0)
    expect(east.y).toBeCloseTo(0, 6)
  })

  it('rotates without mirroring: with south up, east is on the left', () => {
    const southUp = { ...northUp, bearingDeg: 180 }
    expect(project(southUp, 37.63, -119.02).y).toBeLessThan(0)
    expect(project(southUp, 37.64, -119.01).x).toBeLessThan(0)
  })

  it('round-trips view metres', () => {
    const m = toViewMetres(MAP.projection, 37.6306485, -119.033229)
    const back = fromViewMetres(MAP.projection, m.x, m.y)
    expect(back.lat).toBeCloseTo(37.6306485, 7)
    expect(back.lon).toBeCloseTo(-119.033229, 7)
  })

  it('measures distance about right (1° of latitude is ~111 km)', () => {
    const m = toViewMetres(northUp, 38.64, -119.02)
    expect(m.y / 1000).toBeCloseTo(111.2, 0)
  })

  it('gives screen angles relative to the map rotation', () => {
    expect(screenAngle({ bearingDeg: 201 }, 201)).toBe(0)
    expect(screenAngle({ bearingDeg: 201 }, 0)).toBe(159)
  })
})

describe('generated map', () => {
  it('places every beacon exactly on its station', () => {
    for (const beacon of BEACONS) {
      const station = stationFor(beacon)
      const p = project(MAP.projection, station.lat, station.lon)
      expect(p.x).toBeCloseTo(station.x, 0)
      expect(p.y).toBeCloseTo(station.y, 0)
    }
  })

  it('shows the trail-map view: summit above the base lodges, Eagle left of Main', () => {
    const at = (id: string) => stationFor(BEACONS.find((b) => b.id === id)!)
    const [summit, mccoy, main, canyon, eagle] = ['summit', 'mccoy', 'main', 'canyon', 'eagle'].map(at) as [
      ReturnType<typeof at>,
      ReturnType<typeof at>,
      ReturnType<typeof at>,
      ReturnType<typeof at>,
      ReturnType<typeof at>,
    ]
    expect(summit.y).toBeLessThan(mccoy.y)
    expect(mccoy.y).toBeLessThan(main.y)
    expect(eagle.x).toBeLessThan(canyon.x)
    expect(canyon.x).toBeLessThan(main.x)
    // The three lodges sit on a roughly level line.
    expect(Math.abs(eagle.y - main.y)).toBeLessThan(MAP.viewBox.height * 0.1)
  })

  it('keeps every lift inside the viewBox', () => {
    for (const lift of MAP.lifts) {
      for (const [x, y] of [
        [lift.x1, lift.y1],
        [lift.x2, lift.y2],
      ] as const) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(MAP.viewBox.width)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(MAP.viewBox.height)
      }
    }
  })

  it('includes the lifts on the current trail map', () => {
    const names = new Set(MAP.lifts.map((l) => l.name))
    for (const name of [
      'Panorama Gondola',
      'Village Gondola',
      'Broadway Express',
      'Stump Alley Express',
      'Face Lift Express',
      'Roller Coaster Express',
      'High Five Express',
      'Unbound Express',
      'Cloud Nine Express',
      'Gold Rush Express',
      'Discovery Express',
      'Eagle Express',
      'Canyon Express',
      'Schoolyard Express',
      'Chair 7',
      'Chair 8',
      'Chair 12',
      'Chair 13',
      'Chair 14',
      'Chair 20',
      'Chair 21',
      'Chair 22',
      'Chair 23',
      'Chair 25',
    ]) {
      expect(names, name).toContain(name)
    }
  })
})
