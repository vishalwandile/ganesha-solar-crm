import { Router } from 'express'
import { query } from '../db.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { toFeCategory } from '../lib/keys.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `select n.*, c.name as customer_name
       from notifications n
       left join customers c on c.id = n.customer_id
       order by n.created_at desc
       limit 200`
    )
    res.json({
      notifications: rows.map((n) => ({
        id: n.id,
        text: n.message,
        at: n.created_at,
        read: n.is_read,
        customerId: n.customer_id,
        customerName: n.customer_name,
        category: n.category ? toFeCategory(n.category) : null,
      })),
    })
  })
)

router.patch(
  '/read-all',
  asyncHandler(async (_req, res) => {
    await query(`update notifications set is_read = true where is_read = false`)
    res.json({ ok: true })
  })
)

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `update notifications set is_read = true where id = $1 returning id`,
      [req.params.id]
    )
    if (!rows[0]) throw new HttpError(404, 'Notification not found')
    res.json({ ok: true })
  })
)

export default router
