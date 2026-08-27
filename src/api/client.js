const API_BASE = (import.meta.env.VITE_API_URL || 'https://ganesha-solar-crm.onrender.com').replace(
  /\/$/,
  ''
)

const TOKEN_KEY = 'gss_token'
let pendingRequests = 0
const loadingListeners = new Set()

function notifyLoading() {
  loadingListeners.forEach((listener) => listener(pendingRequests > 0))
}

export function subscribeToApiLoading(listener) {
  loadingListeners.add(listener)
  listener(pendingRequests > 0)
  return () => loadingListeners.delete(listener)
}

function beginRequest() {
  pendingRequests += 1
  notifyLoading()
}

function endRequest() {
  pendingRequests = Math.max(0, pendingRequests - 1)
  notifyLoading()
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getApiUrl(path = '') {
  return `${API_BASE}${path}`
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export async function apiRequest(path, options = {}) {
  beginRequest()
  try {
    const headers = new Headers(options.headers || {})
    const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData

    if (!isForm && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      body:
        options.body && !isForm && typeof options.body === 'object'
          ? JSON.stringify(options.body)
          : options.body,
    })

    const contentType = res.headers.get('content-type') || ''
    const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : null

    if (!res.ok) {
      throw new ApiError(data?.error || res.statusText || 'Request failed', res.status, data?.details)
    }

    return data
  } finally {
    endRequest()
  }
}
