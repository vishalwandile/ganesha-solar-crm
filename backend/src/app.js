import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { ZodError } from 'zod'
import { config, isAllowedOrigin } from './config.js'
import { requireAuth } from './middleware/auth.js'
import { errorHandler, notFound, HttpError } from './middleware/error.js'
import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import dashboardRoutes from './routes/dashboard.js'
import customersRoutes from './routes/customers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp() {
  const app = express()

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    cors({
      origin(origin, cb) {
        // Never throw here — a thrown error becomes 403 without CORS headers,
        // which the browser reports as both CORS and 403.
        if (isAllowedOrigin(origin)) return cb(null, true)
        return cb(null, false)
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      optionsSuccessStatus: 204,
    })
  )
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'))
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'ganesha-solar-crm-api' })
  })

  app.use('/auth', authRoutes)

  app.use('/api', requireAuth)
  app.use('/api/dashboard', dashboardRoutes)
  app.use('/api/customers', customersRoutes)
  app.use('/api/users', usersRoutes)

  app.use(notFound)
  app.use((err, req, res, next) => {
    if (err instanceof ZodError) {
      return next(new HttpError(400, 'Validation failed', err.flatten()))
    }
    return next(err)
  })
  app.use(errorHandler)

  return app
}
