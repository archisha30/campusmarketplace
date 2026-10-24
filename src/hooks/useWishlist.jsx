import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { wishlistApi } from '../services/api.js'
import { useAuth } from './useAuth.jsx'
import { useToast } from './useToast.jsx'

const WishlistContext = createContext(null)

// Saved listings live on the server (/api/wishlist), so they're the same on every device.
// The heart updates straight away and the request follows; if it fails, it's undone.
// Older versions kept the list in this browser's storage: it's moved to the account once.
const legacyKeys = (user) => [`cm_wishlist_${user.id}`, 'cm_wishlist_guest']

function takeLegacyIds(user) {
  const ids = []
  for (const key of legacyKeys(user)) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]')
      if (Array.isArray(saved)) saved.forEach((l) => Number.isInteger(l?.id) && ids.push(l.id))
    } catch {
      // unreadable: nothing to move
    }
  }
  return [...new Set(ids)]
}

function forgetLegacy(user) {
  for (const key of legacyKeys(user)) {
    try { localStorage.removeItem(key) } catch { /* blocked storage */ }
  }
}

export function WishlistProvider({ children }) {
  const { user } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const canSave = Boolean(user?.verified && !user?.needs_password)

  useEffect(() => {
    setItems([])
    if (!canSave) return
    let cancelled = false
    setLoading(true)
    const legacy = takeLegacyIds(user)
    const load = legacy.length ? wishlistApi.importIds(legacy).then((list) => { forgetLegacy(user); return list }) : wishlistApi.list()
    load
      .then((list) => { if (!cancelled) setItems(list || []) })
      .catch(() => {}) // the hearts just show empty; saving still works
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, canSave])

  const isSaved = useCallback((id) => items.some((l) => l.id === id), [items])

  const remove = useCallback((id) => {
    const before = itemsRef.current
    setItems(before.filter((l) => l.id !== id))
    wishlistApi.remove(id).catch((err) => {
      setItems(before)
      toast(err.message || "Couldn't update your wishlist")
    })
  }, [toast])

  // Returns true when the listing is now saved (for the "Saved" / "Removed" toast).
  const toggle = useCallback((listing) => {
    const before = itemsRef.current
    if (before.some((l) => l.id === listing.id)) {
      remove(listing.id)
      return false
    }
    setItems([listing, ...before])
    wishlistApi.save(listing.id).catch((err) => {
      setItems(before)
      toast(err.message || "Couldn't update your wishlist")
    })
    return true
  }, [remove, toast])

  const value = { items, loading, count: items.length, isSaved, toggle, remove }

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider')
  return ctx
}
