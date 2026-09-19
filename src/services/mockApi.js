// In-memory stand-in for the FastAPI backend. Every function returns a promise
// with a small delay so the loading and skeleton states are real, not decorative.
// Delete this file once the backend is live; api.js is the only importer.

import * as seed from '../data/sample.js'

let listings = structuredClone(seed.listings)
let resources = structuredClone(seed.resources)
let reports = structuredClone(seed.reports)
let users = structuredClone(seed.users)
let campuses = structuredClone(seed.campuses)
let nextId = 100

const delay = (value, ms = 350) => new Promise((r) => setTimeout(() => r(structuredClone(value)), ms))

export function getRecommendations({ excludeId, campusId, categoryScores = {} } = {}) {
  const hasAffinity = Object.keys(categoryScores).length > 0
  let pool = listings.filter((l) => l.status === 'available' && l.id !== Number(excludeId))

  const scored = pool.map((l) => {
    let score = categoryScores[l.category] || 0
    if (campusId && l.campus_id === Number(campusId)) score += 0.5 // mild same-campus boost
    score += l.id / 1000 // tiny recency nudge so ties favor newer listings
    return { listing: l, score }
  })

  scored.sort((a, b) => b.score - a.score)

  const items = scored.slice(0, 8).map((s) => s.listing)
  return delay({ items, personalized: hasAffinity }, 300)
}

export function listListings(f = {}) {
  let out = listings.filter((l) => l.status !== 'sold' || f.include_sold)
  if (f.category && f.category !== 'All') out = out.filter((l) => l.category === f.category)
  if (f.q) out = out.filter((l) => l.title.toLowerCase().includes(f.q.toLowerCase()))
  if (f.condition && f.condition !== 'any') out = out.filter((l) => l.condition === f.condition)
  if (f.listing_type && f.listing_type !== 'any') out = out.filter((l) => l.listing_type === f.listing_type)
  if (f.campus_id) out = out.filter((l) => l.campus_id === Number(f.campus_id))
  if (f.max_price) out = out.filter((l) => l.price <= Number(f.max_price))
  if (f.min_price) out = out.filter((l) => l.price >= Number(f.min_price))
  if (f.seller_id) out = out.filter((l) => l.seller.id === Number(f.seller_id))
  if (f.status) out = out.filter((l) => l.status === f.status)

  if (f.sort === 'price_asc') out.sort((a, b) => a.price - b.price)
  else if (f.sort === 'price_desc') out.sort((a, b) => b.price - a.price)
  else out.sort((a, b) => b.id - a.id)

  return delay({ items: out, total: out.length })
}

export function getListing(id) {
  const found = listings.find((l) => l.id === Number(id))
  return found ? delay(found) : Promise.reject(new Error('Listing not found'))
}

export function createListing(payload) {
  const art = {
    Textbooks: { emoji: '📘', bg: '#F1EAFF' }, 'Lab Gear': { emoji: '📐', bg: '#EAF0FF' },
    Electronics: { emoji: '🔌', bg: '#EAFBF0' }, 'Dorm Essentials': { emoji: '🛏️', bg: '#FFECEA' },
    'Project Kits': { emoji: '🧰', bg: '#FFF3D6' }, Sports: { emoji: '🏸', bg: '#FFF0F5' },
    'Clothing & Event Wear': { emoji: '🧥', bg: '#FFF6E0' },
  }[payload.category] || { emoji: '📦', bg: '#EFEFEC' }

  const item = {
    ...payload,
    id: nextId++,
    status: 'available',
    created_at: new Date().toISOString().slice(0, 10),
    campus_id: seed.currentUser.campus_id,
    seller: { id: seed.currentUser.id, name: seed.currentUser.name, campus: seed.currentUser.campus, verified: true },
    art,
  }
  listings.unshift(item)
  return delay(item, 500)
}

export function updateListing(id, payload) {
  listings = listings.map((l) => (l.id === Number(id) ? { ...l, ...payload } : l))
  return getListing(id)
}

export function setListingStatus(id, status) {
  listings = listings.map((l) => (l.id === Number(id) ? { ...l, status } : l))
  return getListing(id)
}

export function deleteListing(id) {
  listings = listings.filter((l) => l.id !== Number(id))
  return delay(null)
}

export function uploadImages(id, files) {
  return delay({ listing_id: Number(id), uploaded: files.length })
}

export function listResources(f = {}) {
  let out = [...resources]
  if (f.q) {
    const q = f.q.toLowerCase()
    out = out.filter((r) => `${r.title} ${r.course_code} ${r.department}`.toLowerCase().includes(q))
  }
  if (f.department && f.department !== 'All') out = out.filter((r) => r.department === f.department)
  if (f.semester && f.semester !== 'All') out = out.filter((r) => r.semester === f.semester)
  if (f.category && f.category !== 'All') out = out.filter((r) => r.category === f.category)
  return delay({ items: out, total: out.length })
}

export function getResource(id) {
  const found = resources.find((r) => r.id === Number(id))
  return found ? delay(found) : Promise.reject(new Error('Resource not found'))
}

export function createResource(payload) {
  const item = { ...payload, id: nextId++, helpful_count: 0, contributor: { ...seed.currentUser, verified: true } }
  resources.unshift(item)
  return delay(item)
}

export function markHelpful(id) {
  resources = resources.map((r) => (r.id === Number(id) ? { ...r, helpful_count: r.helpful_count + 1 } : r))
  return getResource(id)
}

export function createReport(payload) {
  reports.unshift({
    id: nextId++,
    ...payload,
    reporter: seed.currentUser.name,
    created_at: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    status: 'open',
  })
  return delay({ ok: true })
}

export function signup(email) {
  const domain = email.split('@')[1]
  const campus = campuses.find((c) => c.email_domain === domain && c.is_active)
  if (!campus) {
    return Promise.reject(new Error('That domain is not an approved campus yet. Ask your admin to add it.'))
  }
  return delay({ ok: true, message: 'Magic link sent. Check your college inbox.' })
}

export function login(email) {
  localStorage.setItem('cm_token', 'mock-token')
  return delay({ token: 'mock-token', user: seed.currentUser })
}

export function completeProfile(payload) {
  return delay({ ...seed.currentUser, ...payload })
}

export function me() {
  return localStorage.getItem('cm_token') ? delay(seed.currentUser, 150) : Promise.resolve(null)
}

export function listCampuses() { return delay(campuses) }

export function adminReports() { return delay(reports) }
export function resolveReport(id, action) {
  if (action === 'delete') {
    const r = reports.find((x) => x.id === Number(id))
    if (r) listings = listings.filter((l) => l.id !== r.listing_id)
  }
  reports = reports.filter((r) => r.id !== Number(id))
  return delay(reports)
}
export function adminUsers() { return delay(users) }
export function setUserStatus(id, status) {
  users = users.map((u) => (u.id === Number(id) ? { ...u, status } : u))
  return delay(users)
}
export function adminDomains() { return delay(campuses) }
export function addDomain(payload) {
  campuses.push({ id: nextId++, is_active: true, ...payload })
  return delay(campuses)
}
export function toggleDomain(id, is_active) {
  campuses = campuses.map((c) => (c.id === Number(id) ? { ...c, is_active } : c))
  return delay(campuses)
}
export function removeDomain(id) {
  campuses = campuses.filter((c) => c.id !== Number(id))
  return delay(campuses)
}
