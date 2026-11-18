import { useCallback, useMemo, useState } from 'react'
import { BeaconWidget } from './components/BeaconWidget'
import { Header } from './components/Header'
import { MountainMap } from './components/MountainMap'
import { snapHeights } from './components/BottomSheet'
import { BEACONS, DEFAULT_BEACON_ID } from './data/beacons'
import { useForecast } from './hooks/useForecast'
import { useObservations } from './hooks/useObservations'
import { resolveCurrent, type Current } from './lib/current'
import { MOUNTAIN_BEACON_ID, mountainForecast } from './lib/mountainForecast'
import { useLayout } from './hooks/useLayout'
import { useMeasure } from './hooks/useMeasure'
import { useNow } from './hooks/useNow'
import { useTheme } from './hooks/useTheme'

export default function App() {
  const { theme, toggle } = useTheme()
  const { forecasts, loading, error, fetchedAt, refresh } = useForecast()
  const { observations, refresh: refreshObservations } = useObservations()
  const now = useNow()
  const layout = useLayout()
  const { measure, setMeasure } = useMeasure()
  const [selectedId, setSelectedId] = useState(DEFAULT_BEACON_ID)
  // The map frames itself above the half-open sheet. Pulling the sheet all the
  // way up leaves the map where it was, so it is still there when you come back.
  // Seeded from the same sum the sheet uses, so the first frame is already right.
  const [sheetPx, setSheetPx] = useState(() => snapHeights(window.innerHeight).half)
  const onSheetSettle = useCallback((px: number) => {
    const { half } = snapHeights(window.innerHeight)
    setSheetPx(Math.min(px, half))
  }, [])

  const beacon = BEACONS.find((b) => b.id === selectedId) ?? BEACONS[0]!
  const forecast = forecasts?.find((f) => f.beacon.id === beacon.id) ?? null
  const currents = useMemo(() => {
    if (!forecasts) return null
    const byId: Record<string, Current> = Object.fromEntries(
      forecasts.map((f) => [f.beacon.id, resolveCurrent(f, observations)]),
    )
    return byId
  }, [forecasts, observations])
  // The same for every beacon: mountain weather is broader than one station.
  const mountainSource = forecasts?.find((f) => f.beacon.id === MOUNTAIN_BEACON_ID) ?? null
  const mountainCurrent = currents?.[MOUNTAIN_BEACON_ID] ?? null
  const mountain = useMemo(
    () => (mountainSource ? mountainForecast(mountainSource, mountainCurrent, now) : null),
    [mountainSource, mountainCurrent, now],
  )
  const onRefresh = useCallback(() => {
    refresh()
    refreshObservations()
  }, [refresh, refreshObservations])

  return (
    <div className="app" data-layout={layout}>
      <Header
        fetchedAt={fetchedAt}
        loading={loading}
        error={error}
        now={now}
        theme={theme}
        onToggleTheme={toggle}
        mountain={mountain}
        measure={measure}
        onMeasureChange={setMeasure}
      />
      <main className="layout">
        <div className="map-frame">
          <MountainMap
            currents={currents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            layout={layout}
            sheetPx={layout === 'sheet' ? sheetPx : 0}
            measure={measure}
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
          variant={layout === 'sheet' ? 'sheet' : 'card'}
          onSheetSettle={onSheetSettle}
        />
      </main>
    </div>
  )
}
