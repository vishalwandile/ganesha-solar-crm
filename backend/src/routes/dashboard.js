import { Router } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { requireFeature } from '../middleware/permissions.js'
import { getDashboardSummary, getRecentActivity } from '../services/customers.js'

const router = Router()

router.get(
  '/summary',
  requireFeature('dashboard'),
  asyncHandler(async (_req, res) => {
    const [summary, recent] = await Promise.all([
      getDashboardSummary(),
      getRecentActivity(8),
    ])
    res.json({ ...summary, recent })
  })
)

export default router
