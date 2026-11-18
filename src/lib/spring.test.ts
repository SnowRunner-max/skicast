import { atRest, project, rubberband, SNAPPY, stepSpring, type SpringState } from './spring'

/** Runs the spring at 60 frames a second until it rests, recording every position. */
function run(from: SpringState, target: number, maxS = 3) {
  let state = from
  const xs: number[] = []
  let t = 0
  while (!atRest(state, target) && t < maxS) {
    state = stepSpring(state, target, 1 / 60, SNAPPY)
    xs.push(state.x)
    t += 1 / 60
  }
  return { xs, t, state }
}

describe('stepSpring', () => {
  it('settles critically damped: no overshoot, and in about twice its response', () => {
    const { xs, t } = run({ x: 0, v: 0 }, 44)
    expect(Math.max(...xs)).toBeLessThanOrEqual(44)
    expect(xs.every((x, i) => i === 0 || x >= xs[i - 1]!)).toBe(true)
    expect(t).toBeGreaterThan(0.3)
    expect(t).toBeLessThan(0.7)
  })

  it('carries on at the speed it is handed, so a released thumb leaves at the finger’s speed', () => {
    // 600 px/s is 10px in a 60th of a second; the spring has barely begun to brake it.
    const first = stepSpring({ x: 10, v: 600 }, 44, 1 / 60, SNAPPY)
    expect(first.x - 10).toBeGreaterThan(7)
    expect(first.x - 10).toBeLessThan(10)
  })

  it('turns round from where it is when the target flips mid-flight, without a jump', () => {
    const mid = run({ x: 0, v: 0 }, 44, 0.05).state
    expect(mid.v).toBeGreaterThan(0)
    // Still heading for 44, so it goes on a little before it comes back.
    const next = stepSpring(mid, 0, 1 / 60, SNAPPY)
    expect(next.x).toBeGreaterThan(mid.x)
    expect(next.x - mid.x).toBeLessThan(mid.v / 60)
    expect(run(mid, 0).state.x).toBeCloseTo(0, 0)
  })

  it('is stable over a long frame', () => {
    const state = stepSpring({ x: 0, v: 0 }, 44, 0.5, SNAPPY)
    expect(state.x).toBeGreaterThan(30)
    expect(state.x).toBeLessThanOrEqual(44)
  })
})

describe('project', () => {
  it('throws a flick as far as a scroll view would carry it', () => {
    expect(project(1000)).toBeCloseTo(499, 0)
    expect(project(-1000, 0.99)).toBeCloseTo(-99, 0)
    expect(project(0)).toBe(0)
  })
})

describe('rubberband', () => {
  it('follows less the further past the edge it goes', () => {
    const a = rubberband(10, 44)
    const b = rubberband(40, 44)
    expect(a).toBeLessThan(10)
    expect(b).toBeGreaterThan(a)
    // The first 10px past the edge move it about half as far; the next 30px, about a third.
    expect((b - a) / 30).toBeLessThan(a / 10)
  })
})
