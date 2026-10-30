import { useCallback, useEffect, useState } from 'react'
import { notificationsApi } from '../services/api.js'
import { useAuth } from './useAuth.jsx'
import { usePolling } from './usePolling.js'

const POLL_MS = 60_000

// Personal notifications for every logged-in student: for buyers, answers to their access
// requests; for sellers also access requests, WhatsApp / Email taps and reports on their
// items; and updates from the CampusMarket team. Read state lives on the server, so it's
// the same on every device.
//
// `freeze` keeps each item's read flag from when the page loaded, so the dashboard
// can mark everything read (clearing the navbar badge) and still highlight what was new.
export function useNotifications({ poll = false, freeze = false } = {}) {
  const { user, needsPassword } = useAuth()
  // Accounts that still have to create a password get 403 from everything, so don't ask.
  const active = Boolean(user) && !needsPassword
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!active) {
      setItems([])
      setUnread(0)
      setLoading(false)
      return
    }
    notificationsApi
      .list()
      .then((res) => {
        setItems(res.items)
        setUnread(res.unread)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [active])

  useEffect(() => {
    load()
  }, [load])
  usePolling(load, POLL_MS, poll && active)

  // The navbar badge listens for this so it clears as soon as the dashboard marks things read.
  useEffect(() => {
    if (freeze) return
    window.addEventListener('cm:notifications-read', load)
    return () => window.removeEventListener('cm:notifications-read', load)
  }, [load, freeze])

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead()
    } catch {
      return
    }
    if (!freeze) setUnread(0)
    window.dispatchEvent(new Event('cm:notifications-read'))
  }, [freeze])

  // Dismissing removes items here straight away, then tells the navbar badge to refresh.
  const dismiss = useCallback(async (id) => {
    await notificationsApi.dismiss(id)
    setItems((list) => list.filter((n) => n.id !== id))
    window.dispatchEvent(new Event('cm:notifications-read'))
  }, [])

  const clearAll = useCallback(async () => {
    await notificationsApi.clearAll()
    setItems([])
    setUnread(0)
    window.dispatchEvent(new Event('cm:notifications-read'))
  }, [])

  return { items, unread, loading, markAllRead, dismiss, clearAll, reload: load }
}
