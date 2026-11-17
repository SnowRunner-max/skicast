import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/** Also read by the inline script in index.html, which cannot import it. Change both together. */
const STORAGE_KEY = 'skicast:theme'

/**
 * Light and dark appearance. index.html sets the `.dark` class before first
 * paint; this hook keeps it in sync. Until the reader picks one, the system
 * setting is followed.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      let saved: string | null = null
      try {
        saved = localStorage.getItem(STORAGE_KEY)
      } catch {
        // No storage: keep following the system.
      }
      if (!saved) setTheme(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // The choice still applies for this visit.
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
