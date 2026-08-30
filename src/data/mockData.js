// Mock data for Ganesha Solar Services CRM
// Reflects the finalized category / sub-stage structure from the requirements doc.

// Reference "today" for aging calculations, so the mock data's day-counts stay stable.
export const CURRENT_DATE = '2026-08-11'

// PM Suryaghar subsidy slab: Rs 30,000/kW up to 2kW, then Rs 18,000 for the 3rd kW,
// capped at Rs 78,000 for 3kW and above. Indicative estimate only — always confirm
// against the official portal for the exact sanctioned amount.
export function calculateExpectedSubsidy(capacityKW) {
  if (!capacityKW || capacityKW <= 0) return 0
  if (capacityKW <= 2) return Math.round(30000 * capacityKW)
  if (capacityKW < 3) return Math.round(60000 + (capacityKW - 2) * 18000)
  return 78000
}

export function parseCapacityKW(capacityString) {
  const match = /([\d.]+)/.exec(capacityString || '')
  return match ? parseFloat(match[1]) : 0
}

export function daysBetween(dateStr, refDateStr = CURRENT_DATE) {
  const d1 = new Date(dateStr)
  const d2 = new Date(refDateStr)
  return Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)))
}

export const CATEGORY_DEFS = [
  {
    key: 'nameChange',
    label: 'Name change',
    owner: 'Office',
    optional: true,
    subStages: [
      { key: 'docReceived', label: 'Document received', options: ['Pending', 'Completed'] },
      { key: 'appSubmitted', label: 'Application submitted', options: ['Pending', 'Completed'] },
      { key: 'demand', label: 'Demand', options: ['Pending', 'Completed'] },
      { key: 'application', label: 'Application', options: ['Pending', 'Approved', 'Rejected'] },
    ],
  },
  {
    key: 'rooftopSolar',
    label: 'Rooftop solar',
    owner: 'Office',
    optional: false,
    subStages: [
      { key: 'appSubmitted', label: 'Application submitted', options: ['Pending', 'Completed'] },
    ],
  },
  {
    key: 'pmSuryaghar',
    label: 'PM Suryaghar',
    owner: 'Office',
    optional: false,
    subStages: [
      { key: 'application', label: 'Application', options: ['Pending', 'Completed'] },
      { key: 'bankVerification', label: 'Bank details verification', options: ['Pending', 'Completed'] },
      { key: 'installationUploaded', label: 'Installation details uploaded', options: ['Pending', 'Completed'] },
      { key: 'discomInspection', label: 'Inspection from DISCOM', options: ['Pending', 'Completed'] },
      { key: 'subsidyRequest', label: 'Subsidy request', options: ['Pending', 'Claimed'] },
      { key: 'subsidy', label: 'Subsidy', options: ['Pending', 'Disbursed'] },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    owner: 'Account',
    optional: true,
    subStages: [
      { key: 'bankLoan', label: 'Bank loan', options: ['Not applicable', 'Request submitted', 'Approved', 'Completed', 'Rejected'] },
    ],
  },
  {
    key: 'installation',
    label: 'Installation',
    owner: 'Installation team',
    optional: false,
    subStages: [
      { key: 'fabricationMaterial', label: 'Fabrication material dispatched', options: ['No', 'Yes'] },
      { key: 'fabricationWork', label: 'Fabrication work', options: ['Pending', 'Completed'] },
      { key: 'panelInstallation', label: 'Solar panel installation', options: ['Pending', 'Completed'] },
      { key: 'wiring', label: 'Wiring', options: ['Pending', 'Completed'] },
      { key: 'releaseOrder', label: 'Release order', options: ['Pending', 'Completed'] },
      { key: 'meterInstallation', label: 'Meter installation', options: ['Pending', 'Completed'] },
    ],
  },
  {
    key: 'closure',
    label: 'Closure',
    owner: 'Office',
    optional: false,
    subStages: [
      { key: 'projectClosed', label: 'Project closed', options: ['No', 'Yes'] },
    ],
  },
]

export const DOCUMENT_TYPES = ['Aadhaar', 'Electricity bill', 'Bank passbook', 'Other']

export const PAYMENT_MODES = ['Cash', 'Bank transfer', 'Cheque', 'UPI']

export const TEAMS = ['Admin', 'Installation', 'Sales', 'Office', 'Account', 'Loan']

export const OVERALL_STATUSES = ['New', 'In progress', 'Completed']

export const USERS = [
  { id: 'u1', name: 'Vishal Wandile', team: 'Admin', username: 'vishal.wandile', permissions: 'All categories' },
  { id: 'u2', name: 'Priya Sawant', team: 'Office', username: 'priya.sawant', permissions: 'Name change, Rooftop solar, PM Suryaghar, Closure' },
  { id: 'u3', name: 'Ganesh More', team: 'Sales', username: 'ganesh.more', permissions: 'View only' },
  { id: 'u4', name: 'Sunita Jadhav', team: 'Account', username: 'sunita.jadhav', permissions: 'Finance' },
  { id: 'u5', name: 'Vikas Pawar', team: 'Installation', username: 'vikas.pawar', permissions: 'Installation' },
]

export const CUSTOMERS = [
  {
    id: 'c1',
    name: 'Suresh Patil',
    consumerNumber: 'CN-104822',
    mobile: '98202 11345',
    email: 'suresh.patil@example.com',
    address: 'Plot 12, Shivaji Nagar',
    village: 'Wadgaon',
    taluka: 'Haveli',
    district: 'Pune',
    pin: '412115',
    electricityConnectionNo: 'EB-88213',
    solarCapacity: '4 kW',
    solarModule: 'Waaree 540W Mono PERC x 8',
    inverter: 'Growatt 4kW on-grid',
    overallStatus: 'In progress',
    createdAt: '2026-06-02',
    categories: {
      nameChange: { docReceived: 'Completed', appSubmitted: 'Completed', demand: 'Pending', application: 'Rejected', rejectionReason: 'Name mismatch between Aadhaar and electricity bill' },
      rooftopSolar: { appSubmitted: 'Completed' },
      pmSuryaghar: { application: 'Completed', bankVerification: 'Completed', installationUploaded: 'Pending', discomInspection: 'Pending', subsidyRequest: 'Pending', subsidy: 'Pending' },
      finance: { bankLoan: 'Not applicable' },
      installation: { fabricationMaterial: 'Yes', fabricationWork: 'Completed', panelInstallation: 'Completed', wiring: 'Pending', releaseOrder: 'Pending', meterInstallation: 'Pending' },
      closure: { projectClosed: 'No' },
    },
    categoryUpdatedAt: {
      nameChange: '2026-07-22',
      rooftopSolar: '2026-06-05',
      pmSuryaghar: '2026-07-10',
      finance: '2026-06-02',
      installation: '2026-07-18',
      closure: '2026-06-02',
    },
    categoryNotes: {
      nameChange: 'Rejected due to name mismatch — asked customer for a fresh affidavit.',
      pmSuryaghar: 'Waiting on DISCOM inspection slot, follow up Friday.',
    },
    documents: [
      { type: 'Aadhaar', fileName: 'suresh_aadhaar.pdf', uploadedAt: '2026-06-02' },
      { type: 'Electricity bill', fileName: 'suresh_eb_bill.pdf', uploadedAt: '2026-06-02' },
    ],
    payments: [
      { id: 'p1', amount: 25000, mode: 'UPI', date: '2026-06-05' },
      { id: 'p2', amount: 20000, mode: 'Bank transfer', date: '2026-07-01' },
    ],
    totalDue: 180000,
    photos: [
      { id: 'ph1', caption: 'Roof survey', uploadedAt: '2026-06-03' },
      { id: 'ph2', caption: 'Panel mounting', uploadedAt: '2026-07-20' },
    ],
    history: [
      { id: 'h1', action: 'Customer created', user: 'Priya Sawant', at: '2026-06-02 10:15' },
      { id: 'h2', action: 'Fabrication work marked completed', user: 'Vikas Pawar', at: '2026-07-18 14:02' },
      { id: 'h3', action: 'Name change application rejected', user: 'Priya Sawant', at: '2026-07-22 09:40' },
    ],
  },
  {
    id: 'c2',
    name: 'Anita Deshmukh',
    consumerNumber: 'CN-104790',
    mobile: '99873 44210',
    email: 'anita.d@example.com',
    address: '45 Gokhale Road',
    village: 'Loni',
    taluka: 'Shirur',
    district: 'Pune',
    pin: '412208',
    electricityConnectionNo: 'EB-77120',
    solarCapacity: '3 kW',
    solarModule: 'Adani 540W Mono PERC x 6',
    inverter: 'Solis 3kW on-grid',
    overallStatus: 'Completed',
    createdAt: '2026-04-11',
    categories: {
      nameChange: null,
      rooftopSolar: { appSubmitted: 'Completed' },
      pmSuryaghar: { application: 'Completed', bankVerification: 'Completed', installationUploaded: 'Completed', discomInspection: 'Completed', subsidyRequest: 'Claimed', subsidy: 'Disbursed' },
      finance: { bankLoan: 'Not applicable' },
      installation: { fabricationMaterial: 'Yes', fabricationWork: 'Completed', panelInstallation: 'Completed', wiring: 'Completed', releaseOrder: 'Completed', meterInstallation: 'Completed' },
      closure: { projectClosed: 'Yes' },
    },
    categoryUpdatedAt: {
      rooftopSolar: '2026-04-15',
      pmSuryaghar: '2026-06-25',
      finance: '2026-04-11',
      installation: '2026-06-10',
      closure: '2026-06-28',
    },
    categoryNotes: {},
    documents: [
      { type: 'Aadhaar', fileName: 'anita_aadhaar.pdf', uploadedAt: '2026-04-11' },
      { type: 'Electricity bill', fileName: 'anita_eb_bill.pdf', uploadedAt: '2026-04-11' },
      { type: 'Bank passbook', fileName: 'anita_passbook.pdf', uploadedAt: '2026-04-12' },
    ],
    payments: [
      { id: 'p3', amount: 90000, mode: 'Bank transfer', date: '2026-04-15' },
      { id: 'p4', amount: 60000, mode: 'Cheque', date: '2026-05-20' },
    ],
    totalDue: 150000,
    subsidyAmount: 78000,
    subsidyReceivedDate: '2026-06-25',
    photos: [
      { id: 'ph3', caption: 'Completed installation', uploadedAt: '2026-06-10' },
    ],
    history: [
      { id: 'h4', action: 'Customer created', user: 'Priya Sawant', at: '2026-04-11 11:00' },
      { id: 'h5', action: 'Subsidy disbursed', user: 'Priya Sawant', at: '2026-06-25 16:20' },
      { id: 'h6', action: 'Project closed', user: 'Priya Sawant', at: '2026-06-28 12:00' },
    ],
  },
  {
    id: 'c3',
    name: 'Vikram Joshi',
    consumerNumber: 'CN-104655',
    mobile: '90210 88765',
    email: 'vikram.joshi@example.com',
    address: '9 Station Road',
    village: 'Manchar',
    taluka: 'Ambegaon',
    district: 'Pune',
    pin: '410503',
    electricityConnectionNo: 'EB-65021',
    solarCapacity: '5 kW',
    solarModule: 'Waaree 540W Mono PERC x 10',
    inverter: 'Growatt 5kW on-grid',
    overallStatus: 'In progress',
    createdAt: '2026-05-20',
    categories: {
      nameChange: null,
      rooftopSolar: { appSubmitted: 'Completed' },
      pmSuryaghar: { application: 'Completed', bankVerification: 'Pending', installationUploaded: 'Pending', discomInspection: 'Pending', subsidyRequest: 'Pending', subsidy: 'Pending' },
      finance: { bankLoan: 'Rejected', bankName: 'Bank of Maharashtra', loanAmount: 200000, amountReceived: 0, receivedDate: null, rejectionReason: 'Insufficient income documentation' },
      installation: { fabricationMaterial: 'No', fabricationWork: 'Pending', panelInstallation: 'Pending', wiring: 'Pending', releaseOrder: 'Pending', meterInstallation: 'Pending' },
      closure: { projectClosed: 'No' },
    },
    categoryUpdatedAt: {
      rooftopSolar: '2026-05-25',
      pmSuryaghar: '2026-05-28',
      finance: '2026-06-15',
      installation: '2026-05-20',
      closure: '2026-05-20',
    },
    categoryNotes: {
      finance: 'Customer re-applying with updated income proof, expect resubmission next week.',
    },
    documents: [
      { type: 'Aadhaar', fileName: 'vikram_aadhaar.pdf', uploadedAt: '2026-05-20' },
    ],
    payments: [],
    totalDue: 220000,
    photos: [],
    history: [
      { id: 'h7', action: 'Customer created', user: 'Priya Sawant', at: '2026-05-20 09:30' },
      { id: 'h8', action: 'Bank loan rejected', user: 'Sunita Jadhav', at: '2026-06-15 13:45' },
    ],
  },
  {
    id: 'c4',
    name: 'Meena Kulkarni',
    consumerNumber: 'CN-104910',
    mobile: '97658 12034',
    email: 'meena.k@example.com',
    address: '22 New Colony',
    village: 'Saswad',
    taluka: 'Purandar',
    district: 'Pune',
    pin: '412301',
    electricityConnectionNo: 'EB-91004',
    solarCapacity: '3 kW',
    solarModule: 'Adani 540W Mono PERC x 6',
    inverter: 'Solis 3kW on-grid',
    overallStatus: 'New',
    createdAt: '2026-08-05',
    categories: {
      nameChange: null,
      rooftopSolar: { appSubmitted: 'Pending' },
      pmSuryaghar: { application: 'Pending', bankVerification: 'Pending', installationUploaded: 'Pending', discomInspection: 'Pending', subsidyRequest: 'Pending', subsidy: 'Pending' },
      finance: { bankLoan: 'Not applicable' },
      installation: { fabricationMaterial: 'No', fabricationWork: 'Pending', panelInstallation: 'Pending', wiring: 'Pending', releaseOrder: 'Pending', meterInstallation: 'Pending' },
      closure: { projectClosed: 'No' },
    },
    categoryUpdatedAt: {
      rooftopSolar: '2026-08-05',
      pmSuryaghar: '2026-08-05',
      finance: '2026-08-05',
      installation: '2026-08-05',
      closure: '2026-08-05',
    },
    categoryNotes: {},
    documents: [
      { type: 'Aadhaar', fileName: 'meena_aadhaar.pdf', uploadedAt: '2026-08-05' },
    ],
    payments: [],
    totalDue: 150000,
    photos: [],
    history: [
      { id: 'h9', action: 'Customer created', user: 'Priya Sawant', at: '2026-08-05 15:10' },
    ],
  },
]

export const NOTIFICATIONS = [
  { id: 'n1', text: 'Suresh Patil: name change application rejected', at: '2026-07-22 09:40', read: false },
  { id: 'n2', text: 'Anita Deshmukh: project closed', at: '2026-06-28 12:00', read: true },
  { id: 'n3', text: 'Vikram Joshi: bank loan rejected', at: '2026-06-15 13:45', read: false },
  { id: 'n4', text: 'Suresh Patil: fabrication work marked completed', at: '2026-07-18 14:02', read: true },
]

export function getCategoryStatus(categoryDef, customerCategoryData) {
  if (!customerCategoryData) return 'Not applicable'
  const values = categoryDef.subStages.map((s) => customerCategoryData[s.key])
  if (values.some((v) => v === 'Rejected')) return 'Rejected'

  const isDone = (v) =>
    ['Completed', 'Yes', 'Disbursed', 'Claimed', 'Not applicable'].includes(v) ||
    (v === 'Approved' && categoryDef.key !== 'finance')
  const isStarted = (v) =>
    isDone(v) || ['Request submitted', 'In progress', 'Approved'].includes(v)

  // Finance with bank loan marked N/A is treated as settled for that track.
  if (values.every((v) => v === 'Not applicable')) return 'Not applicable'
  if (values.every(isDone)) return 'Completed'
  if (values.some(isStarted)) return 'In progress'
  return 'Pending'
}

export function getPmSuryagharProgress(data) {
  const def = CATEGORY_DEFS.find((c) => c.key === 'pmSuryaghar')
  if (!data || !def) return { done: 0, total: 0, percent: 0, currentLabel: 'Not started', status: 'Pending' }
  const doneStates = ['Completed', 'Claimed', 'Disbursed', 'Approved', 'Yes']
  const done = def.subStages.filter((s) => doneStates.includes(data[s.key])).length
  const firstPending = def.subStages.find((s) => !doneStates.includes(data[s.key]))
  const total = def.subStages.length
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
    currentLabel: firstPending ? firstPending.label : 'Subsidy complete',
    status: getCategoryStatus(def, data),
  }
}
