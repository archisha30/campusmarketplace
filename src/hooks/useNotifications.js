import { useCallback, useEffect, useState } from 'react'
import { notificationsApi } from '../services/api.js'
import { useAuth } from './useAuth.jsx'

const POLL_MS = 60_000

// Personal notifications for item owners: access requests on their resources and
// WhatsApp / Email taps on their listings and resources. Read state lives on the
// server, so it's the same on every device.
//
// `freeze` keeps each item's read flag from when the page loaded, so the dashboard
// can mark everything read (clearing the navbar badge) and still highlight what was new.
export function useNotifications({ poll = false, freeze = false } = {}) {
  const { user, isSeller } = useAuth()
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!user || !isSeller) {
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
  }, [user, isSeller])

  useEffect(() => {
    load()
    if (!poll || !user || !isSeller) return
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load, poll, user, isSeller])

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

  return { items, unread, loading, markAllRead, reload: load }
}

// Fire-and-forget: tell the owner someone tapped WhatsApp / Email on their item.
// Only for logged-in, verified students; never blocks the link from opening.
export function recordContact(user, targetType, targetId, channel) {
  if (!user?.verified) return
  notificationsApi.contact(targetType, targetId, channel).catch(() => {})
}
