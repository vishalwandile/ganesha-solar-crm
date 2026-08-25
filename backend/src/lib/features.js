export const FEATURE_KEYS = [
  'dashboard',
  'customers',
  'createCustomer',
  'statusTracking',
  'pmSuryaghar',
  'documents',
  'payments',
  'photos',
  'history',
  'notifications',
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
  photos: 'Photos',
  history: 'History',
  notifications: 'Notifications',
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
    'photos',
    'history',
    'notifications',
  ],
  Sales: ['dashboard', 'customers', 'createCustomer', 'notifications'],
  Account: ['dashboard', 'customers', 'statusTracking', 'payments', 'notifications'],
  Loan: ['dashboard', 'customers', 'statusTracking', 'payments', 'notifications'],
  Installation: ['dashboard', 'customers', 'statusTracking', 'photos', 'notifications'],
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
  if (!hasFeature(user, 'photos')) next.photos = []
  if (!hasFeature(user, 'history')) next.history = []
  return next
}
