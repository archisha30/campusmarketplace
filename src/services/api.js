// The single surface the UI talks to.
//
// Each function has two implementations: a mock one backed by src/data/sample.js,
// and a live one that calls FastAPI through http. Flip VITE_DATA_SOURCE=live in
// .env once the backend is up — no component changes needed.

import { http } from './client.js'
import * as mock from './mockApi.js'

const USE_MOCK = (import.meta.env.VITE_DATA_SOURCE || 'mock') === 'mock'
export const IS_MOCK = USE_MOCK

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
  // onlyCategories: restrict to these categories (used by "Picked for you" with the student's interests)
  recommended: ({ excludeId, campusId, categoryScores, onlyCategories } = {}) =>
    pick(
      () => http.get('/listings/recommended', {
        exclude_id: excludeId,
        campus_id: campusId,
        category_scores: JSON.stringify(categoryScores || {}),
        only_categories: onlyCategories?.length ? JSON.stringify(onlyCategories) : undefined,
      }),
      () => mock.getRecommendations({ excludeId, campusId, categoryScores, onlyCategories })
    )(),
}

// Create / update are multipart so the PDF is validated in the same request:
// a bad file means nothing is created. `file` is optional (sample or full PDF).
function resourceForm(payload, file, removeFile) {
  const fd = new FormData()
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null) fd.append(k, v)
  })
  if (file) fd.append('file', file)
  if (removeFile) fd.append('remove_file', 'true')
  return fd
}

export const resourcesApi = {
  // GET /api/resources?q=&subject=&year=&copy_type=&offer_type=&sort=&mine=
  list: (filters = {}) => pick(() => http.get('/resources', filters), () => mock.listResources(filters))(),
  // GET /api/resources/recommended?subject_scores=&year=&exclude_id= -> { items, personalized }
  recommended: ({ excludeId, year, subjectScores } = {}) =>
    pick(
      () => http.get('/resources/recommended', { exclude_id: excludeId, year, subject_scores: JSON.stringify(subjectScores || {}) }),
      () => mock.recommendedResources({ excludeId, year, subjectScores })
    )(),
  // GET /api/resources/facets -> { subjects: [...] }
  facets: () => pick(() => http.get('/resources/facets'), () => mock.resourceFacets())(),
  // GET /api/resources/:id  (access, drive_url, file_url and contact depend on the viewer)
  get: (id) => pick(() => http.get(`/resources/${id}`), () => mock.getResource(id))(),
  // POST /api/resources  (multipart)
  create: (payload, file) =>
    pick(() => http.postForm('/resources', resourceForm(payload, file)), () => mock.createResource(payload, file))(),
  // PUT /api/resources/:id  (multipart; a new file replaces the old one)
  update: (id, payload, file, removeFile = false) =>
    pick(
      () => http.putForm(`/resources/${id}`, resourceForm(payload, file, removeFile)),
      () => mock.updateResource(id, payload, file, removeFile)
    )(),
  // DELETE /api/resources/:id
  remove: (id) => pick(() => http.del(`/resources/${id}`), () => mock.deleteResource(id))(),
  // PATCH /api/resources/:id/status  body: { status: "available" | "closed" }
  setStatus: (id, status) =>
    pick(() => http.patch(`/resources/${id}/status`, { status }), () => mock.setResourceStatus(id, status))(),
  // POST /api/resources/:id/access  body: { note }
  requestAccess: (id, note) =>
    pick(() => http.post(`/resources/${id}/access`, { note }), () => mock.requestResourceAccess(id, note))(),
  // GET /api/resources/:id/access  (owner / admin)
  accessRequests: (id) =>
    pick(() => http.get(`/resources/${id}/access`), () => mock.listResourceAccess(id))(),
  // PATCH /api/resources/:id/access/:requestId  body: { status: "approved" | "denied" }
  decideAccess: (id, requestId, status) =>
    pick(
      () => http.patch(`/resources/${id}/access/${requestId}`, { status }),
      () => mock.decideResourceAccess(id, requestId, status)
    )(),
  // GET /api/resources/:id/file -> Blob. Fetched with the auth header, never a plain link.
  file: (id) => pick(() => http.getBlob(`/resources/${id}/file`), () => mock.getResourceFile(id))(),
}

export const reportsApi = {
  // POST /api/reports  body: { listing_id | resource_id, reason, details? }  (seller is notified anonymously)
  create: (payload) => pick(() => http.post('/reports', payload), () => mock.createReport(payload))(),
}

export const authApi = {
  // POST /api/auth/signup  body: { email, account_type }  -> emails a code (nothing is created yet)
  signup: (email, accountType = 'buyer') =>
    pick(() => http.post('/auth/signup', { email, account_type: accountType }), () => mock.signup(email, accountType))(),
  // POST /api/auth/signup/verify  body: { email, otp, account_type, password, confirm_password } -> { user } + cookie
  signupVerify: (payload) =>
    pick(() => http.post('/auth/signup/verify', payload), () => mock.signupVerify(payload))(),
  // POST /api/auth/google  body: { credential, account_type } -> { user, created } + cookie.
  //   One tap with the student's college Google account; account_type only used for new accounts.
  googleSignIn: (credential, accountType = 'buyer') =>
    pick(
      () => http.post('/auth/google', { credential, account_type: accountType }),
      () => mock.googleSignIn(credential, accountType)
    )(),
  // POST /api/auth/login  body: { email, password } -> { user } + HttpOnly session cookie.
  //   Same "Invalid email or password" for every failure (accounts without a password included:
  //   they use Forgot password to create their first one).
  login: (email, password) =>
    pick(() => http.post('/auth/login', { email, password }), () => mock.login(email, password))(),
  // POST /api/auth/set-password  body: { password, confirm_password } -> { user } + fresh cookie (only when none is set yet)
  setPassword: (password, confirmPassword) =>
    pick(
      () => http.post('/auth/set-password', { password, confirm_password: confirmPassword }),
      () => mock.setPassword(password, confirmPassword)
    )(),
  // POST /api/auth/password/forgot  body: { email }  -> emails a reset code (same answer either way)
  forgotPassword: (email) =>
    pick(() => http.post('/auth/password/forgot', { email }), () => mock.forgotPassword(email))(),
  // POST /api/auth/password/reset  body: { email, otp, password, confirm_password } -> { user } + cookie
  resetPassword: (payload) =>
    pick(() => http.post('/auth/password/reset', payload), () => mock.resetPassword(payload))(),
  // POST /api/auth/profile — completes onboarding (name, college, course, year)
  completeProfile: (payload) =>
    pick(() => http.post('/auth/profile', payload), () => mock.completeProfile(payload))(),
  // POST /api/auth/interests  body: { interests: ["Textbooks", ...] }
  saveInterests: (interests) =>
    pick(() => http.post('/auth/interests', { interests }), () => mock.saveInterests(interests))(),
  // POST /api/auth/account-type  body: { account_type: "seller" }  (buyer -> seller upgrade)
  setAccountType: (accountType) =>
    pick(() => http.post('/auth/account-type', { account_type: accountType }), () => mock.setAccountType(accountType))(),
  // PATCH /api/users/me  body: any of { name, college, course, year, phone }
  updateProfile: (payload) => pick(() => http.patch('/users/me', payload), () => mock.updateProfile(payload))(),
  // POST /api/users/me/avatar  (multipart, field "file")
  uploadAvatar: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return pick(() => http.postForm('/users/me/avatar', fd), () => mock.uploadAvatar(file))()
  },
  // DELETE /api/users/me/avatar
  removeAvatar: () => pick(() => http.del('/users/me/avatar'), () => mock.removeAvatar())(),
  // POST /api/users/me/views  body: { views: [{ kind: "listing" | "resource", key }] }  (recommendation history)
  recordViews: (views) => pick(() => http.post('/users/me/views', { views }), () => mock.recordViews(views))(),
  // POST /api/auth/refresh -> { user } + cookie: renews a valid session for another 30 days
  refreshSession: () => pick(() => http.post('/auth/refresh'), () => mock.refreshSession())(),
  // Older versions kept the session in browser storage; swap it for the HttpOnly cookie once.
  migrateStoredSession: (token) =>
    pick(() => http.post('/auth/refresh', undefined, { headers: { Authorization: `Bearer ${token}` } }), () => mock.refreshSession())(),
  // GET /api/users/me
  me: () => pick(() => http.get('/users/me'), () => mock.me())(),
  // POST /api/auth/logout: clears the session cookie
  logout: () => pick(() => http.post('/auth/logout'), () => mock.logout())(),

}

export const requestsApi = {
  // POST /api/requests  body: { product, description }  (each max 70 chars)
  create: (payload) => pick(() => http.post('/requests', payload), () => mock.createRequest(payload))(),
  // GET /api/requests/mine  — requests the current user posted
  mine: () => pick(() => http.get('/requests/mine'), () => mock.myRequests())(),
  // GET /api/requests  — sellers' notification feed
  list: () => pick(() => http.get('/requests'), () => mock.listRequests())(),
  // DELETE /api/requests/:id
  remove: (id) => pick(() => http.del(`/requests/${id}`), () => mock.deleteRequest(id))(),
}

export const notificationsApi = {
  // GET /api/notifications -> { items, unread }  (access requests + contact taps on your items)
  list: () => pick(() => http.get('/notifications'), () => mock.listNotifications())(),
  // POST /api/notifications/read-all
  markAllRead: () => pick(() => http.post('/notifications/read-all'), () => mock.markNotificationsRead())(),
  // DELETE /api/notifications/:id  (dismiss one)
  dismiss: (id) => pick(() => http.del(`/notifications/${id}`), () => mock.dismissNotification(id))(),
  // DELETE /api/notifications  (clear all)
  clearAll: () => pick(() => http.del('/notifications'), () => mock.clearNotifications())(),
}

export const contactApi = {
  // POST /api/contact  body: { target_type: "listing" | "resource" | "request", target_id, channel }
  //   -> { name, phone | email }  ONE person's contact, logged + rate-limited (never in page data)
  reveal: (targetType, targetId, channel) =>
    pick(
      () => http.post('/contact', { target_type: targetType, target_id: targetId, channel }),
      () => mock.revealContact(targetType, targetId, channel)
    )(),
}

export const campusesApi = {
  list: () => pick(() => http.get('/campuses'), () => mock.listCampuses())(),
}

// Admin dashboard. Owners (OWNER_EMAILS) and the admins they approve; the backend enforces it.
export const adminApi = {
  // GET /api/admin/users?q=  -> { items, total }  every user, with listing/resource counts
  //   All admin lists are paged (25 per page) and include site-wide counts for the summary cards.
  users: (q, page = 1) => pick(() => http.get('/admin/users', { q, page }), () => mock.adminUsers(q, page))(),
  // PATCH /api/admin/users/:id/admin  body: { is_admin }  (owners only)
  setAdmin: (id, isAdmin) =>
    pick(() => http.patch(`/admin/users/${id}/admin`, { is_admin: isAdmin }), () => mock.setAdmin(id, isAdmin))(),
  // GET /api/admin/listings?q=  -> every listing, including reserved and sold
  listings: (q, page = 1) => pick(() => http.get('/admin/listings', { q, page }), () => mock.adminListings(q, page))(),
  // DELETE /api/admin/listings/:id  (moderation; resources use resourcesApi.remove, which admins may call)
  deleteListing: (id) => pick(() => http.del(`/admin/listings/${id}`), () => mock.deleteListing(id))(),
  // GET /api/admin/resources?q=  -> every resource, including closed, with owner contact
  resources: (q, page = 1) => pick(() => http.get('/admin/resources', { q, page }), () => mock.adminResources(q, page))(),
  // GET /api/admin/reports?status=open|resolved  -> { items, open }  (includes who reported)
  reports: (status, page = 1) => pick(() => http.get('/admin/reports', { status, page }), () => mock.adminReports(status, page))(),
  // PATCH /api/admin/reports/:id  body: { status: "open" | "resolved" }
  setReportStatus: (id, status) =>
    pick(() => http.patch(`/admin/reports/${id}`, { status }), () => mock.setReportStatus(id, status))(),
}
