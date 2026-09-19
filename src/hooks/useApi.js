import { useCallback, useEffect, useState } from 'react'

// Small fetch-on-mount hook. Keeps loading/error/refetch wiring out of pages.
// Swap for TanStack Query later without touching component bodies.
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const run = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.resolve(fn())
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(run, [run])

  return { data, loading, error, refetch: run, setData }
}

// Debounces a fast-changing value (search boxes) so filters don't fire per keystroke.
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
