import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import '../loadEnv.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(__dirname, '../../db/schema.sql')

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const sql = fs.readFileSync(schemaPath, 'utf8')
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })

  await client.connect()
  console.log('Applying schema.sql …')
  try {
    await client.query(sql)
    console.log('Schema applied successfully.')
  } catch (err) {
    // Re-running may fail on existing types/tables — report clearly.
    console.error('Schema apply failed:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
