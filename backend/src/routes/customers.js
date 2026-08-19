import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { requireCategoryEdit } from '../middleware/permissions.js'
import { config } from '../config.js'
import { uploadFile } from '../services/storage.js'
import {
  addDocument,
  addPayment,
  addPhoto,
  createCustomer,
  disableOptionalCategory,
  enableOptionalCategory,
  getCustomerById,
  listCustomers,
  listPayments,
  loadCategoryDefs,
  quickLookup,
  updateCategoryExtra,
  updateCategoryNotes,
  updateOverallStatus,
  updateSubStage,
  updateSubsidyMeta,
} from '../services/customers.js'
import { query } from '../db.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
})

const router = Router()

const createSchema = z.object({
  name: z.string().min(1),
  consumerNumber: z.string().min(1),
  mobile: z.string().min(1),
  email: z.string().optional(),
  address: z.string().optional(),
  village: z.string().optional(),
  taluka: z.string().optional(),
  district: z.string().optional(),
  pin: z.string().optional(),
  electricityConnectionNo: z.string().optional(),
  solarCapacity: z.union([z.string(), z.number()]).optional(),
  solarCapacityKw: z.number().optional(),
  solarModule: z.string().optional(),
  inverter: z.string().optional(),
  totalDue: z.union([z.string(), z.number()]).optional(),
  enableNameChange: z.boolean().optional(),
})

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
  asyncHandler(async (req, res) => {
    const customers = await listCustomers(req.query.search || '')
    res.json({ customers })
  })
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body)
    const customer = await createCustomer(body, req.user)
    res.status(201).json({ customer })
  })
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await getCustomerById(req.params.id)
    res.json({ customer })
  })
)

router.patch(
  '/:id/overall-status',
  asyncHandler(async (req, res) => {
    const status = z.string().parse(req.body.overallStatus)
    const customer = await updateOverallStatus(req.params.id, status, req.user)
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
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        subsidyAmount: z.number().nullable().optional(),
        subsidyReceivedDate: z.string().nullable().optional(),
      })
      .parse(req.body)
    const customer = await updateSubsidyMeta(req.params.id, body, req.user)
    res.json({ customer })
  })
)

router.patch(
  '/:id/categories/:category/sub-stages/:subStageKey',
  requireCategoryEdit('category'),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        value: z.string().min(1),
        rejectionReason: z.string().optional(),
      })
      .parse(req.body)

    const customer = await updateSubStage(
      req.params.id,
      req.params.category,
      req.params.subStageKey,
      body.value,
      body.rejectionReason,
      req.user
    )
    res.json({ customer })
  })
)

router.patch(
  '/:id/categories/:category/notes',
  requireCategoryEdit('category'),
  asyncHandler(async (req, res) => {
    const notes = z.string().parse(req.body.notes ?? '')
    const customer = await updateCategoryNotes(req.params.id, req.params.category, notes, req.user)
    res.json({ customer })
  })
)

router.patch(
  '/:id/categories/:category/extra',
  requireCategoryEdit('category'),
  asyncHandler(async (req, res) => {
    const customer = await updateCategoryExtra(req.params.id, req.params.category, req.body, req.user)
    res.json({ customer })
  })
)

router.post(
  '/:id/categories/:category/enable',
  requireCategoryEdit('category'),
  asyncHandler(async (req, res) => {
    const customer = await enableOptionalCategory(req.params.id, req.params.category, req.user)
    res.json({ customer })
  })
)

router.post(
  '/:id/categories/:category/disable',
  requireCategoryEdit('category'),
  asyncHandler(async (req, res) => {
    const customer = await disableOptionalCategory(req.params.id, req.params.category, req.user)
    res.json({ customer })
  })
)

router.get(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    const payments = await listPayments(req.params.id)
    res.json({ payments })
  })
)

router.post(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        amount: z.coerce.number().positive(),
        mode: z.string().min(1),
        date: z.string().min(1),
      })
      .parse(req.body)
    const payment = await addPayment(req.params.id, body, req.user)
    res.status(201).json({ payment })
  })
)

router.post(
  '/:id/documents',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const type = z.string().parse(req.body.type || req.body.docType)
    if (!req.file) throw new HttpError(400, 'File is required')
    const uploaded = await uploadFile({
      bucket: config.documentsBucket,
      folder: req.params.id,
      file: req.file,
    })
    const document = await addDocument(
      req.params.id,
      { type, fileName: uploaded.fileName, fileUrl: uploaded.url },
      req.user
    )
    res.status(201).json({ document })
  })
)

router.post(
  '/:id/photos',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'File is required')
    const caption = req.body.caption || ''
    const uploaded = await uploadFile({
      bucket: config.photosBucket,
      folder: req.params.id,
      file: req.file,
    })
    const photo = await addPhoto(
      req.params.id,
      { caption, fileUrl: uploaded.url },
      req.user
    )
    res.status(201).json({ photo })
  })
)

router.get(
  '/:id/history',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `select a.id, a.action, a.created_at, u.name as user_name
       from activity_log a
       left join users u on u.id = a.performed_by
       where a.customer_id = $1
       order by a.created_at desc`,
      [req.params.id]
    )
    res.json({
      history: rows.map((h) => ({
        id: h.id,
        action: h.action,
        user: h.user_name || 'System',
        at: h.created_at,
      })),
    })
  })
)

export default router
