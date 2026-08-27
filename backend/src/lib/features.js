export const FEATURE_KEYS = [
  'dashboard',
  'customers',
  'createCustomer',
  'statusTracking',
  'pmSuryaghar',
  'documents',
  'payments',
  'users',
  'inactiveCustomer',
]

export const FEATURE_LABELS = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  createCustomer: 'Add customer',
  statusTracking: 'Status tracking',
  pmSuryaghar: 'PM Suryaghar',
  documents: 'Documents',
  payments: 'Payments',
  users: 'Users & teams',
  inactiveCustomer: 'Mark customer inactive',
}

const TEAM_DEFAULTS = {
  Admin: FEATURE_KEYS,
  Office: [
    'dashboard',
    'customers',
    'createCustomer',
    'statusTracking',
    'pmSuryaghar',
    'documents',
  ],
  Sales: ['dashboard', 'customers', 'createCustomer'],
  Account: ['dashboard', 'customers', 'statusTracking', 'payments'],
  Loan: ['dashboard', 'customers', 'statusTracking', 'payments'],
  Installation: ['dashboard', 'customers', 'statusTracking', 'documents'],
}

export function defaultFeaturesForTeam(team) {
  return [...(TEAM_DEFAULTS[team] || TEAM_DEFAULTS.Sales)]
}

export function sanitizeFeatures(features) {
  const allowed = new Set(FEATURE_KEYS)
  return [...new Set((features || []).filter((key) => allowed.has(key)))]
}

export function resolveFeatures(user) {
  if (!user) return []
  if (user.is_admin || user.isAdmin) return [...FEATURE_KEYS]
  return sanitizeFeatures(user.features)
}

export function hasFeature(user, key) {
  return resolveFeatures(user).includes(key)
}

export function redactCustomer(customer, user) {
  if (!customer) return customer
  const next = { ...customer }
  if (!hasFeature(user, 'payments')) {
    next.payments = []
    next.totalPaid = 0
  }
  if (!hasFeature(user, 'documents')) next.documents = []
  return next
}
