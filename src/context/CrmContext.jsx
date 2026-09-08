import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { crmApi } from '../api/crmApi'
import { getToken, setToken, ApiError } from '../api/client'

const CrmContext = createContext(null)

function formatPermissions(user) {
  if (user.isAdmin) return 'All categories'
  const perms = user.permissions || []
  if (!perms.length) return 'View only'
  return (
    perms
      .filter((p) => p.canEdit)
      .map((p) => p.category)
      .join(', ') || 'View only'
  )
}

function normalizeUser(user) {
  if (!user) return null
  return {
    ...user,
    isAdmin: Boolean(user.isAdmin),
    team: user.team,
    features: user.isAdmin ? user.features || [] : user.features || [],
    permissionsLabel: formatPermissions(user),
    permissions: user.permissions || [],
  }
}

export function CrmProvider({ children }) {
  const [sessionUser, setSessionUser] = useState(null)
  const [customers, setCustomers] = useState([])
  const [customerPagination, setCustomerPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  })
  const [customerCache, setCustomerCache] = useState({})
  const [users, setUsers] = useState([])
  const [dashboard, setDashboard] = useState({
    total: 0,
    inactive: 0,
    counts: {},
    pipeline: [],
  })
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState('')

  const upsertCustomerCache = useCallback((customer) => {
    if (!customer?.id) return customer
    setCustomerCache((prev) => ({
      ...prev,
      [customer.id]: { ...(prev[customer.id] || {}), ...customer },
    }))
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === customer.id)
      const summary = {
        id: customer.id,
        name: customer.name,
        firstName: customer.firstName,
        middleName: customer.middleName,
        lastName: customer.lastName,
        consumerNumber: customer.consumerNumber,
        mobile: customer.mobile,
        solarCapacity: customer.solarCapacity,
        overallStatus: customer.overallStatus,
        isActive: customer.isActive,
        createdAt: customer.createdAt,
      }
      if (idx === -1) return [summary, ...prev]
      const next = [...prev]
      next[idx] = { ...next[idx], ...summary }
      return next
    })
    return customer
  }, [])

  const refreshCustomers = useCallback(async (search = '', page = 1, pageSize = 10, filters = {}) => {
    const data = await crmApi.listCustomers(search, page, pageSize, filters)
    setCustomers(data.customers || [])
    setCustomerPagination(
      data.pagination || { page, pageSize, total: data.customers?.length || 0, totalPages: 1 }
    )
    return data.customers || []
  }, [])

  const refreshUsers = useCallback(async () => {
    const data = await crmApi.listUsers()
    const list = (data.users || []).map(normalizeUser)
    setUsers(list)
    return list
  }, [])

  const loadDashboard = useCallback(async () => {
    const summary = await crmApi.dashboardSummary()
    const next = {
      total: summary.total || 0,
      inactive: summary.inactive || 0,
      counts: summary.counts || {},
      pipeline: summary.pipeline || [],
    }
    setDashboard(next)
    return next
  }, [])

  const loadCustomer = useCallback(
    async (id) => {
      const data = await crmApi.getCustomer(id)
      return upsertCustomerCache(data.customer)
    },
    [upsertCustomerCache]
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!getToken()) {
        if (alive) setHydrated(true)
        return
      }
      try {
        const { user } = await crmApi.me()
        if (!alive) return
        setSessionUser(normalizeUser(user))
      } catch {
        setToken(null)
        if (alive) setSessionUser(null)
      } finally {
        if (alive) setHydrated(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(
    async (username, password) => {
      setError('')
      const data = await crmApi.login(username, password)
      setSessionUser(normalizeUser(data.user))
      return data.user
    },
    []
  )

  const logout = useCallback(async () => {
    try {
      await crmApi.logout()
    } finally {
      setSessionUser(null)
      setCustomers([])
      setCustomerPagination({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
      setCustomerCache({})
      setUsers([])
      setDashboard({ total: 0, inactive: 0, counts: {}, pipeline: [] })
    }
  }, [])

  const quickLookup = useCallback(
    async (query) => {
      const data = await crmApi.quickLookup(query)
      if (data.customer) upsertCustomerCache(data.customer)
      return data.customer
    },
    [upsertCustomerCache]
  )

  const createCustomer = useCallback(
    async (form, files = {}) => {
      const payload = {
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        consumerNumber: form.consumerNumber,
        mobile: form.mobile,
        email: form.email,
        address: form.address,
        village: form.village,
        taluka: form.taluka,
        district: form.district,
        pin: form.pin,
        electricityConnectionNo: form.electricityConnectionNo,
        solarCapacity: form.solarCapacity,
        solarModule: form.solarModule,
        inverter: form.inverter,
        totalDue: form.totalDue ? Number(form.totalDue) : undefined,
        enableNameChange: Boolean(form.enableNameChange),
        enableFinance: Boolean(form.enableFinance),
      }
      const { customer } = await crmApi.createCustomer(payload)
      for (const [type, file] of Object.entries(files)) {
        if (!file) continue
        if (type === 'Other' && typeof file === 'object' && file.file) {
          await crmApi.uploadDocument(customer.id, 'Other', file.file, file.name)
        } else if (file instanceof File) {
          await crmApi.uploadDocument(customer.id, type, file)
        }
      }
      return loadCustomer(customer.id)
    },
    [loadCustomer]
  )

  const setCustomerActive = useCallback(
    async (id, isActive) => {
      const { customer } = await crmApi.setCustomerActive(id, isActive)
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache]
  )

  const updateCustomer = useCallback(
    async (id, payload) => {
      const { customer } = await crmApi.updateCustomer(id, payload)
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache]
  )

  const saveCategory = useCallback(
    async (customerId, categoryKey, payload) => {
      const { customer } = await crmApi.saveCategory(
        customerId,
        categoryKey,
        payload
      )
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache]
  )

  const updateSubStage = useCallback(
    async (customerId, categoryKey, subKey, value, rejectionReason) => {
      const { customer } = await crmApi.updateSubStage(
        customerId,
        categoryKey,
        subKey,
        value,
        rejectionReason
      )
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache]
  )

  const updateCategoryNotes = useCallback(
    async (customerId, categoryKey, notes) => {
      const { customer } = await crmApi.updateCategoryNotes(customerId, categoryKey, notes)
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache]
  )

  const updateCategoryExtra = useCallback(
    async (customerId, categoryKey, extra) => {
      const { customer } = await crmApi.updateCategoryExtra(customerId, categoryKey, extra)
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache]
  )

  const enableCategory = useCallback(
    async (customerId, categoryKey) => {
      const { customer } = await crmApi.enableCategory(customerId, categoryKey)
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache]
  )

  const disableCategory = useCallback(
    async (customerId, categoryKey) => {
      const { customer } = await crmApi.disableCategory(customerId, categoryKey)
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache]
  )

  const updateSubsidyMeta = useCallback(
    async (customerId, fields) => {
      const { customer } = await crmApi.updateSubsidy(customerId, fields)
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache]
  )

  const addPayment = useCallback(
    async (customerId, payment) => {
      await crmApi.addPayment(customerId, payment)
      return loadCustomer(customerId)
    },
    [loadCustomer]
  )

  const addDocument = useCallback(
    async (customerId, type, file, customName = '') => {
      await crmApi.uploadDocument(customerId, type, file, customName)
      return loadCustomer(customerId)
    },
    [loadCustomer]
  )

  const deleteDocument = useCallback(
    async (customerId, documentId) => {
      await crmApi.deleteDocument(customerId, documentId)
      return loadCustomer(customerId)
    },
    [loadCustomer]
  )

  const addUser = useCallback(
    async (user) => {
      await crmApi.createUser({
        name: user.name,
        username: user.username,
        password: user.password,
        mobile: user.mobile,
        team: user.team,
        isAdmin: user.team === 'Admin',
        permissions: user.permissionCategories || [],
        features: user.features || [],
      })
      return refreshUsers()
    },
    [refreshUsers]
  )

  const deleteUser = useCallback(
    async (id) => {
      await crmApi.deleteUser(id)
      return refreshUsers()
    },
    [refreshUsers]
  )

  const updateUserAccess = useCallback(
    async (id, payload) => {
      await crmApi.updateUserAccess(id, payload)
      return refreshUsers()
    },
    [refreshUsers]
  )

  const value = useMemo(
    () => ({
      hydrated,
      error,
      setError,
      sessionUser,
      customers,
      customerPagination,
      customerCache,
      users,
      dashboard,
      login,
      logout,
      refreshCustomers,
      loadCustomer,
      loadDashboard,
      quickLookup,
      createCustomer,
      updateCustomer,
      setCustomerActive,
      saveCategory,
      updateSubStage,
      updateCategoryNotes,
      updateCategoryExtra,
      enableCategory,
      disableCategory,
      updateSubsidyMeta,
      addPayment,
      addDocument,
      deleteDocument,
      refreshUsers,
      addUser,
      updateUserAccess,
      deleteUser,
      ApiError,
    }),
    [
      hydrated,
      error,
      sessionUser,
      customers,
      customerPagination,
      customerCache,
      users,
      dashboard,
      login,
      logout,
      refreshCustomers,
      loadCustomer,
      loadDashboard,
      quickLookup,
      createCustomer,
      updateCustomer,
      setCustomerActive,
      saveCategory,
      updateSubStage,
      updateCategoryNotes,
      updateCategoryExtra,
      enableCategory,
      disableCategory,
      updateSubsidyMeta,
      addPayment,
      addDocument,
      deleteDocument,
      refreshUsers,
      addUser,
      updateUserAccess,
      deleteUser,
    ]
  )

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>
}

export function useCrm() {
  const ctx = useContext(CrmContext)
  if (!ctx) throw new Error('useCrm must be used within CrmProvider')
  return ctx
}
