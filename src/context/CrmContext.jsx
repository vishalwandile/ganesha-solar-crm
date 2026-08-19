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
    permissionsLabel: formatPermissions(user),
    permissions: user.permissions || [],
  }
}

export function CrmProvider({ children }) {
  const [sessionUser, setSessionUser] = useState(null)
  const [customers, setCustomers] = useState([])
  const [customerCache, setCustomerCache] = useState({})
  const [users, setUsers] = useState([])
  const [notifications, setNotifications] = useState([])
  const [dashboard, setDashboard] = useState({ total: 0, counts: {}, recent: [] })
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState('')

  const upsertCustomerCache = useCallback((customer) => {
    if (!customer?.id) return customer
    setCustomerCache((prev) => ({ ...prev, [customer.id]: customer }))
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === customer.id)
      const summary = {
        id: customer.id,
        name: customer.name,
        consumerNumber: customer.consumerNumber,
        mobile: customer.mobile,
        solarCapacity: customer.solarCapacity,
        overallStatus: customer.overallStatus,
        createdAt: customer.createdAt,
      }
      if (idx === -1) return [summary, ...prev]
      const next = [...prev]
      next[idx] = { ...next[idx], ...summary }
      return next
    })
    return customer
  }, [])

  const refreshCustomers = useCallback(async (search = '') => {
    const data = await crmApi.listCustomers(search)
    setCustomers(data.customers || [])
    return data.customers || []
  }, [])

  const refreshNotifications = useCallback(async () => {
    const data = await crmApi.listNotifications()
    setNotifications(data.notifications || [])
    return data.notifications || []
  }, [])

  const refreshUsers = useCallback(async () => {
    const data = await crmApi.listUsers()
    const list = (data.users || []).map(normalizeUser)
    setUsers(list)
    return list
  }, [])

  const loadDashboard = useCallback(async () => {
    const [summary, activity] = await Promise.all([
      crmApi.dashboardSummary(),
      crmApi.recentActivity(8),
    ])
    const next = {
      total: summary.total || 0,
      counts: summary.counts || {},
      recent: activity.items || [],
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
        await Promise.all([refreshCustomers(), refreshNotifications(), refreshUsers()])
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
  }, [refreshCustomers, refreshNotifications, refreshUsers])

  const login = useCallback(
    async (username, password) => {
      setError('')
      const data = await crmApi.login(username, password)
      setSessionUser(normalizeUser(data.user))
      await Promise.all([refreshCustomers(), refreshNotifications(), refreshUsers()])
      return data.user
    },
    [refreshCustomers, refreshNotifications, refreshUsers]
  )

  const logout = useCallback(async () => {
    try {
      await crmApi.logout()
    } finally {
      setSessionUser(null)
      setCustomers([])
      setCustomerCache({})
      setUsers([])
      setNotifications([])
      setDashboard({ total: 0, counts: {}, recent: [] })
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
        name: form.name,
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
      }
      const { customer } = await crmApi.createCustomer(payload)
      for (const [type, file] of Object.entries(files)) {
        if (file) await crmApi.uploadDocument(customer.id, type, file)
      }
      return loadCustomer(customer.id)
    },
    [loadCustomer]
  )

  const updateOverallStatus = useCallback(
    async (id, overallStatus) => {
      const { customer } = await crmApi.updateOverallStatus(id, overallStatus)
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
      await refreshNotifications()
      return upsertCustomerCache(customer)
    },
    [upsertCustomerCache, refreshNotifications]
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
    async (customerId, type, file) => {
      await crmApi.uploadDocument(customerId, type, file)
      return loadCustomer(customerId)
    },
    [loadCustomer]
  )

  const addPhoto = useCallback(
    async (customerId, file, caption) => {
      await crmApi.uploadPhoto(customerId, file, caption)
      return loadCustomer(customerId)
    },
    [loadCustomer]
  )

  const markNotificationRead = useCallback(async (id) => {
    await crmApi.markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    await crmApi.markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const addUser = useCallback(
    async (user) => {
      await crmApi.createUser({
        name: user.name,
        username: user.username,
        password: user.password,
        team: user.team,
        isAdmin: user.team === 'Admin',
        permissions: user.permissionCategories || [],
      })
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
      customerCache,
      users,
      notifications,
      dashboard,
      login,
      logout,
      refreshCustomers,
      loadCustomer,
      loadDashboard,
      quickLookup,
      createCustomer,
      updateOverallStatus,
      updateSubStage,
      updateCategoryNotes,
      updateCategoryExtra,
      enableCategory,
      disableCategory,
      updateSubsidyMeta,
      addPayment,
      addDocument,
      addPhoto,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      refreshUsers,
      addUser,
      ApiError,
    }),
    [
      hydrated,
      error,
      sessionUser,
      customers,
      customerCache,
      users,
      notifications,
      dashboard,
      login,
      logout,
      refreshCustomers,
      loadCustomer,
      loadDashboard,
      quickLookup,
      createCustomer,
      updateOverallStatus,
      updateSubStage,
      updateCategoryNotes,
      updateCategoryExtra,
      enableCategory,
      disableCategory,
      updateSubsidyMeta,
      addPayment,
      addDocument,
      addPhoto,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      refreshUsers,
      addUser,
    ]
  )

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>
}

export function useCrm() {
  const ctx = useContext(CrmContext)
  if (!ctx) throw new Error('useCrm must be used within CrmProvider')
  return ctx
}
