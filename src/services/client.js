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

function authHeader() {
  const token = localStorage.getItem('cm_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, { method = 'GET', body, params, isForm } = {}) {
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
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader(),
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null
  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    // FastAPI returns { detail: ... } for HTTPException and validation errors.
    const detail = payload?.detail
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(', ')
          : 'Something went wrong. Try again.'
    throw new ApiError(message, res.status, detail)
  }
  return payload
}

export const http = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  postForm: (path, formData) => request(path, { method: 'POST', body: formData, isForm: true }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
}
