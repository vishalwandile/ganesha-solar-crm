import { Router } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { getDashboardSummary, getRecentActivity } from '../services/customers.js'

const router = Router()

router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const summary = await getDashboardSummary()
    res.json(summary)
  })
)

export default router
