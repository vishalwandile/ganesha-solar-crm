export const FEATURES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'customers', label: 'Customers' },
  { key: 'createCustomer', label: 'Add customer' },
  { key: 'statusTracking', label: 'Status tracking' },
  { key: 'pmSuryaghar', label: 'PM Suryaghar' },
  { key: 'documents', label: 'Documents' },
  { key: 'payments', label: 'Payments' },
  { key: 'photos', label: 'Photos' },
  { key: 'history', label: 'History' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'users', label: 'Users & teams' },
  { key: 'inactiveCustomer', label: 'Mark customer inactive' },
]

export const ALL_FEATURE_KEYS = FEATURES.map((feature) => feature.key)

export function hasFeature(user, key) {
  if (!user) return false
  if (user.isAdmin) return true
  return (user.features || []).includes(key)
}

export function firstAllowedPath(user) {
  if (hasFeature(user, 'dashboard')) return '/'
  if (hasFeature(user, 'customers')) return '/customers'
  if (hasFeature(user, 'notifications')) return '/notifications'
  if (hasFeature(user, 'users')) return '/users'
  return '/'
}

export function defaultFeaturesForTeam(team) {
  if (team === 'Admin') return [...ALL_FEATURE_KEYS]
  if (team === 'Office') {
    return [
      'dashboard',
      'customers',
      'createCustomer',
      'statusTracking',
      'pmSuryaghar',
      'documents',
      'photos',
      'history',
      'notifications',
    ]
  }
  if (team === 'Account' || team === 'Loan') {
    return ['dashboard', 'customers', 'statusTracking', 'payments', 'notifications']
  }
  if (team === 'Installation') {
    return ['dashboard', 'customers', 'statusTracking', 'photos', 'notifications']
  }
  return ['dashboard', 'customers', 'createCustomer', 'notifications']
}
