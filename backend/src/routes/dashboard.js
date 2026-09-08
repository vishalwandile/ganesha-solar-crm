import { Router } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { requireFeature } from '../middleware/permissions.js'
import { getDashboardSummary } from '../services/customers.js'

const router = Router()

router.get(
  '/summary',
  requireFeature('dashboard'),
  asyncHandler(async (req, res) => {
    const summary = await getDashboardSummary(req.user)
    res.json(summary)
  })
)

export default router
