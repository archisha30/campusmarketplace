// Thin fetch wrapper. Every network call goes through here, so auth headers,
// error shape, and the base URL live in exactly one place.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// The session is an HttpOnly cookie the browser sends by itself (page scripts can't read it).
// Every request also carries this header; the API refuses cookie-authenticated changes without
// it, which stops other websites from forging requests (CSRF).
const CSRF_HEADERS = { 'X-Requested-With': 'CampusMarket' }

async function request(path, { method = 'GET', body, params, isForm, asBlob, headers = {} } = {}) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'any' && v !== 'All') {
        url.searchParams.set(k, v)
      }
    })
  }

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...CSRF_HEADERS,
      ...headers,
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null
  if (asBlob && res.ok) return res.blob()
  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    // FastAPI returns { detail: ... } for HTTPException and validation errors.
    const detail = payload?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => String(d.msg).replace(/^Value error, /, '')).join(', ')
          : detail?.message || 'Something went wrong. Try again.' // { code, message } errors, e.g. password_not_set
    // An admin suspended this account: every request now fails, so log out everywhere at once.
    if (detail?.code === 'account_suspended') {
      window.dispatchEvent(new CustomEvent('cm:account-suspended', { detail: message }))
    }
    throw new ApiError(message, res.status, detail)
  }
  return payload
}

export const http = {
  get: (path, params) => request(path, { params }),
  post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  postForm: (path, formData) => request(path, { method: 'POST', body: formData, isForm: true }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  putForm: (path, formData) => request(path, { method: 'PUT', body: formData, isForm: true }),
  // Binary download with the auth header (e.g. a protected PDF). Errors still come back as JSON.
  getBlob: (path) => request(path, { asBlob: true }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
}
