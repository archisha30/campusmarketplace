// The single surface the UI talks to.
//
// Each function has two implementations: a mock one backed by src/data/sample.js,
// and a live one that calls FastAPI through http. Flip VITE_DATA_SOURCE=live in
// .env once the backend is up — no component changes needed.

import { http } from './client.js'
import * as mock from './mockApi.js'

const USE_MOCK = (import.meta.env.VITE_DATA_SOURCE || 'mock') === 'mock'

function pick(live, mocked) {
  return USE_MOCK ? mocked : live
}

export const listingsApi = {
  // GET /api/listings?category=&campus_id=&q=&sort=&listing_type=&condition=
  list: (filters = {}) => pick(() => http.get('/listings', filters), () => mock.listListings(filters))(),
  // GET /api/listings/:id
  get: (id) => pick(() => http.get(`/listings/${id}`), () => mock.getListing(id))(),
  // POST /api/listings
  create: (payload) => pick(() => http.post('/listings', payload), () => mock.createListing(payload))(),
  // PUT /api/listings/:id
  update: (id, payload) => pick(() => http.put(`/listings/${id}`, payload), () => mock.updateListing(id, payload))(),
  // DELETE /api/listings/:id
  remove: (id) => pick(() => http.del(`/listings/${id}`), () => mock.deleteListing(id))(),
  // PATCH /api/listings/:id/status  body: { status: "available" | "reserved" | "sold" }
  setStatus: (id, status) =>
    pick(() => http.patch(`/listings/${id}/status`, { status }), () => mock.setListingStatus(id, status))(),
  // POST /api/listings/:id/images  (multipart, Supabase Storage / Cloudinary on the backend)
  uploadImages: (id, files) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return pick(() => http.postForm(`/listings/${id}/images`, fd), () => mock.uploadImages(id, files))()
  },
  // GET /api/listings/recommended?category_scores=&exclude_id=&campus_id=
  // Content-based: server would score by the same category-affinity signal the
  // client tracks locally, plus same-campus boost and recency. See lib/recommendations.js.
  recommended: ({ excludeId, campusId, categoryScores } = {}) =>
    pick(
      () => http.get('/listings/recommended', { exclude_id: excludeId, campus_id: campusId, category_scores: JSON.stringify(categoryScores || {}) }),
      () => mock.getRecommendations({ excludeId, campusId, categoryScores })
    )(),
}

export const resourcesApi = {
  list: (filters = {}) => pick(() => http.get('/resources', filters), () => mock.listResources(filters))(),
  get: (id) => pick(() => http.get(`/resources/${id}`), () => mock.getResource(id))(),
  create: (payload) => pick(() => http.post('/resources', payload), () => mock.createResource(payload))(),
  markHelpful: (id) =>
    pick(() => http.post(`/resources/${id}/helpful`), () => mock.markHelpful(id))(),
}

export const reportsApi = {
  // POST /api/reports  body: { listing_id, resource_id, reason }
  create: (payload) => pick(() => http.post('/reports', payload), () => mock.createReport(payload))(),
}

export const authApi = {
  // POST /api/auth/signup  body: { email }  -> sends OTP / magic link
  signup: (email) => pick(() => http.post('/auth/signup', { email }), () => mock.signup(email))(),
  // POST /api/auth/login  body: { email, otp }
  login: (email, otp) => pick(() => http.post('/auth/login', { email, otp }), () => mock.login(email, otp))(),
  // POST /api/auth/profile — completes onboarding (name, college, course, year)
  completeProfile: (payload) =>
    pick(() => http.post('/auth/profile', payload), () => mock.completeProfile(payload))(),
  // GET /api/users/me
  me: () => pick(() => http.get('/users/me'), () => mock.me())(),
  logout: () => {
    localStorage.removeItem('cm_token')
    return Promise.resolve()
  },
}

export const campusesApi = {
  list: () => pick(() => http.get('/campuses'), () => mock.listCampuses())(),
}

export const adminApi = {
  reports: () => pick(() => http.get('/admin/reports'), () => mock.adminReports())(),
  // PATCH /api/admin/reports/:id  body: { action: "hide" | "delete" | "dismiss" }
  resolveReport: (id, action) =>
    pick(() => http.patch(`/admin/reports/${id}`, { action }), () => mock.resolveReport(id, action))(),
  users: () => pick(() => http.get('/admin/users'), () => mock.adminUsers())(),
  // PATCH /api/admin/users/:id  body: { status: "active" | "suspended" | "banned" }
  setUserStatus: (id, status) =>
    pick(() => http.patch(`/admin/users/${id}`, { status }), () => mock.setUserStatus(id, status))(),
  domains: () => pick(() => http.get('/admin/domains'), () => mock.adminDomains())(),
  addDomain: (payload) => pick(() => http.post('/admin/domains', payload), () => mock.addDomain(payload))(),
  toggleDomain: (id, is_active) =>
    pick(() => http.patch(`/admin/domains/${id}`, { is_active }), () => mock.toggleDomain(id, is_active))(),
  removeDomain: (id) => pick(() => http.del(`/admin/domains/${id}`), () => mock.removeDomain(id))(),
}
