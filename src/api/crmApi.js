import { apiBlob, apiRequest, setToken } from './client.js'

export const crmApi = {
  login(username, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password },
    }).then((data) => {
      setToken(data.token)
      return data
    })
  },

  logout() {
    return apiRequest('/auth/logout', { method: 'POST' }).finally(() => setToken(null))
  },

  me() {
    return apiRequest('/auth/me')
  },

  dashboardSummary() {
    return apiRequest('/api/dashboard/summary')
  },

  categoryDefinitions() {
    return apiRequest('/api/customers/meta/categories')
  },

  listCustomers(search = '', page = 1, pageSize = 10, filters = {}) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) params.set('search', search)
    if (filters.queue) params.set('queue', filters.queue)
    if (filters.subStage) params.set('subStage', filters.subStage)
    if (filters.status) params.set('status', filters.status)
    return apiRequest(`/api/customers?${params}`)
  },

  quickLookup(query) {
    return apiRequest(`/api/customers/quick-lookup?query=${encodeURIComponent(query)}`)
  },

  getCustomer(id) {
    return apiRequest(`/api/customers/${id}`)
  },

  createCustomer(payload) {
    return apiRequest('/api/customers', { method: 'POST', body: payload })
  },

  updateCustomer(id, payload) {
    return apiRequest(`/api/customers/${id}`, { method: 'PATCH', body: payload })
  },

  setCustomerActive(id, isActive) {
    return apiRequest(`/api/customers/${id}/active`, {
      method: 'PATCH',
      body: { isActive },
    })
  },

  saveCategory(id, category, payload) {
    return apiRequest(`/api/customers/${id}/categories/${category}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  updateSubStage(id, category, subStageKey, value, rejectionReason) {
    return apiRequest(`/api/customers/${id}/categories/${category}/sub-stages/${subStageKey}`, {
      method: 'PATCH',
      body: { value, rejectionReason },
    })
  },

  updateCategoryNotes(id, category, notes) {
    return apiRequest(`/api/customers/${id}/categories/${category}/notes`, {
      method: 'PATCH',
      body: { notes },
    })
  },

  updateCategoryExtra(id, category, extra) {
    return apiRequest(`/api/customers/${id}/categories/${category}/extra`, {
      method: 'PATCH',
      body: extra,
    })
  },

  enableCategory(id, category) {
    return apiRequest(`/api/customers/${id}/categories/${category}/enable`, { method: 'POST' })
  },

  disableCategory(id, category) {
    return apiRequest(`/api/customers/${id}/categories/${category}/disable`, { method: 'POST' })
  },

  updateSubsidy(id, payload) {
    return apiRequest(`/api/customers/${id}/pm-suryaghar/subsidy`, {
      method: 'PATCH',
      body: payload,
    })
  },

  addPayment(id, payment) {
    return apiRequest(`/api/customers/${id}/payments`, { method: 'POST', body: payment })
  },

  uploadDocument(id, type, file, customName = '') {
    const form = new FormData()
    form.append('type', type)
    if (customName) form.append('customName', customName)
    form.append('file', file)
    return apiRequest(`/api/customers/${id}/documents`, { method: 'POST', body: form })
  },

  deleteDocument(customerId, documentId) {
    return apiRequest(`/api/customers/${customerId}/documents/${documentId}`, {
      method: 'DELETE',
    })
  },

  fetchDocumentBlob(customerId, documentId, mode = 'view') {
    return apiBlob(`/api/customers/${customerId}/documents/${documentId}/${mode}`)
  },

  listUsers() {
    return apiRequest('/api/users')
  },

  createUser(payload) {
    return apiRequest('/api/users', { method: 'POST', body: payload })
  },

  deleteUser(id) {
    return apiRequest(`/api/users/${id}`, { method: 'DELETE' })
  },

  updateUserAccess(id, payload) {
    return apiRequest(`/api/users/${id}/access`, { method: 'PATCH', body: payload })
  },

}
