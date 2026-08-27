import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { config } from '../config.js'
import { HttpError } from '../middleware/error.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsRoot = path.resolve(__dirname, '../../uploads')

function supabaseEnabled() {
  return Boolean(config.supabaseUrl && config.supabaseServiceKey)
}

function s3Enabled() {
  return Boolean(
    config.storageEndpoint && config.storageAccessKeyId && config.storageSecretAccessKey
  )
}

// A configured endpoint with missing keys means someone forgot to fill in the
// credentials. Fail loudly instead of silently writing to the local disk, which
// looks like success but leaves files off the bucket.
function assertStorageConfigured() {
  if (s3Enabled() || supabaseEnabled()) return
  if (config.storageEndpoint || config.supabaseUrl) {
    throw new HttpError(
      500,
      'Storage is misconfigured: set STORAGE_S3_ACCESS_KEY_ID and STORAGE_S3_SECRET_ACCESS_KEY (or SUPABASE_SERVICE_ROLE_KEY) for this environment'
    )
  }
}

let s3Client = null

function getS3() {
  if (s3Client) return s3Client
  if (!/^https:\/\/[a-z0-9-]+\.storage\.supabase\.co\//i.test(config.storageEndpoint)) {
    throw new HttpError(
      500,
      'Storage is misconfigured: STORAGE_S3_ENDPOINT must be your project S3 endpoint'
    )
  }
  s3Client = new S3Client({
    endpoint: config.storageEndpoint,
    region: config.storageRegion,
    forcePathStyle: true,
    // Supabase's S3 gateway rejects the SDK's default trailing checksum headers.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: config.storageAccessKeyId,
      secretAccessKey: config.storageSecretAccessKey,
    },
  })
  return s3Client
}

async function sendToS3(command, action) {
  try {
    return await getS3().send(command)
  } catch (err) {
    if (err instanceof HttpError) throw err
    const status = err?.$metadata?.httpStatusCode
    const detail = err?.Code || err?.name || err?.message || 'unknown error'
    throw new HttpError(
      status === 404 ? 404 : 502,
      `Storage ${action} failed (${status || 'no status'}): ${detail}`
    )
  }
}

function getSupabase() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey)
}

function publicFileUrl(bucket, objectPath) {
  const projectUrl =
    config.supabaseUrl ||
    config.storageEndpoint
      .replace('.storage.supabase.co/storage/v1/s3', '.supabase.co')
      .replace(/\/storage\/v1\/s3\/?$/, '')
  return `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${objectPath}`
}

export function storageLocationFromUrl(fileUrl, fallbackBucket) {
  if (!fileUrl) return { bucket: fallbackBucket, objectPath: null }
  const publicMatch = fileUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (publicMatch) {
    return {
      bucket: decodeURIComponent(publicMatch[1]),
      objectPath: decodeURIComponent(publicMatch[2]),
    }
  }
  const localMatch = fileUrl.match(/\/uploads\/([^/]+)\/(.+)$/)
  if (localMatch) {
    return {
      bucket: decodeURIComponent(localMatch[1]),
      objectPath: decodeURIComponent(localMatch[2]),
    }
  }
  return { bucket: fallbackBucket, objectPath: null }
}

export async function compressImage(file, maxBytes = 250 * 1024) {
  if (!file?.mimetype?.startsWith('image/')) return file
  if (file.buffer.length <= maxBytes) return file

  const isPng = file.mimetype === 'image/png'
  let width = 1920
  for (const quality of [82, 72, 62, 52, 42, 32]) {
    let pipeline = sharp(file.buffer).rotate().resize({
      width,
      height: width,
      fit: 'inside',
      withoutEnlargement: true,
    })
    pipeline = isPng
      ? pipeline.png({ compressionLevel: 9, quality, palette: true })
      : pipeline.jpeg({ quality, mozjpeg: true })
    const buffer = await pipeline.toBuffer()
    if (buffer.length <= maxBytes) return { ...file, buffer, size: buffer.length }
    width = Math.max(640, Math.round(width * 0.82))
  }
  throw new HttpError(400, 'Image could not be compressed below 250 KB')
}

export async function uploadFile({ bucket, folder, file }) {
  if (!file) throw new HttpError(400, 'File is required')
  assertStorageConfigured()
  const safeName = file.originalname.replace(/[^\w.\-]+/g, '_')
  const objectPath = `${folder}/${Date.now()}-${safeName}`

  if (s3Enabled()) {
    await sendToS3(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectPath,
        Body: file.buffer,
        ContentLength: file.buffer.length,
        ContentType: file.mimetype,
      }),
      'upload'
    )
    return {
      path: objectPath,
      url: publicFileUrl(bucket, objectPath),
      fileName: file.originalname,
    }
  }

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

  // Local fallback for development without Supabase Storage.
  // Reuse objectPath so the stored path matches the file actually written.
  const fullPath = path.join(uploadsRoot, bucket, objectPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, file.buffer)
  return {
    path: objectPath,
    url: `/uploads/${bucket}/${objectPath}`,
    fileName: file.originalname,
  }
}

export async function deleteFile({ bucket, objectPath }) {
  if (!objectPath) return
  if (s3Enabled()) {
    await sendToS3(new DeleteObjectCommand({ Bucket: bucket, Key: objectPath }), 'delete')
    return
  }
  if (supabaseEnabled()) {
    const { error } = await getSupabase().storage.from(bucket).remove([objectPath])
    if (error) throw new HttpError(500, `Storage delete failed: ${error.message}`)
    return
  }
  const fullPath = path.resolve(uploadsRoot, bucket, objectPath)
  const allowedRoot = path.resolve(uploadsRoot, bucket)
  if (!fullPath.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new HttpError(400, 'Invalid storage path')
  }
  await fs.rm(fullPath, { force: true })
}

export async function downloadFile({ bucket, objectPath }) {
  if (!objectPath) throw new HttpError(404, 'Stored file was not found')
  if (s3Enabled()) {
    const result = await sendToS3(
      new GetObjectCommand({ Bucket: bucket, Key: objectPath }),
      'download'
    )
    return {
      buffer: Buffer.from(await result.Body.transformToByteArray()),
      contentType: result.ContentType,
    }
  }
  if (supabaseEnabled()) {
    const { data, error } = await getSupabase().storage.from(bucket).download(objectPath)
    if (error) throw new HttpError(404, `Storage download failed: ${error.message}`)
    return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type }
  }
  const fullPath = path.resolve(uploadsRoot, bucket, objectPath)
  const allowedRoot = path.resolve(uploadsRoot, bucket)
  if (!fullPath.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new HttpError(400, 'Invalid storage path')
  }
  return { buffer: await fs.readFile(fullPath) }
}
