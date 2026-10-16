import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

// Current page number, kept in the address bar (?page=2) so Back, refresh and shared links
// keep the page. Goes back to page 1 whenever `filtersKey` changes (a new search/filter).
export function usePage(filtersKey) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)

  const setPage = (next, { replace = false } = {}) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next <= 1) p.delete('page')
        else p.set('page', String(next))
        return p
      },
      { replace }
    )
  }

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (page !== 1) setPage(1, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  return [page, setPage]
}
