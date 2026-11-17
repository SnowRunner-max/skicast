import { useCallback, useMemo, useState } from 'react'
import { BeaconWidget } from './components/BeaconWidget'
import { Header } from './components/Header'
import { MountainMap } from './components/MountainMap'
import { snapHeights } from './components/BottomSheet'
import { BEACONS, DEFAULT_BEACON_ID } from './data/beacons'
import { useForecast } from './hooks/useForecast'
import { useObservations } from './hooks/useObservations'
import { resolveCurrent, type Current } from './lib/current'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useNow } from './hooks/useNow'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const { theme, toggle } = useTheme()
  const { forecasts, loading, error, fetchedAt, refresh } = useForecast()
  const { observations, refresh: refreshObservations } = useObservations()
  const now = useNow()
  const desktop = useMediaQuery('(min-width: 1100px)')
  const [selectedId, setSelectedId] = useState(DEFAULT_BEACON_ID)
  // The map frames itself above the half-open sheet. Pulling the sheet all the
  // way up leaves the map where it was, so it is still there when you come back.
  const [sheetPx, setSheetPx] = useState(() => snapHeights(window.innerHeight).half)
  const onSheetSettle = useCallback((px: number) => {
    const { half } = snapHeights(window.innerHeight)
    setSheetPx(Math.min(px, half))
  }, [])

  const beacon = BEACONS.find((b) => b.id === selectedId) ?? BEACONS[0]!
  const forecast = forecasts?.find((f) => f.beacon.id === beacon.id) ?? null
  const currents = useMemo(() => {
    if (!forecasts) return null
    return Object.fromEntries(
      forecasts.map((f) => [f.beacon.id, resolveCurrent(f, observations)]),
    ) as Record<string, Current>
  }, [forecasts, observations])
  const onRefresh = useCallback(() => {
    refresh()
    refreshObservations()
  }, [refresh, refreshObservations])

  return (
    <div className="app">
      <Header
        fetchedAt={fetchedAt}
        loading={loading}
        error={error}
        now={now}
        theme={theme}
        onToggleTheme={toggle}
      />
      <main className="layout">
        <div className="map-frame">
          <MountainMap
            currents={currents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            compact={!desktop}
            bottomInset={desktop ? 0 : sheetPx}
          />
        </div>
        <BeaconWidget
          beacon={beacon}
          forecast={forecast}
          current={currents?.[beacon.id] ?? null}
          loading={loading}
          error={error}
          now={now}
          onRefresh={onRefresh}
          variant={desktop ? 'card' : 'sheet'}
          onSheetSettle={onSheetSettle}
        />
      </main>
    </div>
  )
}
