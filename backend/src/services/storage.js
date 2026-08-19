import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'
import { HttpError } from '../middleware/error.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsRoot = path.resolve(__dirname, '../../uploads')

function supabaseEnabled() {
  return Boolean(config.supabaseUrl && config.supabaseServiceKey)
}

function getSupabase() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey)
}

export async function uploadFile({ bucket, folder, file }) {
  if (!file) throw new HttpError(400, 'File is required')
  const safeName = file.originalname.replace(/[^\w.\-]+/g, '_')
  const objectPath = `${folder}/${Date.now()}-${safeName}`

  if (supabaseEnabled()) {
    const supabase = getSupabase()
    const { error } = await supabase.storage.from(bucket).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })
    if (error) throw new HttpError(500, `Storage upload failed: ${error.message}`)
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
    return { path: objectPath, url: data.publicUrl, fileName: file.originalname }
  }

  // Local fallback for development without Supabase Storage
  const dir = path.join(uploadsRoot, bucket, folder)
  await fs.mkdir(dir, { recursive: true })
  const fullPath = path.join(dir, `${Date.now()}-${safeName}`)
  await fs.writeFile(fullPath, file.buffer)
  return {
    path: objectPath,
    url: `/uploads/${bucket}/${folder}/${path.basename(fullPath)}`,
    fileName: file.originalname,
  }
}
