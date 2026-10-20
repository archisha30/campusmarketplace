import { useEffect } from 'react'

// Calls `load` every `ms` while the tab is visible and the device is online.
// Skipping hidden/offline ticks avoids a pile of failed requests while a laptop
// sleeps; coming back to the tab (or back online) refreshes straight away.
export function usePolling(load, ms, enabled) {
  useEffect(() => {
    if (!enabled) return
    const active = () => document.visibilityState === 'visible' && navigator.onLine !== false
    const tick = () => { if (active()) load() }
    const t = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('online', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('online', tick)
    }
  }, [load, ms, enabled])
}
