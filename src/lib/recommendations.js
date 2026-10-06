// Lightweight, content-based recommendation signal — no ML model. We remember which
// listing categories and resource subjects a student actually opens and use that as an
// affinity score. This is intentionally simple: a real, explainable heuristic
// (content-based filtering on category/subject + recency), not a black box.
//
// History is kept in localStorage per user (fast, works offline) and, when logged in,
// also saved to the account (POST /users/me/views) so it follows the student across
// devices. On login, the account's history is merged with anything browsed as a guest.

import { authApi } from '../services/api.js'

const LEGACY_KEY = 'cm_view_history' // pre-sync format: [{ category, campus_id, ts }]
const MAX_HISTORY = 50
// Chosen interests give a new student relevant listings before they have browsed anything.
// Worth roughly one or two recent views, so real browsing quickly takes over.
const INTEREST_WEIGHT = 2

const storageKey = (userId) => `cm_view_history_${userId || 'guest'}`

function read(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]')
    // Old entries were listing categories only.
    return raw.map((e) => (e.kind ? e : { kind: 'listing', key: e.category, ts: e.ts })).filter((e) => e.key)
  } catch {
    return []
  }
}

function write(userId, history) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(history.slice(-MAX_HISTORY)))
  } catch {
    // localStorage can throw in private browsing — recommendations just fall back silently.
  }
}

export function readHistory(userId) {
  return read(storageKey(userId))
}

function recordView(user, kind, key) {
  if (!key) return
  write(user?.id, [...readHistory(user?.id), { kind, key, ts: Date.now() }])
  if (user) authApi.recordViews([{ kind, key }]).catch(() => {})
}

export const recordListingView = (user, listing) => recordView(user, 'listing', listing?.category)
export const recordResourceView = (user, resource) => recordView(user, 'resource', resource?.subject)

// Called once a user is known (page load or login): merge the account's history with
// anything browsed as a guest on this device, and upload the guest views to the account.
export function syncHistory(user) {
  if (!user?.id) return
  const guest = [...read(LEGACY_KEY), ...readHistory(null)]
  const merged = [...(user.view_history || []), ...guest].sort((a, b) => (a.ts || 0) - (b.ts || 0))
  write(user.id, merged)
  if (guest.length) {
    authApi.recordViews(guest.slice(-MAX_HISTORY).map(({ kind, key }) => ({ kind, key }))).catch(() => {})
    try {
      localStorage.removeItem(LEGACY_KEY)
      localStorage.removeItem(storageKey(null))
    } catch {
      // ignore
    }
  }
}

// Returns { hasHistory, scores } for one kind ("listing" → categories, "resource" →
// subjects). More recent views count for more, so picks shift as interest shifts.
export function affinity(user, kind, interests = []) {
  const history = readHistory(user?.id).filter((e) => e.kind === kind)
  const scores = {}
  interests.forEach((c) => {
    scores[c] = (scores[c] || 0) + INTEREST_WEIGHT
  })
  history.forEach((entry, i) => {
    const recencyWeight = 1 + i / history.length // later entries weigh slightly more
    scores[entry.key] = (scores[entry.key] || 0) + recencyWeight
  })
  return { hasHistory: history.length > 0 || interests.length > 0, scores }
}
