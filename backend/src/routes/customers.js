import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { requireCategoryEdit, requireCategoryFeature, requireFeature } from '../middleware/permissions.js'
import { redactCustomer } from '../lib/features.js'
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
  saveCategory,
  setCustomerActive,
  updateCategoryExtra,
  updateCategoryNotes,
  updateSubsidyMeta,
} from '../services/customers.js'
import { query } from '../db.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
})

const router = Router()

const createSchema = z.object({
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  lastName: z.string().min(1),
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
  requireFeature('customers'),
  asyncHandler(async (req, res) => {
    const result = await listCustomers(
      req.query.search || '',
      req.query.page || 1,
      req.query.pageSize || 20
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
        subsidyReceivedDate: z.string().nullable().optional(),
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
              date: z.string().nullable().optional(),
            })
          )
          .optional()
          .default([]),
        notes: z.string().nullable().optional(),
        rejectionReason: z.string().nullable().optional(),
        extra: z
          .object({
            bankName: z.string().optional(),
            loanAmount: z.number().nullable().optional(),
            amountReceived: z.number().nullable().optional(),
            receivedDate: z.string().nullable().optional(),
          })
          .optional(),
        subsidyAmount: z.number().nullable().optional(),
        subsidyReceivedDate: z.string().nullable().optional(),
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
        date: z.string().nullable().optional(),
      })
      .parse(req.body)

    const result = await saveCategory(
      req.params.id,
      req.params.category,
      {
        subStages: [
          { key: req.params.subStageKey, value: body.value, date: body.date ?? null },
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
        date: z.string().min(1),
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
    const uploaded = await uploadFile({
      bucket: config.documentsBucket,
      folder: req.params.id,
      file: req.file,
    })
    const document = await addDocument(
      req.params.id,
      { type, customName, fileName: uploaded.fileName, fileUrl: uploaded.url },
      req.user
    )
    res.status(201).json({ document })
  })
)

router.post(
  '/:id/photos',
  requireFeature('photos'),
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
  requireFeature('history'),
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
