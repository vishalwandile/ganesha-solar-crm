import { query } from '../db.js'
import { toDbCategory } from '../lib/keys.js'
import { hasFeature } from '../lib/features.js'
import { HttpError } from './error.js'

/**
 * Default: no permission row => view-only (cannot edit).
 * Admin bypasses all category permission checks.
 */
export async function canEditCategory(user, categoryKey) {
  if (user.is_admin) return true
  const dbKey = toDbCategory(categoryKey)
  const { rows } = await query(
    `select can_edit from user_category_permissions
     where user_id = $1 and category = $2`,
    [user.id, dbKey]
  )
  return Boolean(rows[0]?.can_edit)
}

export function requireCategoryEdit(paramName = 'category') {
  return async (req, res, next) => {
    try {
      const category = req.params[paramName] || req.body?.category
      if (!category) throw new HttpError(400, 'Category is required')
      const ok = await canEditCategory(req.user, category)
      if (!ok) throw new HttpError(403, `You do not have edit permission for ${category}`)
      next()
    } catch (err) {
      next(err)
    }
  }
}

export function requireFeature(featureKey) {
  return (req, _res, next) => {
    if (hasFeature(req.user, featureKey)) return next()
    return next(new HttpError(403, 'You do not have access to this feature'))
  }
}

export function requireCategoryFeature() {
  return (req, _res, next) => {
    const category = req.params.category || req.body?.category
    const key = category === 'pmSuryaghar' || category === 'pm_suryaghar' ? 'pmSuryaghar' : 'statusTracking'
    if (hasFeature(req.user, key)) return next()
    return next(new HttpError(403, 'You do not have access to this feature'))
  }
}
