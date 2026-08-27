/**
 * Off-site backup for the free Supabase plan (no automated DB backups).
 *
 * Writes rotating copies under backend/backups/ (gitignored):
 *   crm-<env>-<timestamp>.sql
 *   crm-<env>-<timestamp>-files.tar.gz   (unless --db-only)
 *
 * Keeps the newest BACKUP_KEEP copies of each kind (default 3).
 *
 *   npm run backup           # production (.env)
 *   npm run backup:uat
 *   npm run backup:db        # SQL only (no bucket download / egress)
 *
 * Uses `pg_dump` when installed; otherwise dumps schema.sql + INSERT statements via Node.
 * Prefer a direct DB URL if the pooler rejects pg_dump:
 *   DIRECT_DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
 */

import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import pg from 'pg'
import '../loadEnv.js'
import { config } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backupRoot = path.resolve(__dirname, '../../backups')
const keepCount = Math.max(1, Number(process.env.BACKUP_KEEP || 3))
const dbOnly = process.argv.includes('--db-only')
const envLabel = String(process.env.APP_ENV || 'prod')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || 'prod'

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value instanceof Date) return `'${value.toISOString()}'`
  if (Buffer.isBuffer(value)) return `'\\x${value.toString('hex')}'`
  if (Array.isArray(value)) {
    return `ARRAY[${value.map((item) => sqlLiteral(item)).join(', ')}]`
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'::jsonb`
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

async function tableInsertOrder(client) {
  const { rows } = await client.query(`
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `)
  const tables = rows.map((row) => row.table_name)
  const { rows: fks } = await client.query(`
    select
      source.relname as child,
      target.relname as parent
    from pg_constraint con
    join pg_class source on source.oid = con.conrelid
    join pg_class target on target.oid = con.confrelid
    join pg_namespace n on n.oid = source.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
  `)
  const remaining = new Set(tables)
  const ordered = []
  while (remaining.size) {
    const ready = [...remaining].filter(
      (table) =>
        !fks.some((fk) => fk.child === table && remaining.has(fk.parent) && fk.parent !== table)
    )
    const batch = ready.length ? ready : [[...remaining][0]]
    for (const table of batch) {
      remaining.delete(table)
      ordered.push(table)
    }
  }
  return ordered
}

async function dumpWithNode(sqlPath, connectionString) {
  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  try {
    const schemaPath = path.resolve(__dirname, '../../db/schema.sql')
    const schemaSql = await fs.readFile(schemaPath, 'utf8')
    const tables = await tableInsertOrder(client)
    const chunks = [
      '-- Node fallback dump (pg_dump was not available).',
      '-- Restore onto an empty database: this file already includes schema.sql.',
      '-- If objects already exist, run only the TRUNCATE/INSERT section below.',
      '',
      schemaSql.trim(),
      '',
      'begin;',
      tables.length
        ? `truncate table ${tables.map((name) => `"${name.replace(/"/g, '""')}"`).join(', ')} restart identity cascade;`
        : '',
      '',
    ]

    for (const table of tables) {
      const quoted = `"${table.replace(/"/g, '""')}"`
      const result = await client.query(`select * from public.${quoted}`)
      if (!result.rows.length) continue
      const columns = result.fields.map((field) => `"${field.name.replace(/"/g, '""')}"`)
      chunks.push(`-- ${table}`)
      for (const row of result.rows) {
        const values = result.fields.map((field) => sqlLiteral(row[field.name]))
        chunks.push(
          `insert into public.${quoted} (${columns.join(', ')}) values (${values.join(', ')});`
        )
      }
      chunks.push('')
    }
    chunks.push('commit;', '')
    await fs.writeFile(sqlPath, chunks.filter((line) => line !== undefined).join('\n'))
  } finally {
    await client.end()
  }
}

function dumpCandidates() {
  const urls = []
  if (process.env.DIRECT_DATABASE_URL) urls.push(process.env.DIRECT_DATABASE_URL.trim())
  urls.push(config.databaseUrl)
  const pooler = config.databaseUrl.match(
    /^postgresql:\/\/postgres\.([a-z0-9]+):([^@]+)@aws-0-[^/]+pooler\.supabase\.com:5432\/postgres/i
  )
  if (pooler) {
    const [, ref, password] = pooler
    urls.push(`postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`)
  }
  return [...new Set(urls.filter(Boolean))]
}

async function dumpDatabase(sqlPath) {
  const urls = dumpCandidates()
  let lastError
  for (const url of urls) {
    try {
      console.log(`Dumping database (${envLabel}) with pg_dump → ${sqlPath}`)
      await run(
        'pg_dump',
        ['--no-owner', '--no-acl', '--clean', '--if-exists', '--format=plain', `--file=${sqlPath}`, url],
        { PGSSLMODE: process.env.PGSSLMODE || 'require' }
      )
      return
    } catch (err) {
      lastError = err
      console.log(`${err.message}. Trying Node dump on this URL …`)
      try {
        await dumpWithNode(sqlPath, url)
        return
      } catch (nodeErr) {
        lastError = nodeErr
        console.log(`Node dump failed: ${nodeErr.message}`)
      }
    }
  }
  throw lastError || new Error('Database dump failed')
}

function run(command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            `Command "${command}" was not found. Install PostgreSQL client tools so pg_dump is on your PATH.`
          )
        )
        return
      }
      reject(err)
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

function getBackupS3() {
  if (!config.storageEndpoint || !config.storageAccessKeyId || !config.storageSecretAccessKey) {
    return null
  }
  return new S3Client({
    endpoint: config.storageEndpoint,
    region: config.storageRegion,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: config.storageAccessKeyId,
      secretAccessKey: config.storageSecretAccessKey,
    },
  })
}

async function listAllKeys(s3, bucket) {
  const keys = []
  let token
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
      })
    )
    for (const object of page.Contents || []) {
      if (object.Key) keys.push(object.Key)
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return keys
}

async function backupFiles(archivePath) {
  const s3 = getBackupS3()
  if (!s3) {
    console.log('Skipping file archive: S3 storage is not configured.')
    return false
  }

  const staging = path.join(backupRoot, `.files-${stamp()}`)
  await fs.mkdir(staging, { recursive: true })
  try {
    const keys = await listAllKeys(s3, config.documentsBucket)
    console.log(`Downloading ${keys.length} object(s) from ${config.documentsBucket} …`)
    for (const key of keys) {
      const dest = path.join(staging, key)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      const result = await s3.send(
        new GetObjectCommand({ Bucket: config.documentsBucket, Key: key })
      )
      await fs.writeFile(dest, Buffer.from(await result.Body.transformToByteArray()))
    }
    await run('tar', ['-czf', archivePath, '-C', staging, '.'])
    return true
  } finally {
    await fs.rm(staging, { recursive: true, force: true })
  }
}

async function rotate(prefix, suffix) {
  const names = (await fs.readdir(backupRoot))
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort()
  const extra = names.slice(0, Math.max(0, names.length - keepCount))
  for (const name of extra) {
    await fs.rm(path.join(backupRoot, name), { force: true })
    console.log(`Removed old backup ${name}`)
  }
}

async function main() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  await fs.mkdir(backupRoot, { recursive: true })
  const when = stamp()
  const sqlPath = path.join(backupRoot, `crm-${envLabel}-${when}.sql`)
  const filesPath = path.join(backupRoot, `crm-${envLabel}-${when}-files.tar.gz`)

  await dumpDatabase(sqlPath)

  if (!dbOnly) {
    const wrote = await backupFiles(filesPath)
    if (wrote) console.log(`File archive → ${filesPath}`)
  }

  await rotate(`crm-${envLabel}-`, '.sql')
  await rotate(`crm-${envLabel}-`, '-files.tar.gz')
  console.log(`Kept up to ${keepCount} SQL dump(s) and ${keepCount} file archive(s) in ${backupRoot}`)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
