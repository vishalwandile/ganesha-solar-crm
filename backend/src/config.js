import 'dotenv/config'

function required(name, fallback) {
  const value = process.env[name] ?? fallback
  if (value === undefined || value === '') {
    if (process.env.NODE_ENV === 'test') return ''
    // Allow boot without DB for health checks; routes that need DB will fail clearly.
    return fallback
  }
  return value
}

// Always allowed in addition to FRONTEND_ORIGIN, so a missing/mistyped env var
// on the host can't lock the deployed UI out of its own API.
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'https://ganesha-solar-crm.vercel.app',
  'https://*.vercel.app',
  'https://*.netlify.app',
]

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: required('JWT_SECRET', 'dev-only-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendOrigins: Array.from(
    new Set(
      [
        ...(process.env.FRONTEND_ORIGIN || '').split(','),
        ...DEFAULT_ORIGINS,
      ]
        .map((s) => s.trim().replace(/\/$/, ''))
        .filter(Boolean)
    )
  ),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  documentsBucket: process.env.SUPABASE_DOCUMENTS_BUCKET || 'documents',
  photosBucket: process.env.SUPABASE_PHOTOS_BUCKET || 'photos',
  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || 'Vishal Wandile',
    username: process.env.SEED_ADMIN_USERNAME || 'vishal.wandile',
    password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
  },
}

export function isAllowedOrigin(origin) {
  if (!origin) return true
  const normalized = String(origin).trim().replace(/\/$/, '')
  return config.frontendOrigins.some((allowed) => {
    if (allowed.includes('*')) {
      const re = new RegExp(
        `^${allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`,
        'i'
      )
      return re.test(normalized)
    }
    return allowed.toLowerCase() === normalized.toLowerCase()
  })
}
