/**
 * A one-dimensional spring, in Apple's two designer-facing parameters rather
 * than mass, stiffness and damping. Used for anything a finger can catch
 * mid-flight: a spring carries on from wherever it is and at whatever speed,
 * so a new target never makes it jump.
 */
export interface SpringParams {
  /** 1 settles without overshoot; below 1 it overshoots and comes back. */
  damping: number
  /** Roughly how long it takes to get there, in seconds. Not a fixed duration. */
  response: number
}

export interface SpringState {
  /** Position, in px. */
  x: number
  /** Velocity, in px per second. */
  v: number
}

/** Critically damped: the default for anything that moves without being thrown. */
export const SNAPPY: SpringParams = { damping: 1, response: 0.3 }

/**
 * A little bounce, for something a finger has just thrown: Apple's drawer and
 * sheet spring. Only after a flick; a tap or a slow drag settles with SNAPPY.
 */
export const THROWN: SpringParams = { damping: 0.8, response: 0.3 }

/** True when the reader asks for less motion: springs then jump straight to their target. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Integrated in small fixed steps, so a long frame cannot make it unstable. */
const STEP_S = 1 / 240

/** Advances the spring toward `target` by `dt` seconds (mass 1). */
export function stepSpring(state: SpringState, target: number, dt: number, { damping, response }: SpringParams): SpringState {
  const omega = (2 * Math.PI) / response
  const k = omega * omega
  const c = 2 * damping * omega
  let { x, v } = state
  const steps = Math.max(1, Math.ceil(dt / STEP_S))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    v += (-k * (x - target) - c * v) * h
    x += v * h
  }
  return { x, v }
}

/** Close enough to the target, and slow enough, that the next frame would look the same. */
export function atRest({ x, v }: SpringState, target: number): boolean {
  return Math.abs(x - target) < 0.1 && Math.abs(v) < 2
}

/**
 * Where a flick would come to rest, as UIScrollView decelerates: the distance
 * added to the release point, for a release velocity in px/s. 0.998 is the
 * normal scroll feel; lower stops sooner.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/** Resistance past an edge: the further past, the less the thing follows the finger. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}
