import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { query } from '../db.js'
import { HttpError } from './error.js'

const COOKIE_NAME = 'gss_token'

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      team: user.team,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  )
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    secure: config.nodeEnv === 'production',
  })
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null
    const token = bearer || req.cookies?.[COOKIE_NAME]
    if (!token) throw new HttpError(401, 'Authentication required')

    let payload
    try {
      payload = jwt.verify(token, config.jwtSecret)
    } catch {
      throw new HttpError(401, 'Invalid or expired token')
    }

    const { rows } = await query(
      `select id, name, username, team, is_admin, is_active, features, created_at
       from users where id = $1 and is_active = true`,
      [payload.sub]
    )
    if (!rows[0]) throw new HttpError(401, 'User not found')

    req.user = rows[0]
    next()
  } catch (err) {
    next(err)
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return next(new HttpError(403, 'Admin access required'))
  next()
}
