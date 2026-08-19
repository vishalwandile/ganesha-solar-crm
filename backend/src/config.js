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

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: required('JWT_SECRET', 'dev-only-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendOrigins: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  documentsBucket: process.env.SUPABASE_DOCUMENTS_BUCKET || 'documents',
  photosBucket: process.env.SUPABASE_PHOTOS_BUCKET || 'photos',
  seedAdmin: {
    name: process.env.SEED_ADMIN_NAME || 'Rahul Kadam',
    username: process.env.SEED_ADMIN_USERNAME || 'rahul.kadam',
    password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
  },
}
