import { useCallback, useEffect, useState } from 'react'
import { requestsApi } from '../services/api.js'
import { useAuth } from './useAuth.jsx'
import { usePolling } from './usePolling.js'

const POLL_MS = 60_000

// Product requests are broadcast to every seller. "Unread" = posted after the
// seller last opened their dashboard; that timestamp lives in localStorage.
function seenKey(user) {
  return `cm_requests_seen_${user?.id}`
}

function readSeen(user) {
  try {
    return Number(localStorage.getItem(seenKey(user))) || 0
  } catch {
    return 0
  }
}

const toMs = (iso) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`).getTime()

// `freeze` keeps the "last seen" time from when the component mounted, so a
// page can mark everything seen (clearing the navbar badge) and still show
// which requests were new to the seller on this visit.
export function useRequestNotifications({ poll = false, freeze = false } = {}) {
  const { user, isSeller } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [seenAt, setSeenAt] = useState(() => readSeen(user))

  const load = useCallback(() => {
    if (!isSeller) {
      setItems([])
      setLoading(false)
      return
    }
    requestsApi.list().then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [isSeller])

  useEffect(() => {
    if (!freeze) setSeenAt(readSeen(user))
    load()
  }, [load, user, freeze])
  usePolling(load, POLL_MS, poll && isSeller)

  // Other components (the navbar badge) listen for this to clear their count.
  useEffect(() => {
    if (freeze) return
    const sync = () => setSeenAt(readSeen(user))
    window.addEventListener('cm:requests-seen', sync)
    return () => window.removeEventListener('cm:requests-seen', sync)
  }, [user, freeze])

  const markAllSeen = useCallback(() => {
    const now = Date.now()
    try {
      localStorage.setItem(seenKey(user), String(now))
    } catch {
      // storage blocked — badge just won't remember
    }
    window.dispatchEvent(new Event('cm:requests-seen'))
  }, [user])

  const isNew = useCallback((r) => toMs(r.created_at) > seenAt, [seenAt])
  const unread = items.filter(isNew).length

  return { items, loading, unread, isNew, markAllSeen, reload: load }
}
