import { useEffect } from 'react'

/**
 * Calls `check` on mount, once a minute while the tab is on screen, and the
 * moment the tab comes back into view.
 *
 * `check` is expected to be cheap when nothing is due (it looks at a cache age
 * and returns), so the interval here is how quickly a stale result is noticed,
 * not how often the network is hit. Polling stops while the tab is hidden: a
 * phone in a pocket should not be fetching forecasts, and the visibility
 * handler catches up as soon as the screen is looked at again.
 */
export function useVisiblePolling(check: () => void, intervalMs = 60_000): void {
  useEffect(() => {
    const checkIfVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    check()
    const timer = setInterval(checkIfVisible, intervalMs)
    document.addEventListener('visibilitychange', checkIfVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', checkIfVisible)
    }
  }, [check, intervalMs])
}
