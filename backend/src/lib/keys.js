/** Map frontend camelCase keys <-> DB snake_case enums/keys */

export const CATEGORY_TO_DB = {
  nameChange: 'name_change',
  rooftopSolar: 'rooftop_solar',
  pmSuryaghar: 'pm_suryaghar',
  finance: 'finance',
  installation: 'installation',
  closure: 'closure',
}

export const CATEGORY_TO_FE = Object.fromEntries(
  Object.entries(CATEGORY_TO_DB).map(([fe, db]) => [db, fe])
)

export const SUBSTAGE_TO_DB = {
  docReceived: 'doc_received',
  appSubmitted: 'app_submitted',
  demand: 'demand',
  application: 'application',
  bankVerification: 'bank_verification',
  installationUploaded: 'installation_uploaded',
  discomInspection: 'discom_inspection',
  subsidyRequest: 'subsidy_request',
  subsidy: 'subsidy',
  bankLoan: 'bank_loan',
  fabricationMaterial: 'fabrication_material',
  fabricationWork: 'fabrication_work',
  panelInstallation: 'panel_installation',
  wiring: 'wiring',
  releaseOrder: 'release_order',
  meterInstallation: 'meter_installation',
  projectClosed: 'project_closed',
}

export const SUBSTAGE_TO_FE = Object.fromEntries(
  Object.entries(SUBSTAGE_TO_DB).map(([fe, db]) => [db, fe])
)

const STATUS_TO_DB = {
  'In progress': 'In Progress',
  'On hold': 'On Hold',
  'Bank transfer': 'Bank Transfer',
  'Electricity bill': 'Electricity Bill',
  'Bank passbook': 'Bank Passbook',
  'Not applicable': 'Not Applicable',
  'Request submitted': 'Request Submitted',
}

const STATUS_TO_FE = Object.fromEntries(Object.entries(STATUS_TO_DB).map(([fe, db]) => [db, fe]))

export function toDbCategory(key) {
  if (!key) return key
  if (CATEGORY_TO_DB[key]) return CATEGORY_TO_DB[key]
  if (CATEGORY_TO_FE[key]) return key
  return key
}

export function toFeCategory(key) {
  return CATEGORY_TO_FE[key] || key
}

export function toDbSubStage(key) {
  if (!key) return key
  if (SUBSTAGE_TO_DB[key]) return SUBSTAGE_TO_DB[key]
  if (SUBSTAGE_TO_FE[key]) return key
  // snake_case already
  return key.includes('_') ? key : key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
}

export function toFeSubStage(key) {
  return SUBSTAGE_TO_FE[key] || key
}

export function toDbStatus(value) {
  if (value == null) return value
  return STATUS_TO_DB[value] || value
}

export function toFeStatus(value) {
  if (value == null) return value
  return STATUS_TO_FE[value] || value
}

export function toDbPaymentMode(value) {
  return toDbStatus(value)
}

export function toFePaymentMode(value) {
  return toFeStatus(value)
}

export function toDbDocumentType(value) {
  return toDbStatus(value)
}

export function toFeDocumentType(value) {
  return toFeStatus(value)
}

const KNOWN_DOC_TYPES = new Set(['Aadhaar', 'Electricity Bill', 'Bank Passbook', 'Other'])

export function resolveDocumentType(type, customName) {
  const mapped = toDbDocumentType(type)
  if (mapped && KNOWN_DOC_TYPES.has(mapped) && mapped !== 'Other') {
    return { docType: mapped, customName: null }
  }
  const name = (customName || (mapped !== 'Other' ? type : '') || '').trim()
  return { docType: 'Other', customName: name || 'Other' }
}
