import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { query } from '../db.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken,
} from '../middleware/auth.js'
import { toFeCategory } from '../lib/keys.js'
import { resolveFeatures } from '../lib/features.js'

const router = Router()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body)
    const { rows } = await query(
      `select id, name, username, password_hash, team, is_admin, features
       from users where username = $1 and is_active = true`,
      [body.username.trim()]
    )
    const user = rows[0]
    if (!user) throw new HttpError(401, 'Invalid username or password')

    const ok = await bcrypt.compare(body.password, user.password_hash)
    if (!ok) throw new HttpError(401, 'Invalid username or password')

    const token = signToken(user)
    setAuthCookie(res, token)

    const [perms, unread] = await Promise.all([
      query(`select category, can_edit from user_category_permissions where user_id = $1`, [
        user.id,
      ]),
      query(`select count(*)::int as count from notifications where is_read = false`),
    ])

    res.json({
      token,
      unreadNotificationCount: unread.rows[0].count,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        team: user.team,
        isAdmin: user.is_admin,
        features: resolveFeatures(user),
        permissions: perms.rows.map((p) => ({
          category: toFeCategory(p.category),
          canEdit: p.can_edit,
        })),
      },
    })
  })
)

router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [perms, unread] = await Promise.all([
      query(`select category, can_edit from user_category_permissions where user_id = $1`, [
        req.user.id,
      ]),
      query(`select count(*)::int as count from notifications where is_read = false`),
    ])
    res.json({
      unreadNotificationCount: unread.rows[0].count,
      user: {
        id: req.user.id,
        name: req.user.name,
        username: req.user.username,
        team: req.user.team,
        isAdmin: req.user.is_admin,
        features: resolveFeatures(req.user),
        permissions: perms.rows.map((p) => ({
          category: toFeCategory(p.category),
          canEdit: p.can_edit,
        })),
      },
    })
  })
)

export default router
