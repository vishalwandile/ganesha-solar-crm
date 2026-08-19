import { Router } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { getRecentActivity } from '../services/customers.js'

const router = Router()

router.get(
  '/recent',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 10, 50)
    const items = await getRecentActivity(limit)
    res.json({ items })
  })
)

export default router
