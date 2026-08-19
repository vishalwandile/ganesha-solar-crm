import pg from 'pg'
import { config } from './config.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
  ssl: config.databaseUrl?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
})

export async function query(text, params = []) {
  if (!config.databaseUrl) {
    const err = new Error('DATABASE_URL is not configured')
    err.status = 503
    throw err
  }
  return pool.query(text, params)
}

export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
