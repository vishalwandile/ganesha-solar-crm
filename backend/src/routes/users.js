import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query, withTransaction } from '../db.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { requireAdmin } from '../middleware/auth.js'
import { requireFeature } from '../middleware/permissions.js'
import { toDbCategory, toFeCategory } from '../lib/keys.js'
import { defaultFeaturesForTeam, resolveFeatures, sanitizeFeatures } from '../lib/features.js'

const router = Router()

const permissionItem = z.object({
  category: z.string(),
  canEdit: z.boolean().default(true),
})

const createUserSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: z.string().min(6),
  team: z.enum(['Admin', 'Installation', 'Sales', 'Office', 'Account', 'Loan']),
  isAdmin: z.boolean().optional(),
  permissions: z.array(permissionItem).optional(),
  features: z.array(z.string()).optional(),
})

const accessSchema = z.object({
  permissions: z.array(permissionItem).optional(),
  features: z.array(z.string()).optional(),
  mobile: z
    .union([
      z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
      z.literal(''),
    ])
    .optional(),
})

function mapUser(row, permissions = []) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    mobile: row.mobile || '',
    team: row.team,
    isAdmin: row.is_admin,
    isSystemAdmin: row.is_system_admin,
    createdAt: row.created_at,
    features: resolveFeatures(row),
    permissions: permissions.map((p) => ({
      category: toFeCategory(p.category),
      canEdit: p.can_edit ?? p.canEdit,
    })),
  }
}

router.get(
  '/',
  requireFeature('users'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `select id, name, username, mobile, team, is_admin, is_system_admin, features, created_at
       from users where is_active = true order by created_at`
    )
    const perms = await query(`select user_id, category, can_edit from user_category_permissions`)
    res.json({
      users: rows.map((u) =>
        mapUser(
          u,
          perms.rows.filter((p) => p.user_id === u.id)
        )
      ),
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
    const features = isAdmin
      ? sanitizeFeatures(defaultFeaturesForTeam('Admin'))
      : sanitizeFeatures(body.features || defaultFeaturesForTeam(body.team))

    const user = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into users (name, username, mobile, password_hash, team, is_admin, features)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb)
         returning id, name, username, mobile, team, is_admin, is_system_admin, features, created_at`,
        [
          body.name.trim(),
          body.username.trim(),
          body.mobile,
          hash,
          body.team,
          isAdmin,
          JSON.stringify(features),
        ]
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
      user: mapUser(user, body.permissions || []),
    })
  })
)

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) {
      throw new HttpError(409, 'You cannot delete your own account')
    }
    const { rows } = await query(
      `select id, is_admin, is_system_admin from users where id = $1 and is_active = true`,
      [req.params.id]
    )
    const target = rows[0]
    if (!target) throw new HttpError(404, 'User not found')
    if (target.is_system_admin) {
      throw new HttpError(403, 'The system administrator account cannot be deleted')
    }

    if (target.is_admin) {
      const admins = await query(
        `select count(*)::int as count from users where is_admin = true and is_active = true`
      )
      if (admins.rows[0].count <= 1) {
        throw new HttpError(409, 'The last active admin cannot be deleted')
      }
    }

    await query(`update users set is_active = false where id = $1`, [req.params.id])
    res.json({ ok: true })
  })
)

router.patch(
  '/:id/access',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = accessSchema.parse(req.body)
    const { rows } = await query(
      `select id, is_admin, is_system_admin, team, features from users where id = $1 and is_active = true`,
      [req.params.id]
    )
    if (!rows[0]) throw new HttpError(404, 'User not found')
    if (rows[0].is_system_admin) {
      throw new HttpError(403, 'The system administrator always has full access and cannot be edited')
    }

    await withTransaction(async (client) => {
      if (body.mobile !== undefined) {
        await client.query(`update users set mobile = $2 where id = $1`, [
          req.params.id,
          body.mobile || null,
        ])
      }
      if (body.features) {
        const features = rows[0].is_admin
          ? sanitizeFeatures(defaultFeaturesForTeam('Admin'))
          : sanitizeFeatures(body.features)
        await client.query(`update users set features = $2::jsonb where id = $1`, [
          req.params.id,
          JSON.stringify(features),
        ])
      }
      if (body.permissions) {
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
      }
    })

    res.json({ ok: true })
  })
)

router.patch(
  '/:id/permissions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = z.object({ permissions: z.array(permissionItem) }).parse(req.body)
    const { rows } = await query(`select id, is_system_admin from users where id = $1`, [
      req.params.id,
    ])
    if (!rows[0]) throw new HttpError(404, 'User not found')
    if (rows[0].is_system_admin) {
      throw new HttpError(403, 'The system administrator always has full access and cannot be edited')
    }

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
