import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { requireCategoryEdit, requireCategoryFeature, requireFeature } from '../middleware/permissions.js'
import { hasFeature, redactCustomer } from '../lib/features.js'
import { config } from '../config.js'
import {
  addDocument,
  addPayment,
  createCustomer,
  disableOptionalCategory,
  enableOptionalCategory,
  getCustomerById,
  listCustomers,
  listPayments,
  loadCategoryDefs,
  quickLookup,
  saveCategory,
  setCustomerActive,
  updateCategoryExtra,
  updateCategoryNotes,
  updateSubsidyMeta,
  updateCustomer,
  getDocument,
  deleteDocumentRecord,
} from '../services/customers.js'
import {
  compressImage,
  deleteFile,
  downloadFile,
  remoteStorageEnabled,
  storageLocationFromUrl,
  uploadFile,
} from '../services/storage.js'

const upload = multer({
  storage: multer.memoryStorage(),
  // Images may arrive up to 1 MB and are compressed below 250 KB before storage.
  // Documents are checked separately and must already be at most 250 KB.
  limits: { fileSize: 1024 * 1024, files: 1 },
})

function documentLocation(document) {
  if (document.storage_path) {
    return { bucket: config.documentsBucket, objectPath: document.storage_path }
  }
  // Rows written while the server had no storage credentials point at the local
  // uploads folder. On a hosted server that disk is gone, so say so plainly
  // instead of surfacing a bucket "NoSuchKey".
  if (remoteStorageEnabled() && /^\/uploads\//.test(String(document.file_url || ''))) {
    throw new HttpError(
      404,
      'This file was uploaded before file storage was configured and is no longer available. Please upload it again.'
    )
  }
  return storageLocationFromUrl(document.file_url, config.documentsBucket)
}

const router = Router()

function todayInIndia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

const nonFutureDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
  .refine((date) => date <= todayInIndia(), 'Future dates are not allowed')

const optionalDate = z.union([nonFutureDate, z.null()]).optional()

const nameField = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[\p{L}][\p{L}\s'-]*$/u, 'Use letters, spaces, apostrophes, or hyphens only')

const customerDetailsSchema = z.object({
  firstName: nameField,
  middleName: z.union([nameField, z.literal('')]).optional(),
  lastName: nameField,
  consumerNumber: z.string().trim().regex(/^[A-Za-z0-9/-]{3,40}$/),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  email: z.union([z.string().trim().email(), z.literal('')]).optional(),
  address: z.string().trim().min(2).max(250),
  village: z.string().trim().min(2).max(80),
  taluka: z.string().trim().min(2).max(80),
  district: z.string().trim().min(2).max(80),
  pin: z.string().trim().regex(/^\d{6}$/, 'Enter a valid 6-digit PIN code'),
  electricityConnectionNo: z.string().trim().min(3).max(50),
  solarCapacity: z.coerce.number().positive(),
  solarCapacityKw: z.number().optional(),
  solarModule: z.string().trim().min(2).max(120),
  inverter: z.string().trim().min(2).max(120),
  totalDue: z.coerce.number().nonnegative(),
})

const createSchema = customerDetailsSchema.extend({
  enableNameChange: z.boolean().optional(),
  enableFinance: z.boolean().optional(),
})

const ALLOWED_UPLOAD_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
])

function hasValidFileSignature(file) {
  const name = file.originalname.toLowerCase()
  const bytes = file.buffer
  if (name.endsWith('.pdf')) return bytes.subarray(0, 4).toString() === '%PDF'
  if (name.endsWith('.png')) {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (name.endsWith('.doc')) {
    return bytes.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))
  }
  if (name.endsWith('.docx')) return bytes[0] === 0x50 && bytes[1] === 0x4b
  return false
}

router.get(
  '/meta/categories',
  asyncHandler(async (_req, res) => {
    const defs = await loadCategoryDefs()
    res.json({ categories: defs })
  })
)

router.get(
  '/quick-lookup',
  asyncHandler(async (req, res) => {
    const customer = await quickLookup(req.query.query || req.query.q || '')
    res.json({ customer })
  })
)

router.get(
  '/',
  requireFeature('customers'),
  asyncHandler(async (req, res) => {
    const filters = z
      .object({
        queue: z.enum(['installation', 'pmSuryaghar', 'closure', 'payments']).optional(),
        subStage: z.string().min(1).max(80).optional(),
        status: z.enum(['all', 'New', 'In progress', 'Completed', 'Inactive']).optional(),
      })
      .parse({
        queue: req.query.queue || undefined,
        subStage: req.query.subStage || undefined,
        status: req.query.status || undefined,
      })
    if (filters.subStage && !filters.queue) {
      throw new HttpError(400, 'A pipeline queue is required with a sub-stage filter')
    }
    if (filters.queue && !hasFeature(req.user, 'pipelineFilters')) {
      throw new HttpError(403, 'You do not have access to pipeline filters')
    }
    if (filters.queue === 'payments' && !hasFeature(req.user, 'payments')) {
      throw new HttpError(403, 'You do not have access to payment information')
    }
    const result = await listCustomers(
      req.query.search || '',
      req.query.page || 1,
      req.query.pageSize || 10,
      filters
    )
    res.json(result)
  })
)

router.post(
  '/',
  requireFeature('createCustomer'),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body)
    const customer = await createCustomer(body, req.user)
    res.status(201).json({ customer })
  })
)

router.get(
  '/:id',
  requireFeature('customers'),
  asyncHandler(async (req, res) => {
    const customer = await getCustomerById(req.params.id)
    res.json({ customer: redactCustomer(customer, req.user) })
  })
)

router.patch(
  '/:id',
  requireFeature('customers'),
  asyncHandler(async (req, res) => {
    const body = customerDetailsSchema.parse(req.body)
    const customer = await updateCustomer(req.params.id, body, req.user)
    res.json({ customer: redactCustomer(customer, req.user) })
  })
)

router.patch(
  '/:id/active',
  requireFeature('inactiveCustomer'),
  asyncHandler(async (req, res) => {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body)
    const customer = await setCustomerActive(req.params.id, isActive, req.user)
    res.json({ customer })
  })
)

router.patch(
  '/:id/pm-suryaghar/subsidy',
  (req, _res, next) => {
    req.params.category = 'pmSuryaghar'
    next()
  },
  requireCategoryEdit('category'),
  requireCategoryFeature(),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        subsidyAmount: z.number().nullable().optional(),
        subsidyReceivedDate: optionalDate,
      })
      .parse(req.body)
    const customer = await updateSubsidyMeta(req.params.id, body, req.user)
    res.json({ customer })
  })
)

router.patch(
  '/:id/categories/:category',
  requireCategoryEdit('category'),
  requireCategoryFeature(),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        subStages: z
          .array(
            z.object({
              key: z.string().min(1),
              value: z.string().min(1),
              date: optionalDate,
            })
          )
          .optional()
          .default([]),
        notes: z.string().nullable().optional(),
        rejectionReason: z.string().nullable().optional(),
        extra: z
          .object({
            bankName: z.string().optional(),
            loanAmount: z.number().nonnegative().nullable().optional(),
            amountReceived: z.number().nonnegative().nullable().optional(),
            receivedDate: optionalDate,
            installment1Amount: z.number().nonnegative().nullable().optional(),
            installment1Date: optionalDate,
            installment2Amount: z.number().nonnegative().nullable().optional(),
            installment2Date: optionalDate,
          })
          .optional(),
        subsidyAmount: z.number().nullable().optional(),
        subsidyReceivedDate: optionalDate,
      })
      .parse(req.body)

    const result = await saveCategory(req.params.id, req.params.category, body, req.user)
    res.json(result)
  })
)

router.patch(
  '/:id/categories/:category/sub-stages/:subStageKey',
  requireCategoryEdit('category'),
  requireCategoryFeature(),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        value: z.string().min(1),
        rejectionReason: z.string().optional(),
        date: optionalDate,
      })
      .parse(req.body)

    const result = await saveCategory(
      req.params.id,
      req.params.category,
      {
        subStages: [
          { key: req.params.subStageKey, value: body.value, date: body.date },
        ],
        rejectionReason: body.rejectionReason,
      },
      req.user
    )
    res.json(result)
  })
)

router.patch(
  '/:id/categories/:category/notes',
  requireCategoryEdit('category'),
  requireCategoryFeature(),
  asyncHandler(async (req, res) => {
    const notes = z.string().parse(req.body.notes ?? '')
    const customer = await updateCategoryNotes(req.params.id, req.params.category, notes, req.user)
    res.json({ customer })
  })
)

router.patch(
  '/:id/categories/:category/extra',
  requireCategoryEdit('category'),
  requireCategoryFeature(),
  asyncHandler(async (req, res) => {
    const customer = await updateCategoryExtra(req.params.id, req.params.category, req.body, req.user)
    res.json({ customer })
  })
)

router.post(
  '/:id/categories/:category/enable',
  requireCategoryEdit('category'),
  requireCategoryFeature(),
  asyncHandler(async (req, res) => {
    const customer = await enableOptionalCategory(req.params.id, req.params.category, req.user)
    res.json({ customer })
  })
)

router.post(
  '/:id/categories/:category/disable',
  requireCategoryEdit('category'),
  requireCategoryFeature(),
  asyncHandler(async (req, res) => {
    const customer = await disableOptionalCategory(req.params.id, req.params.category, req.user)
    res.json({ customer })
  })
)

router.get(
  '/:id/payments',
  requireFeature('payments'),
  asyncHandler(async (req, res) => {
    const payments = await listPayments(req.params.id)
    res.json({ payments })
  })
)

router.post(
  '/:id/payments',
  requireFeature('payments'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        amount: z.coerce.number().positive(),
        mode: z.string().min(1),
        date: nonFutureDate,
      })
      .parse(req.body)
    const payment = await addPayment(req.params.id, body, req.user)
    res.status(201).json({ payment })
  })
)

router.post(
  '/:id/documents',
  requireFeature('documents'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const type = z.string().parse(req.body.type || req.body.docType)
    const customName = req.body.customName || req.body.custom_name || ''
    if (!req.file) throw new HttpError(400, 'File is required')
    if (!ALLOWED_UPLOAD_MIMES.has(req.file.mimetype) || !hasValidFileSignature(req.file)) {
      throw new HttpError(400, 'Only PDF, DOC, DOCX, PNG, JPG, and JPEG files are allowed')
    }
    const isImage = req.file.mimetype.startsWith('image/')
    if (!isImage && req.file.size > 250 * 1024) {
      throw new HttpError(400, 'PDF, DOC, and DOCX files must be 250 KB or smaller')
    }
    const preparedFile = await compressImage(req.file)
    const uploaded = await uploadFile({
      bucket: config.documentsBucket,
      folder: req.params.id,
      file: preparedFile,
    })
    const document = await addDocument(
      req.params.id,
      {
        type,
        customName,
        fileName: uploaded.fileName,
        fileUrl: uploaded.url,
        storagePath: uploaded.path,
      },
      req.user
    )
    res.status(201).json({ document })
  })
)

router.get(
  '/:id/documents/:documentId/view',
  requireFeature('documents'),
  asyncHandler(async (req, res) => {
    const document = await getDocument(req.params.id, req.params.documentId)
    const location = documentLocation(document)
    if (!location.objectPath) return res.redirect(document.file_url)
    const viewed = await downloadFile(location)
    res.setHeader('Content-Type', viewed.contentType || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${document.file_name.replace(/["\r\n]/g, '_')}"`
    )
    res.send(viewed.buffer)
  })
)

router.get(
  '/:id/documents/:documentId/download',
  requireFeature('documents'),
  asyncHandler(async (req, res) => {
    const document = await getDocument(req.params.id, req.params.documentId)
    const location = documentLocation(document)
    const { objectPath } = location
    if (!objectPath) return res.redirect(document.file_url)
    const downloaded = await downloadFile({ bucket: location.bucket, objectPath })
    res.setHeader('Content-Type', downloaded.contentType || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.file_name.replace(/["\r\n]/g, '_')}"`
    )
    res.send(downloaded.buffer)
  })
)

router.delete(
  '/:id/documents/:documentId',
  requireFeature('documents'),
  asyncHandler(async (req, res) => {
    const document = await getDocument(req.params.id, req.params.documentId)
    // A file that is already gone must still be removable from the list.
    let location = { objectPath: null }
    try {
      location = documentLocation(document)
    } catch (err) {
      if (err?.status !== 404) throw err
    }
    if (location.objectPath) await deleteFile(location)
    await deleteDocumentRecord(req.params.id, req.params.documentId, req.user)
    res.json({ ok: true })
  })
)

export default router
