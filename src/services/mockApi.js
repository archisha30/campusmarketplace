// In-memory stand-in for the FastAPI backend. Every function returns a promise
// with a small delay so the loading and skeleton states are real, not decorative.
// Delete this file once the backend is live; api.js is the only importer.

import * as seed from '../data/sample.js'
import { DESCRIPTION_MAX, NOTE_MAX, SUBJECTS, canonicalSubject, isAllowedDriveUrl } from '../lib/resources.js'

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
  // Expired food leaves the marketplace; the seller's own view still shows it.
  const today = new Date().toISOString().slice(0, 10)
  if (!f.seller_id) out = out.filter((l) => !l.expiry_date || l.expiry_date >= today)

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
    'F&B': { emoji: '🍱', bg: '#FFF1E0' },
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
  const urls = files.map((f) => URL.createObjectURL(f))
  listings = listings.map((l) =>
    l.id === Number(id) ? { ...l, images: [...(l.images || []), ...urls].slice(0, 3) } : l
  )
  return getListing(id)
}

// ---------- Resource Hub ----------
// Same response shapes as campusmarket-backend/app/api/routes/resources.py, including the
// access matrix. Preview pages are generated placeholders, not real document pages.

const resourceFiles = new Map() // id -> File uploaded in this session
let resourceAccess = [
  {
    id: 1, resource_id: 1, user_id: 2, status: 'pending', note: 'Paid ₹40 on UPI, ref 4471',
    created_at: new Date(Date.now() - 2 * 3600e3).toISOString(), updated_at: new Date(Date.now() - 2 * 3600e3).toISOString(),
    decided_at: null,
    requester: { id: '2', name: 'Rhea M.', avatar_url: null, verified: true, campus: 'Polaris Campus', phone: null, email: 'rhea@polaris.edu' },
  },
]

const mockViewer = () => (localStorage.getItem('cm_token') ? seed.currentUser : null)
const sameId = (a, b) => String(a) === String(b)
const nowIso = () => new Date().toISOString()

function placeholderPage(r, n, kind) {
  const lines = Array.from({ length: 16 }, (_, i) =>
    `<rect x="40" y="${110 + i * 26}" width="${170 + ((i * 37 + n * 23) % 130)}" height="9" rx="4" fill="#C9CBD3"/>`
  ).join('')
  const title = n === 1 ? `<text x="40" y="70" font-family="sans-serif" font-size="17" font-weight="700" fill="#15181F">${
    r.title.replace(/[<&>]/g, '').slice(0, 34)
  }</text>` : ''
  const body = kind === 'blurred'
    ? `<g filter="url(#b)">${title}${lines}</g>`
    : kind === 'partial'
      ? `${title}<clipPath id="t"><rect width="360" height="255"/></clipPath><clipPath id="l"><rect y="255" width="360" height="255"/></clipPath><g clip-path="url(#t)">${lines}</g><g clip-path="url(#l)" filter="url(#b)">${lines}</g>`
      : `${title}${lines}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="510" viewBox="0 0 360 510"><defs><filter id="b"><feGaussianBlur stdDeviation="8"/></filter></defs><rect width="360" height="510" fill="#fff"/>${body}<text x="320" y="490" font-family="sans-serif" font-size="11" fill="#8A8F9B">${n}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function previewKinds(r) {
  if (!r.has_file) return []
  const halfBlur = r.copy_type === 'soft' && r.delivery === 'pdf' && r.offer_type === 'sale'
  if (halfBlur && r.page_count === 1) return ['partial']
  return ['sharp', ...Array(Math.max(0, Math.min(r.page_count, 4) - 1)).fill('blurred')]
}

function mockResourceAccess(r, u) {
  const req = u ? resourceAccess.find((a) => a.resource_id === r.id && sameId(a.user_id, u.id)) : null
  const request = req ? { ...req, requester: null } : null
  if (u && sameId(r.owner.id, u.id)) return { full: true, reason: 'owner', can_request: false, request: null }
  if (u?.role === 'admin') return { full: true, reason: 'admin', can_request: false, request: null }
  if (!u) return { full: false, reason: 'guest', can_request: false, request: null }
  if (!u.verified) return { full: false, reason: 'unverified', can_request: false, request: null }
  if (req?.status === 'approved') return { full: true, reason: 'granted', can_request: false, request }
  if (r.status === 'closed') return { full: false, reason: 'closed', can_request: false, request }
  if (r.offer_type === 'free') return { full: true, reason: 'free', can_request: false, request: null }
  return { full: false, reason: 'locked', can_request: !req || req.status === 'denied', request }
}

function resourceOut(r, detail = false) {
  const preview_pages = previewKinds(r).map((kind, i) => ({ url: placeholderPage(r, i + 1, kind), kind }))
  const { phone, email, ...publicOwner } = r.owner
  const out = {
    id: r.id, title: r.title, subject: r.subject, year: r.year, copy_type: r.copy_type,
    offer_type: r.offer_type, price: r.price, description: r.description || null, status: r.status,
    delivery: r.delivery || null, pickup_spot: r.pickup_spot || null, has_file: Boolean(r.has_file),
    page_count: r.page_count ?? null, preview_pages, thumbnail_url: preview_pages[0]?.url || null,
    created_at: r.created_at, updated_at: r.updated_at,
    owner: { ...publicOwner, phone: null, email: null },
    access: null, drive_url: null, file_url: null, upi_id: null, pending_requests: null,
  }
  if (!detail) return out
  const u = mockViewer()
  const signedIn = Boolean(u?.verified)
  const access = mockResourceAccess(r, u)
  out.access = access
  if (signedIn) out.owner = { ...publicOwner, phone: phone || null, email: email || null }
  out.upi_id = signedIn ? r.upi_id || null : null
  if (access.full) {
    out.drive_url = r.drive_url || null
    out.file_url = r.has_file ? `/api/resources/${r.id}/file` : null
  }
  if (access.reason === 'owner' || access.reason === 'admin') {
    out.pending_requests = resourceAccess.filter((a) => a.resource_id === r.id && a.status === 'pending').length
  }
  return out
}

function findResource(id) {
  const r = resources.find((x) => x.id === Number(id))
  if (!r) throw new Error('Resource not found')
  return r
}

function ownResource(id) {
  const r = findResource(id)
  const u = mockViewer()
  if (!u || (!sameId(r.owner.id, u.id) && u.role !== 'admin')) throw new Error("You don't own this resource")
  return r
}

async function mockPageCount(file) {
  try {
    const text = await file.text()
    return (text.match(/\/Type\s*\/Page(?!s)/g) || []).length || 1
  } catch {
    return 1
  }
}

// Mirrors the backend's form rules so mock mode rejects the same input.
function cleanResourcePayload(p, hasFile) {
  const d = { ...p }
  d.title = (d.title || '').trim()
  d.subject = canonicalSubject(d.subject || '')
  if (!d.title || !d.subject) throw new Error('Title and subject are required')
  if ((d.description || '').length > DESCRIPTION_MAX) throw new Error(`Description must be ${DESCRIPTION_MAX} characters or fewer`)
  if (d.offer_type === 'sale') {
    if (!/^\d+$/.test(String(d.price)) || Number(d.price) < 1) throw new Error('A sale needs a whole-rupee price of at least ₹1')
    d.price = Number(d.price)
  } else {
    d.price = 0
  }
  if (d.copy_type === 'soft') {
    d.pickup_spot = null
    if (d.delivery === 'drive') {
      if (!isAllowedDriveUrl(d.drive_url || '')) {
        throw new Error('Drive links must be https and on Google Drive/Docs, OneDrive, SharePoint, Dropbox or Mega')
      }
      if (!hasFile) throw new Error('Drive links need a sample PDF so students can preview it')
    } else {
      d.delivery = 'pdf'
      d.drive_url = null
      if (!hasFile) throw new Error("Upload the PDF you're sharing")
    }
  } else {
    if (!(d.pickup_spot || '').trim()) throw new Error('Hard copies need a pickup spot')
    d.delivery = null
    d.drive_url = null
  }
  return d
}

export function listResources(f = {}) {
  const u = mockViewer()
  let out = f.mine
    ? resources.filter((r) => u && sameId(r.owner.id, u.id))
    : resources.filter((r) => r.status === 'available')
  if (f.q) {
    const q = f.q.toLowerCase()
    out = out.filter((r) => `${r.title} ${r.subject} ${r.description || ''}`.toLowerCase().includes(q))
  }
  if (f.subject && f.subject !== 'All') out = out.filter((r) => r.subject.toLowerCase() === f.subject.toLowerCase())
  if (['1', '2', '3', '4'].includes(f.year)) out = out.filter((r) => r.year === f.year || r.year === 'any')
  if (['soft', 'hard'].includes(f.copy_type)) out = out.filter((r) => r.copy_type === f.copy_type)
  if (['sale', 'free'].includes(f.offer_type)) out = out.filter((r) => r.offer_type === f.offer_type)

  if (f.sort === 'price_low') out.sort((a, b) => a.price - b.price)
  else if (f.sort === 'price_high') out.sort((a, b) => b.price - a.price)
  else out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  return delay({ items: out.map((r) => resourceOut(r)), total: out.length })
}

export function recommendedResources({ excludeId, year, subjectScores = {} } = {}) {
  const scores = Object.fromEntries(Object.entries(subjectScores).map(([k, v]) => [k.toLowerCase(), v]))
  const pool = resources
    .filter((r) => r.status === 'available' && r.id !== Number(excludeId))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const score = (r) => (scores[r.subject.toLowerCase()] || 0) + (year && r.year === year ? 0.5 : 0)
  const items = [...pool].sort((a, b) => score(b) - score(a)).slice(0, 8).map((r) => resourceOut(r))
  return delay({ items, personalized: Object.keys(scores).length > 0 }, 300)
}

export function resourceFacets() {
  const standard = new Set(SUBJECTS.map((s) => s.toLowerCase()))
  const extra = new Map()
  resources.filter((r) => r.status === 'available').forEach((r) => {
    const key = r.subject.toLowerCase()
    if (!standard.has(key) && !extra.has(key)) extra.set(key, r.subject)
  })
  return delay({ subjects: [...SUBJECTS, ...[...extra.values()].sort((a, b) => a.localeCompare(b))] }, 150)
}

export function getResource(id) {
  try {
    return delay(resourceOut(findResource(id), true))
  } catch (err) {
    return Promise.reject(err)
  }
}

export async function createResource(payload, file) {
  const d = cleanResourcePayload(payload, Boolean(file))
  const u = seed.currentUser
  const item = {
    ...d, id: nextId++, status: 'available', has_file: Boolean(file),
    page_count: file ? await mockPageCount(file) : null, created_at: nowIso(), updated_at: nowIso(),
    owner: { id: u.id, name: u.name, campus: u.campus, verified: true, avatar_url: u.avatar_url || null, phone: u.phone || null, email: u.email },
  }
  if (file) resourceFiles.set(item.id, file)
  resources.unshift(item)
  return delay(resourceOut(item, true), 500)
}

export async function updateResource(id, payload, file, removeFile) {
  const r = ownResource(id)
  const keepsFile = r.has_file && !removeFile
  const d = cleanResourcePayload(payload, Boolean(file) || keepsFile)
  Object.assign(r, d, { updated_at: nowIso() })
  if (file) {
    resourceFiles.set(r.id, file)
    r.has_file = true
    r.page_count = await mockPageCount(file)
  } else if (removeFile) {
    resourceFiles.delete(r.id)
    r.has_file = false
    r.page_count = null
  }
  return delay(resourceOut(r, true), 500)
}

export function deleteResource(id) {
  try {
    ownResource(id)
  } catch (err) {
    return Promise.reject(err)
  }
  resources = resources.filter((r) => r.id !== Number(id))
  resourceAccess = resourceAccess.filter((a) => a.resource_id !== Number(id))
  resourceFiles.delete(Number(id))
  return delay(null)
}

export function setResourceStatus(id, status) {
  try {
    const r = ownResource(id)
    r.status = status
    return delay(resourceOut(r, true))
  } catch (err) {
    return Promise.reject(err)
  }
}

export function requestResourceAccess(id, note) {
  const u = mockViewer()
  try {
    const r = findResource(id)
    if (!u) throw new Error('Log in to request access')
    if (sameId(r.owner.id, u.id)) throw new Error('This is your own resource')
    if (r.offer_type === 'free') throw new Error('This resource is free, no request needed')
    if (r.status === 'closed') throw new Error('The owner has closed this resource')
    let req = resourceAccess.find((a) => a.resource_id === r.id && sameId(a.user_id, u.id))
    if (req?.status === 'approved') throw new Error('You already have access')
    if (req?.status === 'pending') throw new Error('Your request is already waiting for the owner')
    const cleanNote = (note || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX) || null
    if (req) {
      Object.assign(req, { status: 'pending', note: cleanNote, decided_at: null, updated_at: nowIso() })
    } else {
      req = {
        id: nextId++, resource_id: r.id, user_id: u.id, status: 'pending', note: cleanNote,
        created_at: nowIso(), updated_at: nowIso(), decided_at: null,
        requester: { id: String(u.id), name: u.name, avatar_url: u.avatar_url || null, verified: true, campus: u.campus, phone: u.phone || null, email: u.email },
      }
      resourceAccess.push(req)
    }
    pushNotification({ user_id: r.owner.id, actor: u, type: 'access_request', target_type: 'resource', target_id: r.id, target_title: r.title, note: cleanNote })
    return delay({ ...req, requester: null })
  } catch (err) {
    return Promise.reject(err)
  }
}

export function listResourceAccess(id) {
  try {
    const r = ownResource(id)
    const order = { pending: 0, approved: 1, denied: 2 }
    const rows = resourceAccess
      .filter((a) => a.resource_id === r.id)
      .sort((a, b) => order[a.status] - order[b.status] || b.updated_at.localeCompare(a.updated_at))
    return delay(rows)
  } catch (err) {
    return Promise.reject(err)
  }
}

export function decideResourceAccess(id, requestId, status) {
  try {
    const r = ownResource(id)
    const req = resourceAccess.find((a) => a.id === Number(requestId) && a.resource_id === r.id)
    if (!req) throw new Error('Request not found')
    Object.assign(req, { status, decided_at: nowIso(), updated_at: nowIso() })
    return delay(req)
  } catch (err) {
    return Promise.reject(err)
  }
}

// A tiny valid one-page PDF so "Open PDF" works in mock mode.
function mockPdf(title) {
  const text = `CampusMarket mock file: ${title}`.replace(/[^\x20-\x7E]/g, '-').replace(/[()\\]/g, '')
  const stream = `BT /F1 16 Tf 60 720 Td (${text}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([out], { type: 'application/pdf' })
}

export function getResourceFile(id) {
  try {
    const r = findResource(id)
    if (!mockResourceAccess(r, mockViewer()).full) throw new Error("You don't have access to this file yet")
    if (!r.has_file) throw new Error('This resource has no file')
    const blob = resourceFiles.get(r.id) || mockPdf(r.title)
    return new Promise((res) => setTimeout(() => res(blob), 300))
  } catch (err) {
    return Promise.reject(err)
  }
}

// ---------- Notifications ----------

let notifications = [
  {
    id: 1, user_id: 1, type: 'access_request', channel: null, target_type: 'resource', target_id: 1,
    target_title: 'DSA — Past Year Questions', note: 'Paid ₹40 on UPI, ref 4471',
    created_at: new Date(Date.now() - 2 * 3600e3).toISOString(), read: false,
    actor: { id: '2', name: 'Rhea M.', avatar_url: null, email: 'rhea@polaris.edu', phone: null },
  },
  {
    id: 2, user_id: 1, type: 'contact', channel: 'whatsapp', target_type: 'listing', target_id: 2,
    target_title: 'Casio fx-991CW', note: null,
    created_at: new Date(Date.now() - 26 * 3600e3).toISOString(), read: true,
    actor: { id: '3', name: 'Dev S.', avatar_url: null, email: 'dev@northgate.edu', phone: '919000000003' },
  },
]

function pushNotification({ user_id, actor, ...rest }) {
  if (sameId(user_id, actor.id)) return
  notifications.unshift({
    id: nextId++, user_id, channel: null, note: null, ...rest, created_at: nowIso(), read: false,
    actor: { id: String(actor.id), name: actor.name, avatar_url: actor.avatar_url || null, email: actor.email, phone: actor.phone || null },
  })
}

export function listNotifications() {
  const u = mockViewer()
  if (!u) return Promise.reject(new Error('Log in to see notifications'))
  const items = notifications
    .filter((n) => sameId(n.user_id, u.id))
    // Reports are anonymous to the seller, like the real API.
    .map(({ user_id, ...n }) => (n.type === 'report' ? { ...n, actor: { id: '', name: 'A student', avatar_url: null, email: '', phone: null } } : n))
  return delay({ items, unread: items.filter((n) => !n.read).length }, 200)
}

export function markNotificationsRead() {
  const u = mockViewer()
  notifications = notifications.map((n) => (u && sameId(n.user_id, u.id) ? { ...n, read: true } : n))
  return delay(null, 100)
}

export function recordContact(targetType, targetId, channel) {
  const u = mockViewer()
  if (!u) return Promise.resolve(null)
  const target = targetType === 'listing'
    ? listings.find((l) => l.id === Number(targetId))
    : resources.find((r) => r.id === Number(targetId))
  if (target) {
    const ownerId = targetType === 'listing' ? target.seller.id : target.owner.id
    pushNotification({ user_id: ownerId, actor: u, type: 'contact', channel, target_type: targetType, target_id: target.id, target_title: target.title })
  }
  return delay(null, 100)
}

// Mirrors POST /api/reports: one report per person per item, seller notified anonymously.
export function createReport({ listing_id, resource_id, reason, details }) {
  const u = mockViewer()
  if (!u) return Promise.reject(new Error('Log in to report'))
  const isListing = listing_id != null
  const target = isListing
    ? listings.find((l) => l.id === Number(listing_id))
    : resources.find((r) => r.id === Number(resource_id))
  if (!target) return Promise.reject(new Error('That item no longer exists'))
  const owner = isListing ? target.seller : target.owner
  if (sameId(owner.id, u.id)) return Promise.reject(new Error("You can't report your own item"))
  const targetType = isListing ? 'listing' : 'resource'
  if (reports.some((r) => r.target_type === targetType && r.target_id === target.id && sameId(r.reporter.id, u.id))) {
    return Promise.reject(new Error("You've already reported this. Our team will review it."))
  }
  reports.unshift({
    id: nextId++, target_type: targetType, target_id: target.id, target_title: target.title, target_exists: true,
    reason, details: details || null, status: 'open', created_at: nowIso(), resolved_at: null, reports_on_item: 1,
    reporter: { id: String(u.id), name: u.name, email: u.email },
    owner: { id: String(owner.id), name: owner.name, email: owner.email || '' },
  })
  pushNotification({ user_id: owner.id, actor: u, type: 'report', target_type: targetType, target_id: target.id, target_title: target.title, note: reason })
  return delay({ ok: true })
}

export function adminReports(status) {
  const counts = {}
  reports.forEach((r) => { counts[`${r.target_type}:${r.target_id}`] = (counts[`${r.target_type}:${r.target_id}`] || 0) + 1 })
  const items = reports
    .filter((r) => !status || r.status === status)
    .map((r) => ({ ...r, reports_on_item: counts[`${r.target_type}:${r.target_id}`] }))
  return delay({ items, open: reports.filter((r) => r.status === 'open').length })
}

export function setReportStatus(id, status) {
  reports = reports.map((r) => (r.id === Number(id) ? { ...r, status, resolved_at: status === 'resolved' ? nowIso() : null } : r))
  return delay(null)
}

export function signup(email, accountType = 'buyer') {
  const domain = email.split('@')[1]
  const campus = campuses.find((c) => c.email_domain === domain && c.is_active)
  if (!campus) {
    return Promise.reject(new Error('That domain is not an approved campus yet. Ask your admin to add it.'))
  }
  seed.currentUser.account_type = accountType
  return delay({ ok: true, message: 'Magic link sent. Check your college inbox.' })
}

export function requestLoginCode(email) {
  const domain = email.split('@')[1]
  if (!campuses.some((c) => c.email_domain === domain && c.is_active)) {
    return Promise.reject(new Error('That domain is not an approved campus yet. Ask your admin to add it.'))
  }
  return delay({ ok: true, message: 'Code sent' })
}

export function login(email) {
  localStorage.setItem('cm_token', 'mock-token')
  return delay({ token: 'mock-token', user: seed.currentUser })
}

export function completeProfile(payload) {
  const digits = String(payload.phone || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')
  if (!/^[6-9]\d{9}$/.test(digits)) return Promise.reject(new Error('Enter your WhatsApp number'))
  Object.assign(seed.currentUser, payload, { phone: `91${digits}`, profile_completed: true })
  return delay(seed.currentUser)
}

export function saveInterests(interests) {
  seed.currentUser.interests = interests
  return delay(seed.currentUser)
}

export function setAccountType(accountType) {
  seed.currentUser.account_type = accountType
  return delay(seed.currentUser)
}

export function updateProfile(payload) {
  Object.assign(seed.currentUser, payload)
  return delay(seed.currentUser)
}

export function uploadAvatar(file) {
  seed.currentUser.avatar_url = URL.createObjectURL(file)
  return delay(seed.currentUser)
}

export function removeAvatar() {
  seed.currentUser.avatar_url = null
  return delay(seed.currentUser)
}

export function recordViews(views) {
  const now = Date.now()
  seed.currentUser.view_history = [...(seed.currentUser.view_history || []), ...views.map((v) => ({ ...v, ts: now }))].slice(-50)
  return delay(null, 50)
}

export function me() {
  return localStorage.getItem('cm_token') ? delay(seed.currentUser, 150) : Promise.resolve(null)
}

let productRequests = [
  {
    id: 1, product: 'Casio fx-991CW calculator', description: 'Need it for tomorrow\'s exam, can rent too',
    created_at: new Date(Date.now() - 3600e3).toISOString(),
    requester: { id: '2', name: 'Rhea M.', email: 'rhea@polaris.edu', phone: null, avatar_url: null },
  },
]

export function createRequest({ product, description }) {
  const u = seed.currentUser
  const req = {
    id: nextId++, product, description: description || null, created_at: new Date().toISOString(),
    requester: { id: String(u.id), name: u.name, email: u.email, phone: u.phone || null, avatar_url: u.avatar_url || null },
  }
  productRequests = [req, ...productRequests]
  return delay(req)
}

export function listRequests() {
  return delay(productRequests.filter((r) => r.requester.id !== String(seed.currentUser.id)))
}

export function myRequests() {
  return delay(productRequests.filter((r) => r.requester.id === String(seed.currentUser.id)))
}

export function deleteRequest(id) {
  productRequests = productRequests.filter((r) => r.id !== Number(id))
  return delay(null)
}

export function listCampuses() { return delay(campuses) }

// ---------- Admin (same shapes as campusmarket-backend/app/api/routes/admin.py) ----------

function adminUserOut(u) {
  const owner = Boolean(u.is_owner)
  return {
    id: String(u.id), email: u.email, name: u.name || null, avatar_url: u.avatar_url || null, college: u.college || null,
    course: u.course || null, year: u.year || null, phone: u.phone || null,
    account_type: u.account_type || 'buyer', is_admin: owner || u.role === 'admin', is_owner: owner,
    verified: u.status !== 'unverified', profile_completed: true, created_at: u.created_at || '2026-09-01T10:00:00',
    listings: listings.filter((l) => sameId(l.seller.id, u.id)).length,
    resources: resources.filter((r) => sameId(r.owner.id, u.id)).length,
  }
}

export function adminUsers(q = '') {
  const needle = (q || '').toLowerCase()
  // In mock mode the seeded current user is the owner.
  const all = users.map((u) => (sameId(u.id, seed.currentUser.id) ? { ...u, is_owner: true } : u))
  const items = all.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(needle)).map(adminUserOut)
  return delay({ items, total: items.length })
}

export function setAdmin(id, isAdmin) {
  const u = users.find((x) => sameId(x.id, id))
  if (!u) return Promise.reject(new Error('User not found'))
  if (sameId(u.id, seed.currentUser.id)) return Promise.reject(new Error('Owners are always admins'))
  u.role = isAdmin ? 'admin' : 'student'
  return delay(adminUserOut(u))
}

export function adminListings(q = '') {
  const needle = (q || '').toLowerCase()
  const items = listings.filter((l) => l.title.toLowerCase().includes(needle)).sort((a, b) => b.id - a.id)
  return delay({ items, total: items.length })
}

export function adminResources(q = '') {
  const needle = (q || '').toLowerCase()
  const items = resources
    .filter((r) => `${r.title} ${r.subject}`.toLowerCase().includes(needle))
    .map((r) => ({ ...resourceOut(r), owner: r.owner }))
  return delay({ items, total: items.length })
}
