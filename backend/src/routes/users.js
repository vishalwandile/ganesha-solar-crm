import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query, withTransaction } from '../db.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { requireAdmin } from '../middleware/auth.js'
import { toDbCategory, toFeCategory } from '../lib/keys.js'

const router = Router()

const createUserSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(6),
  team: z.enum(['Admin', 'Installation', 'Sales', 'Office', 'Account', 'Loan']),
  isAdmin: z.boolean().optional(),
  permissions: z
    .array(
      z.object({
        category: z.string(),
        canEdit: z.boolean().default(true),
      })
    )
    .optional(),
})

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `select id, name, username, team, is_admin, created_at from users order by created_at`
    )
    const perms = await query(`select user_id, category, can_edit from user_category_permissions`)
    res.json({
      users: rows.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        team: u.team,
        isAdmin: u.is_admin,
        createdAt: u.created_at,
        permissions: perms.rows
          .filter((p) => p.user_id === u.id)
          .map((p) => ({ category: toFeCategory(p.category), canEdit: p.can_edit })),
      })),
    })
  })
)

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body)
    const hash = await bcrypt.hash(body.password, 10)
    const isAdmin = body.isAdmin ?? body.team === 'Admin'

    const user = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into users (name, username, password_hash, team, is_admin)
         values ($1, $2, $3, $4, $5)
         returning id, name, username, team, is_admin, created_at`,
        [body.name.trim(), body.username.trim(), hash, body.team, isAdmin]
      )
      const created = rows[0]
      for (const p of body.permissions || []) {
        await client.query(
          `insert into user_category_permissions (user_id, category, can_edit)
           values ($1, $2, $3)
           on conflict (user_id, category) do update set can_edit = excluded.can_edit`,
          [created.id, toDbCategory(p.category), p.canEdit]
        )
      }
      return created
    })

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        team: user.team,
        isAdmin: user.is_admin,
        permissions: body.permissions || [],
      },
    })
  })
)

const permsSchema = z.object({
  permissions: z.array(
    z.object({
      category: z.string(),
      canEdit: z.boolean(),
    })
  ),
})

router.patch(
  '/:id/permissions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = permsSchema.parse(req.body)
    const { rows } = await query(`select id from users where id = $1`, [req.params.id])
    if (!rows[0]) throw new HttpError(404, 'User not found')

    await withTransaction(async (client) => {
      await client.query(`delete from user_category_permissions where user_id = $1`, [
        req.params.id,
      ])
      for (const p of body.permissions) {
        await client.query(
          `insert into user_category_permissions (user_id, category, can_edit)
           values ($1, $2, $3)`,
          [req.params.id, toDbCategory(p.category), p.canEdit]
        )
      }
    })

    res.json({ ok: true })
  })
)

export default router
