import { query, withTransaction } from '../db.js'
import {
  toDbCategory,
  toFeCategory,
  toDbSubStage,
  toFeSubStage,
  toDbStatus,
  toFeStatus,
  toDbPaymentMode,
  toFePaymentMode,
  toDbDocumentType,
  toFeDocumentType,
  resolveDocumentType,
} from '../lib/keys.js'
import { calculateExpectedSubsidy, getCategoryStatus, parseCapacityKW } from '../lib/status.js'
import { HttpError } from '../middleware/error.js'

function toDateStr(value) {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  try {
    return new Date(value).toISOString().slice(0, 10)
  } catch {
    return null
  }
}

let categoryDefsCache = null

export async function loadCategoryDefs() {
  if (categoryDefsCache) return categoryDefsCache
  const { rows } = await query(
    `select c.category, c.label as category_label, c.owner_team, c.is_optional,
            c.sort_order as category_order, s.sub_stage_key, s.label as stage_label,
            s.sort_order as stage_order, s.options
     from category_definitions c
     join stage_definitions s on s.category = c.category
     order by c.sort_order, s.sort_order`
  )

  const categories = [...new Map(rows.map((row) => [row.category, row])).values()]
  categoryDefsCache = categories.map((c) => ({
    key: toFeCategory(c.category),
    dbKey: c.category,
    label: c.category_label,
    owner: c.owner_team === 'Installation' ? 'Installation team' : c.owner_team,
    optional: c.is_optional,
    subStages: rows
      .filter((s) => s.category === c.category)
      .map((s) => ({
        key: toFeSubStage(s.sub_stage_key),
        dbKey: s.sub_stage_key,
        label: s.stage_label,
        options: (s.options || []).map(toFeStatus),
        dbOptions: s.options || [],
      })),
  }))
  return categoryDefsCache
}

function mapCustomerRow(row) {
  return {
    id: row.id,
    name: row.name,
    firstName: row.first_name || '',
    middleName: row.middle_name || '',
    lastName: row.last_name || '',
    consumerNumber: row.consumer_number,
    mobile: row.mobile,
    email: row.email || '',
    address: row.address || '',
    village: row.village || '',
    taluka: row.taluka || '',
    district: row.district || '',
    pin: row.pin || '',
    electricityConnectionNo: row.electricity_connection_no || '',
    solarCapacity: row.solar_capacity_kw != null ? `${row.solar_capacity_kw} kW` : '',
    solarCapacityKw: row.solar_capacity_kw != null ? Number(row.solar_capacity_kw) : null,
    solarModule: row.solar_module || '',
    inverter: row.inverter || '',
    totalDue: row.total_due != null ? Number(row.total_due) : 0,
    subsidyAmount: row.subsidy_amount != null ? Number(row.subsidy_amount) : null,
    subsidyReceivedDate: row.subsidy_received_date || null,
    overallStatus: toFeStatus(row.overall_status),
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function buildCategoriesPayload(customerId, defs) {
  const [catRows, stageRows] = await Promise.all([
    query(`select * from customer_categories where customer_id = $1`, [customerId]),
    query(`select * from customer_sub_stages where customer_id = $1`, [customerId]),
  ])

  const categories = {}
  const categoryUpdatedAt = {}
  const categoryNotes = {}
  const categoryStatuses = {}

  for (const def of defs) {
    const cat = catRows.rows.find((r) => r.category === def.dbKey)
    if (!cat) {
      categories[def.key] = null
      categoryStatuses[def.key] = 'Not applicable'
      continue
    }

    const values = {}
    for (const sub of def.subStages) {
      const row = stageRows.rows.find(
        (s) => s.category === def.dbKey && s.sub_stage_key === sub.dbKey
      )
      values[sub.key] = toFeStatus(row?.value ?? sub.options[0])
      values[`${sub.key}Date`] = toDateStr(row?.stage_date)
    }

    if (cat.rejection_reason) values.rejectionReason = cat.rejection_reason
    if (cat.extra && typeof cat.extra === 'object') {
      if (cat.extra.bank_name != null) values.bankName = cat.extra.bank_name
      if (cat.extra.loan_amount != null) values.loanAmount = cat.extra.loan_amount
      if (cat.extra.amount_received != null) values.amountReceived = cat.extra.amount_received
      if (cat.extra.received_date != null) values.receivedDate = cat.extra.received_date
    }

    categories[def.key] = values
    categoryUpdatedAt[def.key] = cat.updated_at
    if (cat.notes) categoryNotes[def.key] = cat.notes
    categoryStatuses[def.key] = getCategoryStatus(def.subStages, values)
  }

  return { categories, categoryUpdatedAt, categoryNotes, categoryStatuses }
}

function buildWorkflowCustomer(row, catPayload, defs) {
  const base = mapCustomerRow(row)
  const requiredForClosure = ['rooftopSolar', 'pmSuryaghar', 'installation']
  const closureBlockers = requiredForClosure
    .filter((key) => catPayload.categoryStatuses[key] !== 'Completed')
    .map((key) => defs.find((def) => def.key === key)?.label || key)
  return {
    ...base,
    ...catPayload,
    closureReady: closureBlockers.length === 0,
    closureBlockers,
    expectedSubsidy: calculateExpectedSubsidy(base.solarCapacityKw),
  }
}

export async function getCustomerById(id) {
  const { rows } = await query(`select * from customers where id = $1`, [id])
  if (!rows[0]) throw new HttpError(404, 'Customer not found')

  const defs = await loadCategoryDefs()
  const catPayload = await buildCategoriesPayload(id, defs)
  const workflow = buildWorkflowCustomer(rows[0], catPayload, defs)

  const [docs, payments, photos, history] = await Promise.all([
    query(
      `select id, doc_type, custom_name, file_name, file_url, uploaded_at from documents
       where customer_id = $1 order by uploaded_at desc`,
      [id]
    ),
    query(
      `select id, amount, mode, paid_on, created_at from payments
       where customer_id = $1 order by paid_on desc, created_at desc`,
      [id]
    ),
    query(
      `select id, file_url, caption, uploaded_at from photos
       where customer_id = $1 order by uploaded_at desc`,
      [id]
    ),
    query(
      `select a.id, a.action, a.created_at, u.name as user_name
       from activity_log a
       left join users u on u.id = a.performed_by
       where a.customer_id = $1
       order by a.created_at desc`,
      [id]
    ),
  ])

  return {
    ...workflow,
    documents: docs.rows.map((d) => ({
      id: d.id,
      type: d.custom_name || toFeDocumentType(d.doc_type),
      customName: d.custom_name || null,
      fileName: d.file_name,
      fileUrl: d.file_url,
      uploadedAt: d.uploaded_at,
    })),
    payments: payments.rows.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      mode: toFePaymentMode(p.mode),
      date: p.paid_on,
      createdAt: p.created_at,
    })),
    photos: photos.rows.map((p) => ({
      id: p.id,
      fileUrl: p.file_url,
      caption: p.caption || '',
      uploadedAt: p.uploaded_at,
    })),
    history: history.rows.map((h) => ({
      id: h.id,
      action: h.action,
      user: h.user_name || 'System',
      at: h.created_at,
    })),
  }
}

export async function listCustomers(search, page = 1, pageSize = 20) {
  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.min(100, Math.max(5, Number(pageSize) || 20))
  const offset = (safePage - 1) * safePageSize
  const params = []
  let where = ''
  if (search?.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`)
    params.push(search.trim().replace(/\s/g, ''))
    where = `where lower(name) like $1
      or lower(consumer_number) like $1
      or replace(mobile, ' ', '') like $2`
  }
  const limitParam = params.length + 1
  const offsetParam = params.length + 2
  params.push(safePageSize, offset)
  const { rows } = await query(
    `select *, count(*) over()::int as total_count
     from customers
     ${where}
     order by created_at desc, id desc
     limit $${limitParam} offset $${offsetParam}`,
    params
  )
  const total = rows[0]?.total_count || 0
  return {
    customers: rows.map(mapCustomerRow),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  }
}

export async function quickLookup(q) {
  const queryText = (q || '').trim()
  if (!queryText) return null
  const mobile = queryText.replace(/\s/g, '')
  const { rows } = await query(
    `select * from customers
     where lower(consumer_number) = lower($1)
        or replace(mobile, ' ', '') = $2
     limit 1`,
    [queryText, mobile]
  )
  if (!rows[0]) return null
  return getCustomerById(rows[0].id)
}

async function ensureDefaultCategories(client, customerId, enableNameChange, userId) {
  const defs = await loadCategoryDefs()
  for (const def of defs) {
    if (def.key === 'nameChange' && !enableNameChange) continue
    if (def.key === 'finance') continue
    if (def.optional && def.key !== 'nameChange') continue

    await client.query(
      `insert into customer_categories (customer_id, category, updated_by)
       values ($1, $2, $3)
       on conflict (customer_id, category) do nothing`,
      [customerId, def.dbKey, userId]
    )

    for (const sub of def.subStages) {
      const defaultValue = toDbStatus(sub.options[0])
      await client.query(
        `insert into customer_sub_stages (customer_id, category, sub_stage_key, value, updated_by)
         values ($1, $2, $3, $4, $5)
         on conflict (customer_id, category, sub_stage_key) do nothing`,
        [customerId, def.dbKey, sub.dbKey, defaultValue, userId]
      )
    }
  }
}

export async function createCustomer(payload, user) {
  const capacity = parseCapacityKW(payload.solarCapacity || payload.solarCapacityKw)
  const enableNameChange = Boolean(payload.enableNameChange)
  const firstName = payload.firstName.trim()
  const middleName = (payload.middleName || '').trim()
  const lastName = payload.lastName.trim()
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ')

  const customerId = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into customers (
         first_name, middle_name, last_name, name,
         consumer_number, mobile, email, address, village, taluka, district, pin,
         electricity_connection_no, solar_capacity_kw, solar_module, inverter, total_due,
         overall_status, created_by
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'New',$18
       ) returning id`,
      [
        firstName,
        middleName || null,
        lastName,
        fullName,
        payload.consumerNumber.trim(),
        payload.mobile.trim(),
        payload.email || null,
        payload.address || null,
        payload.village || null,
        payload.taluka || null,
        payload.district || null,
        payload.pin || null,
        payload.electricityConnectionNo || null,
        capacity || null,
        payload.solarModule || null,
        payload.inverter || null,
        payload.totalDue != null ? Number(payload.totalDue) : 150000,
        user.id,
      ]
    )
    const id = rows[0].id
    await ensureDefaultCategories(client, id, enableNameChange, user.id)
    await client.query(
      `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
      [id, 'Customer created', user.id]
    )
    return id
  })

  return getCustomerById(customerId)
}

export async function updateOverallStatus(customerId, overallStatus, user) {
  const dbStatus = toDbStatus(overallStatus)
  await query(
    `update customers set overall_status = $1 where id = $2`,
    [dbStatus, customerId]
  )
  await query(
    `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
    [customerId, `Overall status → ${toFeStatus(dbStatus)}`, user.id]
  )
  return getCustomerById(customerId)
}

export async function saveCategory(customerId, categoryKey, payload, user) {
  const customerState = await query(
    `select * from customers where id = $1`,
    [customerId]
  )
  if (!customerState.rows[0]) throw new HttpError(404, 'Customer not found')
  if (!customerState.rows[0].is_active) {
    throw new HttpError(409, 'Reactivate this customer before updating pipeline stages')
  }

  const defs = await loadCategoryDefs()
  const def = defs.find((d) => d.key === categoryKey || d.dbKey === categoryKey)
  if (!def) throw new HttpError(404, 'Unknown category')

  const subStages = Array.isArray(payload.subStages) ? payload.subStages : []
  const rejectionReason = payload.rejectionReason
  const notes = payload.notes
  const extra = payload.extra || {}

  for (const item of subStages) {
    const sub = def.subStages.find((s) => s.key === item.key || s.dbKey === item.key)
    if (!sub) throw new HttpError(400, `Unknown sub-stage: ${item.key}`)
    const feValue = toFeStatus(item.value)
    if (!sub.options.includes(feValue) && !sub.dbOptions.includes(item.value)) {
      throw new HttpError(400, `Invalid status "${item.value}" for ${sub.label}`, {
        allowed: sub.options,
      })
    }
    if (toDbStatus(feValue) === 'Rejected' && !(rejectionReason || '').trim()) {
      throw new HttpError(400, 'Rejection reason is required when status is Rejected')
    }
  }

  await query(
    `insert into customer_categories (customer_id, category, updated_by)
     values ($1, $2, $3)
     on conflict (customer_id, category) do nothing`,
    [customerId, def.dbKey, user.id]
  )

  const before = await buildCategoriesPayload(customerId, defs)
  const beforeStatus = before.categoryStatuses[def.key]
  const closesProject =
    def.key === 'closure' &&
    subStages.some(
      (item) =>
        (item.key === 'projectClosed' || item.key === 'project_closed') &&
        toFeStatus(item.value) === 'Yes'
    )

  if (closesProject) {
    const requiredForClosure = ['rooftopSolar', 'pmSuryaghar', 'installation']
    const blockers = requiredForClosure
      .filter((key) => before.categoryStatuses[key] !== 'Completed')
      .map((key) => defs.find((item) => item.key === key)?.label || key)
    if (blockers.length) {
      throw new HttpError(
        409,
        `Complete these stages before closure: ${blockers.join(', ')}`,
        { blockers }
      )
    }
  }

  const beforeValues = before.categories[def.key] || {}
  const stageChanged = subStages.some((item) => {
    const sub = def.subStages.find((candidate) => candidate.key === item.key || candidate.dbKey === item.key)
    return (
      toFeStatus(item.value) !== beforeValues[sub.key] ||
      (toDateStr(item.date) || null) !== (beforeValues[`${sub.key}Date`] || null)
    )
  })
  const notesChanged =
    payload.notes !== undefined &&
    (payload.notes || '') !== (before.categoryNotes[def.key] || '')
  const rejectionChanged =
    payload.rejectionReason !== undefined &&
    (payload.rejectionReason || '') !== (beforeValues.rejectionReason || '')
  const extraChanged = Object.entries(extra).some(([key, value]) => {
    const current = beforeValues[key] ?? null
    return (value ?? null) !== current
  })
  const subsidyChanged =
    def.key === 'pmSuryaghar' &&
    ((payload.subsidyAmount !== undefined &&
      (payload.subsidyAmount == null ? null : Number(payload.subsidyAmount)) !==
        (customerState.rows[0].subsidy_amount == null
          ? null
          : Number(customerState.rows[0].subsidy_amount))) ||
      (payload.subsidyReceivedDate !== undefined &&
        (payload.subsidyReceivedDate || null) !==
          toDateStr(customerState.rows[0].subsidy_received_date)))
  const startsPipeline =
    customerState.rows[0].overall_status === 'New' &&
    ['nameChange', 'rooftopSolar'].includes(def.key) &&
    subStages.length > 0

  if (
    !stageChanged &&
    !notesChanged &&
    !rejectionChanged &&
    !extraChanged &&
    !subsidyChanged &&
    !startsPipeline
  ) {
    return {
      customer: buildWorkflowCustomer(customerState.rows[0], before, defs),
      notificationCreated: false,
    }
  }

  await withTransaction(async (client) => {
    for (const item of subStages) {
      const sub = def.subStages.find((s) => s.key === item.key || s.dbKey === item.key)
      const dbValue = toDbStatus(toFeStatus(item.value))
      const stageDate = item.date ? item.date : null
      await client.query(
        `insert into customer_sub_stages (customer_id, category, sub_stage_key, value, stage_date, updated_by)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (customer_id, category, sub_stage_key)
         do update set
           value = excluded.value,
           stage_date = excluded.stage_date,
           updated_by = excluded.updated_by,
           updated_at = now()`,
        [customerId, def.dbKey, sub.dbKey, dbValue, stageDate, user.id]
      )
    }

    const extraMapped = {}
    if (extra.bankName != null) extraMapped.bank_name = extra.bankName
    if (extra.loanAmount != null) extraMapped.loan_amount = extra.loanAmount
    if (extra.amountReceived != null) extraMapped.amount_received = extra.amountReceived
    if (extra.receivedDate != null) extraMapped.received_date = extra.receivedDate

    await client.query(
      `update customer_categories
       set notes = coalesce($1, notes),
           rejection_reason = coalesce($2, rejection_reason),
           extra = case when $3::jsonb = '{}'::jsonb then extra else extra || $3::jsonb end,
           updated_by = $4,
           updated_at = now()
       where customer_id = $5 and category = $6`,
      [
        notes ?? null,
        rejectionReason ?? null,
        JSON.stringify(extraMapped),
        user.id,
        customerId,
        def.dbKey,
      ]
    )

    await client.query(
      `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
      [customerId, `${def.label} saved`, user.id]
    )
  })

  if (def.key === 'pmSuryaghar' && (payload.subsidyAmount !== undefined || payload.subsidyReceivedDate !== undefined)) {
    await query(
      `update customers
       set subsidy_amount = coalesce($1, subsidy_amount),
           subsidy_received_date = coalesce($2, subsidy_received_date)
       where id = $3`,
      [
        payload.subsidyAmount === undefined || payload.subsidyAmount === null
          ? null
          : Number(payload.subsidyAmount),
        payload.subsidyReceivedDate || null,
        customerId,
      ]
    )
  }

  if (closesProject) {
    await query(`update customers set overall_status = 'Completed' where id = $1`, [customerId])
  } else if (def.key === 'closure' && subStages.some((item) => toFeStatus(item.value) === 'No')) {
    await query(
      `update customers set overall_status = 'In Progress'
       where id = $1 and overall_status = 'Completed'`,
      [customerId]
    )
  } else if (['nameChange', 'rooftopSolar'].includes(def.key) && subStages.length > 0) {
    await query(
      `update customers set overall_status = 'In Progress'
       where id = $1 and overall_status = 'New'`,
      [customerId]
    )
  }

  const after = await buildCategoriesPayload(customerId, defs)
  const afterStatus = after.categoryStatuses[def.key]
  let notificationCreated = false
  if (beforeStatus !== afterStatus) {
    await query(
      `insert into notifications (customer_id, category, message)
       values ($1, $2, $3)`,
      [
        customerId,
        def.dbKey,
        `${customerState.rows[0].name || 'Customer'}: ${def.label} → ${afterStatus}`,
      ]
    )
    notificationCreated = true
  }

  const updatedCustomer = await query(`select * from customers where id = $1`, [customerId])
  return {
    customer: buildWorkflowCustomer(updatedCustomer.rows[0], after, defs),
    notificationCreated,
  }
}

export async function setCustomerActive(customerId, isActive, user) {
  const { rows } = await query(
    `select id, overall_status, is_active from customers where id = $1`,
    [customerId]
  )
  const customer = rows[0]
  if (!customer) throw new HttpError(404, 'Customer not found')
  if (!isActive && customer.overall_status === 'Completed') {
    throw new HttpError(409, 'Completed customers cannot be marked inactive')
  }
  if (customer.is_active === isActive) return getCustomerById(customerId)

  await withTransaction(async (client) => {
    await client.query(
      `update customers set is_active = $1, updated_at = now() where id = $2`,
      [isActive, customerId]
    )
    await client.query(
      `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
      [customerId, isActive ? 'Customer reactivated' : 'Customer marked inactive', user.id]
    )
  })
  return getCustomerById(customerId)
}

export async function updateSubStage(customerId, categoryKey, subStageKey, value, rejectionReason, user) {
  const defs = await loadCategoryDefs()
  const def = defs.find((d) => d.key === categoryKey || d.dbKey === categoryKey)
  if (!def) throw new HttpError(404, 'Unknown category')

  const sub = def.subStages.find((s) => s.key === subStageKey || s.dbKey === subStageKey)
  if (!sub) throw new HttpError(404, 'Unknown sub-stage')

  const feValue = toFeStatus(value)
  if (!sub.options.includes(feValue) && !sub.dbOptions.includes(value)) {
    throw new HttpError(400, `Invalid status "${value}" for ${sub.label}`, {
      allowed: sub.options,
    })
  }

  const dbValue = toDbStatus(feValue)
  if (dbValue === 'Rejected' && !(rejectionReason || '').trim()) {
    throw new HttpError(400, 'Rejection reason is required when status is Rejected')
  }

  // Ensure category row exists (e.g. enabling optional category)
  await query(
    `insert into customer_categories (customer_id, category, updated_by)
     values ($1, $2, $3)
     on conflict (customer_id, category) do nothing`,
    [customerId, def.dbKey, user.id]
  )

  const before = await buildCategoriesPayload(customerId, defs)
  const beforeStatus = before.categoryStatuses[def.key]

  await withTransaction(async (client) => {
    await client.query(
      `insert into customer_sub_stages (customer_id, category, sub_stage_key, value, updated_by)
       values ($1, $2, $3, $4, $5)
       on conflict (customer_id, category, sub_stage_key)
       do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
      [customerId, def.dbKey, sub.dbKey, dbValue, user.id]
    )

    if (dbValue === 'Rejected') {
      await client.query(
        `update customer_categories
         set rejection_reason = $1, updated_by = $2, updated_at = now()
         where customer_id = $3 and category = $4`,
        [rejectionReason.trim(), user.id, customerId, def.dbKey]
      )
    }

    await client.query(
      `update customer_categories set updated_by = $1, updated_at = now()
       where customer_id = $2 and category = $3`,
      [user.id, customerId, def.dbKey]
    )

    await client.query(
      `insert into activity_log (customer_id, action, performed_by)
       values ($1, $2, $3)`,
      [customerId, `${def.label}: ${sub.label} → ${feValue}`, user.id]
    )
  })

  const after = await buildCategoriesPayload(customerId, defs)
  const afterStatus = after.categoryStatuses[def.key]
  if (beforeStatus !== afterStatus) {
    const { rows: cust } = await query(`select name from customers where id = $1`, [customerId])
    await query(
      `insert into notifications (customer_id, category, message)
       values ($1, $2, $3)`,
      [
        customerId,
        def.dbKey,
        `${cust[0]?.name || 'Customer'}: ${def.label} → ${afterStatus}`,
      ]
    )
  }

  return getCustomerById(customerId)
}

export async function updateCategoryNotes(customerId, categoryKey, notes, user) {
  const dbKey = toDbCategory(categoryKey)
  await query(
    `insert into customer_categories (customer_id, category, notes, updated_by)
     values ($1, $2, $3, $4)
     on conflict (customer_id, category)
     do update set notes = excluded.notes, updated_by = excluded.updated_by, updated_at = now()`,
    [customerId, dbKey, notes ?? '', user.id]
  )
  return getCustomerById(customerId)
}

export async function updateCategoryExtra(customerId, categoryKey, extraPatch, user) {
  const dbKey = toDbCategory(categoryKey)
  const mapped = {}
  if (extraPatch.bankName != null) mapped.bank_name = extraPatch.bankName
  if (extraPatch.loanAmount != null) mapped.loan_amount = extraPatch.loanAmount
  if (extraPatch.amountReceived != null) mapped.amount_received = extraPatch.amountReceived
  if (extraPatch.receivedDate != null) mapped.received_date = extraPatch.receivedDate
  if (extraPatch.rejectionReason != null) {
    await query(
      `update customer_categories set rejection_reason = $1, updated_by = $2, updated_at = now()
       where customer_id = $3 and category = $4`,
      [extraPatch.rejectionReason, user.id, customerId, dbKey]
    )
  }

  await query(
    `insert into customer_categories (customer_id, category, extra, updated_by)
     values ($1, $2, $3::jsonb, $4)
     on conflict (customer_id, category)
     do update set extra = customer_categories.extra || excluded.extra,
                   updated_by = excluded.updated_by,
                   updated_at = now()`,
    [customerId, dbKey, JSON.stringify(mapped), user.id]
  )
  return getCustomerById(customerId)
}

export async function enableOptionalCategory(customerId, categoryKey, user) {
  const defs = await loadCategoryDefs()
  const def = defs.find((d) => d.key === categoryKey || d.dbKey === categoryKey)
  if (!def) throw new HttpError(404, 'Unknown category')
  if (!def.optional) throw new HttpError(400, 'Category is not optional')

  await withTransaction(async (client) => {
    await client.query(
      `insert into customer_categories (customer_id, category, updated_by)
       values ($1, $2, $3)
       on conflict (customer_id, category) do nothing`,
      [customerId, def.dbKey, user.id]
    )
    for (const sub of def.subStages) {
      await client.query(
        `insert into customer_sub_stages (customer_id, category, sub_stage_key, value, updated_by)
         values ($1, $2, $3, $4, $5)
         on conflict (customer_id, category, sub_stage_key) do nothing`,
        [customerId, def.dbKey, sub.dbKey, toDbStatus(sub.options[0]), user.id]
      )
    }
    await client.query(
      `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
      [customerId, `${def.label} enabled`, user.id]
    )
  })
  return getCustomerById(customerId)
}

export async function disableOptionalCategory(customerId, categoryKey, user) {
  const defs = await loadCategoryDefs()
  const def = defs.find((d) => d.key === categoryKey || d.dbKey === categoryKey)
  if (!def?.optional) throw new HttpError(400, 'Only optional categories can be disabled')

  await withTransaction(async (client) => {
    await client.query(
      `delete from customer_sub_stages where customer_id = $1 and category = $2`,
      [customerId, def.dbKey]
    )
    await client.query(
      `delete from customer_categories where customer_id = $1 and category = $2`,
      [customerId, def.dbKey]
    )
    await client.query(
      `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
      [customerId, `${def.label} marked not applicable`, user.id]
    )
  })
  return getCustomerById(customerId)
}

export async function addPayment(customerId, payment, user) {
  const { rows } = await query(
    `insert into payments (customer_id, amount, mode, paid_on, created_by)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [
      customerId,
      Number(payment.amount),
      toDbPaymentMode(payment.mode),
      payment.date,
      user.id,
    ]
  )
  await query(
    `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
    [
      customerId,
      `Payment recorded: ₹${Number(payment.amount).toLocaleString('en-IN')} (${toFePaymentMode(payment.mode)})`,
      user.id,
    ]
  )
  return {
    id: rows[0].id,
    amount: Number(rows[0].amount),
    mode: toFePaymentMode(rows[0].mode),
    date: rows[0].paid_on,
  }
}

export async function listPayments(customerId) {
  const { rows } = await query(
    `select * from payments where customer_id = $1 order by paid_on desc`,
    [customerId]
  )
  return rows.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    mode: toFePaymentMode(p.mode),
    date: p.paid_on,
  }))
}

export async function addDocument(customerId, { type, customName, fileName, fileUrl }, user) {
  const resolved = resolveDocumentType(type, customName)
  const { rows } = await query(
    `insert into documents (customer_id, doc_type, custom_name, file_name, file_url, uploaded_by)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [customerId, resolved.docType, resolved.customName, fileName, fileUrl, user.id]
  )
  await query(
    `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
    [customerId, `Document uploaded: ${resolved.customName || toFeDocumentType(resolved.docType)}`, user.id]
  )
  return {
    id: rows[0].id,
    type: rows[0].custom_name || toFeDocumentType(rows[0].doc_type),
    customName: rows[0].custom_name || null,
    fileName: rows[0].file_name,
    fileUrl: rows[0].file_url,
    uploadedAt: rows[0].uploaded_at,
  }
}

export async function addPhoto(customerId, { caption, fileUrl }, user) {
  const { rows } = await query(
    `insert into photos (customer_id, file_url, caption, uploaded_by)
     values ($1, $2, $3, $4) returning *`,
    [customerId, fileUrl, caption || null, user.id]
  )
  await query(
    `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
    [customerId, 'Installation photo uploaded', user.id]
  )
  return {
    id: rows[0].id,
    fileUrl: rows[0].file_url,
    caption: rows[0].caption || '',
    uploadedAt: rows[0].uploaded_at,
  }
}

export async function updateSubsidyMeta(customerId, { subsidyAmount, subsidyReceivedDate }, user) {
  await query(
    `update customers
     set subsidy_amount = coalesce($1, subsidy_amount),
         subsidy_received_date = coalesce($2, subsidy_received_date)
     where id = $3`,
    [
      subsidyAmount == null ? null : Number(subsidyAmount),
      subsidyReceivedDate || null,
      customerId,
    ]
  )
  await query(
    `insert into activity_log (customer_id, action, performed_by) values ($1, $2, $3)`,
    [customerId, 'Subsidy details updated', user.id]
  )
  return getCustomerById(customerId)
}

export async function getDashboardSummary() {
  const { rows } = await query(
    `select
       count(*) filter (where is_active = true)::int as total,
       count(*) filter (where is_active = false)::int as inactive,
       count(*) filter (where is_active = true and overall_status = 'New')::int as new_count,
       count(*) filter (where is_active = true and overall_status = 'In Progress')::int as progress_count,
       count(*) filter (where is_active = true and overall_status = 'Completed')::int as completed_count
     from customers`
  )
  const summary = rows[0]
  return {
    total: summary.total,
    inactive: summary.inactive,
    counts: {
      New: summary.new_count,
      'In progress': summary.progress_count,
      Completed: summary.completed_count,
    },
  }
}

export async function getRecentActivity(limit = 10) {
  const { rows } = await query(
    `select a.id, a.action, a.created_at, c.id as customer_id, c.name as customer_name,
            c.overall_status, u.name as user_name
     from activity_log a
     join customers c on c.id = a.customer_id
     left join users u on u.id = a.performed_by
     order by a.created_at desc
     limit $1`,
    [limit]
  )
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    at: r.created_at,
    user: r.user_name || 'System',
    customer: {
      id: r.customer_id,
      name: r.customer_name,
      overallStatus: toFeStatus(r.overall_status),
    },
  }))
}
