import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import CategoryCard from '../components/CategoryCard'
import StageTracker from '../components/StageTracker'
import PmSuryagharPortal from '../components/PmSuryagharPortal'
import {
  IconDoc,
  IconDownload,
  IconEdit,
  IconTrash,
  IconUpload,
  IconView,
} from '../components/Icons'
import { useCrm } from '../context/CrmContext'
import { crmApi } from '../api/crmApi'
import { hasFeature } from '../data/features'
import {
  CATEGORY_DEFS,
  PAYMENT_MODES,
  DOCUMENT_TYPES,
} from '../data/mockData'

const TAB_DEFS = [
  { label: 'Status tracking', feature: 'statusTracking' },
  { label: 'PM Suryaghar', feature: 'pmSuryaghar' },
  { label: 'Documents', feature: 'documents' },
  { label: 'Payments', feature: 'payments' },
]

const EDIT_FIELDS = [
  { key: 'firstName', label: 'First name', required: true },
  { key: 'middleName', label: 'Middle name' },
  { key: 'lastName', label: 'Last name', required: true },
  { key: 'consumerNumber', label: 'Consumer number', required: true },
  { key: 'mobile', label: 'Mobile number', required: true, inputMode: 'numeric', maxLength: 10 },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'address', label: 'Address', required: true, full: true },
  { key: 'village', label: 'Village', required: true },
  { key: 'taluka', label: 'Taluka', required: true },
  { key: 'district', label: 'District', required: true },
  { key: 'pin', label: 'PIN code', required: true, inputMode: 'numeric', maxLength: 6 },
  { key: 'electricityConnectionNo', label: 'Electricity connection / bill no.', required: true },
  { key: 'solarCapacity', label: 'Solar capacity (kW)', required: true, type: 'number', min: '0.1', step: '0.1' },
  { key: 'solarModule', label: 'Solar module details', required: true },
  { key: 'inverter', label: 'On-grid inverter details', required: true },
  { key: 'totalDue', label: 'Amount due (₹)', required: true, type: 'number', min: '0', step: '0.01' },
]

const UPLOAD_TYPES = [...DOCUMENT_TYPES, 'Photo / Image']
const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|png|jpe?g)$/i

function todayForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    customerCache,
    loadCustomer,
    setCustomerActive,
    saveCategory,
    enableCategory,
    disableCategory,
    addPayment,
    addDocument,
    deleteDocument,
    updateCustomer,
    sessionUser,
  } = useCrm()
  const visibleTabs = TAB_DEFS.filter((t) => hasFeature(sessionUser, t.feature)).map((t) => t.label)

  const customer = customerCache[id]
  const [loading, setLoading] = useState(!customer)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(() => visibleTabs[0] || 'Status tracking')
  const [expandedKey, setExpandedKey] = useState(null)
  const [newPayment, setNewPayment] = useState({ amount: '', mode: PAYMENT_MODES[0], date: '' })
  const [paymentError, setPaymentError] = useState('')
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0])
  const [docCustomName, setDocCustomName] = useState('')
  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsDraft, setDetailsDraft] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadCustomer(id)
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load customer')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id, loadCustomer])

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.includes(tab)) {
      setTab(visibleTabs[0])
    }
  }, [tab, visibleTabs])

  if (loading && !customer) {
    return null
  }

  if (!customer) {
    return (
      <Layout title="Customer not found">
        <p className="mb-3 text-sm text-red-600">{error || 'Not found'}</p>
        <button onClick={() => navigate('/customers')} className="ui-btn-secondary">
          Back to customers
        </button>
      </Layout>
    )
  }

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err.message || 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveCategory(categoryKey, payload) {
    setBusy(true)
    setError('')
    try {
      await saveCategory(customer.id, categoryKey, payload)
    } catch (err) {
      setError(err.message || 'Update failed')
      throw err
    } finally {
      setBusy(false)
    }
  }

  function selectCategory(key) {
    if (key === 'pmSuryaghar') {
      setTab('PM Suryaghar')
      return
    }
    setTab('Status tracking')
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  function submitPayment() {
    setPaymentError('')
    if (!newPayment.amount || Number(newPayment.amount) <= 0 || !newPayment.date) {
      setPaymentError('Enter a valid amount and date.')
      return
    }
    if (newPayment.date > todayForInput()) {
      setPaymentError('Payment date cannot be in the future.')
      return
    }
    run(async () => {
      await addPayment(customer.id, newPayment)
      setNewPayment({ amount: '', mode: PAYMENT_MODES[0], date: '' })
    })
  }

  function handleDocUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 500 * 1024) {
      setError('File must be 500 KB or smaller.')
      return
    }
    if (!ALLOWED_EXTENSIONS.test(file.name)) {
      setError('Only PDF, DOC, DOCX, PNG, JPG, and JPEG files are allowed.')
      return
    }
    if (docType === 'Other' && !docCustomName.trim()) {
      setError('Enter a name for this other document.')
      return
    }
    run(async () => {
      await addDocument(customer.id, docType, file, docType === 'Other' ? docCustomName.trim() : '')
      setDocCustomName('')
    })
  }

  function saveBlobAs(url, fileName) {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || 'document'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  async function viewDocument(doc) {
    // Opened before awaiting so the click is still treated as a user gesture.
    const tab = window.open('', '_blank')
    try {
      const { blob } = await crmApi.fetchDocumentBlob(customer.id, doc.id, 'view')
      const url = URL.createObjectURL(blob)
      if (tab) tab.location = url
      else saveBlobAs(url, doc.fileName)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      if (tab) tab.close()
      setError(err.message || 'Could not open this file')
    }
  }

  async function downloadDocument(doc) {
    try {
      const { blob } = await crmApi.fetchDocumentBlob(customer.id, doc.id, 'download')
      const url = URL.createObjectURL(blob)
      saveBlobAs(url, doc.fileName)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setError(err.message || 'Could not download this file')
    }
  }

  function beginEditDetails() {
    setDetailsDraft({
      firstName: customer.firstName,
      middleName: customer.middleName,
      lastName: customer.lastName,
      consumerNumber: customer.consumerNumber,
      mobile: customer.mobile,
      email: customer.email,
      address: customer.address,
      village: customer.village,
      taluka: customer.taluka,
      district: customer.district,
      pin: customer.pin,
      electricityConnectionNo: customer.electricityConnectionNo,
      solarCapacity: customer.solarCapacityKw || '',
      solarModule: customer.solarModule,
      inverter: customer.inverter,
      totalDue: customer.totalDue,
    })
    setEditingDetails(true)
  }

  function saveCustomerDetails(e) {
    e.preventDefault()
    if (!/^[6-9]\d{9}$/.test(detailsDraft.mobile || '')) {
      setError('Enter a valid 10-digit Indian mobile number.')
      return
    }
    if (detailsDraft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(detailsDraft.email)) {
      setError('Enter a valid email address.')
      return
    }
    run(async () => {
      await updateCustomer(customer.id, detailsDraft)
      setEditingDetails(false)
    })
  }

  const loanReceived = Number(customer.categories?.finance?.amountReceived || 0)
  const paymentEntries = [
    ...(customer.payments || []),
    ...(loanReceived > 0
      ? [
          {
            id: 'finance-loan',
            amount: loanReceived,
            mode: 'Loan',
            date: customer.categories?.finance?.receivedDate || '—',
            derivedFromFinance: true,
          },
        ]
      : []),
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  const totalPaid = paymentEntries.reduce((sum, payment) => sum + payment.amount, 0)
  const progress = customer.totalDue
    ? Math.min(100, Math.round((totalPaid / customer.totalDue) * 100))
    : 0
  const otherCategories = CATEGORY_DEFS.filter((c) => c.key !== 'pmSuryaghar')

  return (
    <Layout title={customer.name}>
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      )}
      {!customer.isActive && (
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
          This customer is inactive. Reactivate the customer before continuing pipeline work.
        </div>
      )}

      <div className="ui-surface flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-blue-500 to-green-500 text-base font-extrabold text-white shadow-soft">
            {customer.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </div>
          <div>
            <div className="text-lg font-extrabold tracking-tight text-ink">{customer.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold">
                {customer.consumerNumber}
              </span>
              <span>{customer.mobile}</span>
              <span className="rounded-md bg-green-50 px-2 py-0.5 font-bold text-green-700 ring-1 ring-green-100">
                {customer.solarCapacity}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={customer.overallStatus} />
          {!customer.isActive && <StatusBadge status="Inactive" />}
          <button type="button" className="ui-btn-secondary" onClick={beginEditDetails}>
            <IconEdit className="h-4 w-4" />
            Edit details
          </button>
          {hasFeature(sessionUser, 'inactiveCustomer') &&
            (!customer.isActive || customer.overallStatus !== 'Completed') && (
            <button
              type="button"
              className={customer.isActive ? 'ui-btn-secondary' : 'ui-btn-primary'}
              onClick={() => {
                const action = customer.isActive ? 'mark this customer inactive' : 'reactivate this customer'
                if (window.confirm(`Are you sure you want to ${action}?`)) {
                  run(() => setCustomerActive(customer.id, !customer.isActive))
                }
              }}
            >
              {customer.isActive ? 'Mark inactive' : 'Reactivate'}
            </button>
          )}
        </div>
      </div>

      {editingDetails && detailsDraft && (
        <form onSubmit={saveCustomerDetails} className="ui-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="text-sm font-bold text-ink">Edit customer details</div>
              <div className="text-xs text-ink-muted">Files are managed separately under Documents.</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {EDIT_FIELDS.map((field) => (
              <div key={field.key} className={field.full ? 'sm:col-span-2' : ''}>
                <label className="ui-label">
                  {field.label}
                  {field.required ? ' *' : ''}
                </label>
                <input
                  type={field.type || 'text'}
                  inputMode={field.inputMode}
                  maxLength={field.maxLength}
                  min={field.min}
                  step={field.step}
                  required={field.required}
                  value={detailsDraft[field.key] ?? ''}
                  onChange={(e) =>
                    setDetailsDraft((current) => ({ ...current, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
            <button type="submit" className="ui-btn-primary" disabled={busy}>
              Save details
            </button>
            <button type="button" className="ui-btn-secondary" onClick={() => setEditingDetails(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <StageTracker
        customer={customer}
        onSelect={selectCategory}
        activeKey={tab === 'PM Suryaghar' ? 'pmSuryaghar' : expandedKey}
      />

      {visibleTabs.length > 0 && (
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-soft">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              tab === t
                ? 'bg-orange-500 text-white shadow-soft'
                : 'text-ink-muted hover:bg-slate-50 hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      )}

      {tab === 'Status tracking' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-green-50 px-4 py-3 text-sm">
            <span className="font-semibold text-blue-800">PM Suryaghar</span>
            <span className="text-ink-muted"> has a dedicated portal-style tab. </span>
            {hasFeature(sessionUser, 'pmSuryaghar') ? (
              <button
                type="button"
                className="font-bold text-blue-700 underline"
                onClick={() => setTab('PM Suryaghar')}
              >
                Open PM Suryaghar portal
              </button>
            ) : (
              <span className="text-ink-muted">You do not have access to that tab.</span>
            )}
          </div>
          {otherCategories.map((cat) => (
            <CategoryCard
              key={cat.key}
              categoryDef={cat}
              data={customer.categories?.[cat.key]}
              updatedAt={customer.categoryUpdatedAt?.[cat.key]}
              notes={customer.categoryNotes?.[cat.key]}
              expanded={expandedKey === cat.key}
              onToggle={() => setExpandedKey((prev) => (prev === cat.key ? null : cat.key))}
              onSave={(payload) => handleSaveCategory(cat.key, payload)}
              onEnable={cat.optional ? () => run(() => enableCategory(customer.id, cat.key)) : undefined}
              onDisable={
                cat.optional ? () => run(() => disableCategory(customer.id, cat.key)) : undefined
              }
              saving={busy}
              closureReady={customer.closureReady}
              closureBlockers={customer.closureBlockers || []}
            />
          ))}
        </div>
      )}

      {tab === 'PM Suryaghar' && (
        <PmSuryagharPortal
          customer={customer}
          data={customer.categories?.pmSuryaghar}
          notes={customer.categoryNotes?.pmSuryaghar || ''}
          subsidyAmount={customer.subsidyAmount}
          subsidyReceivedDate={customer.subsidyReceivedDate}
          onSave={(payload) => handleSaveCategory('pmSuryaghar', payload)}
          saving={busy}
        />
      )}

      {tab === 'Documents' && (
        <div className="space-y-4">
          <div className="ui-surface p-5">
            <div className="mb-3 text-sm font-bold text-ink">Upload document</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="sm:w-48">
                <label className="ui-label">Type</label>
                <select
                  value={docType}
                  onChange={(e) => {
                    setDocType(e.target.value)
                    if (e.target.value !== 'Other') setDocCustomName('')
                  }}
                >
                  {UPLOAD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {docType === 'Other' && (
                <div className="flex-1">
                  <label className="ui-label">Document name</label>
                  <input
                    value={docCustomName}
                    onChange={(e) => setDocCustomName(e.target.value)}
                    placeholder="e.g. PAN card, NOC, Agreement"
                  />
                </div>
              )}
              <label className="ui-btn-primary cursor-pointer bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600">
                <IconUpload className="h-4 w-4" />
                Choose file
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={handleDocUpload}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              PDF, DOC, DOCX, PNG, JPG, or JPEG · maximum 500 KB. Images are compressed before upload.
            </p>
            {docType === 'Other' && (
              <p className="mt-2 text-xs text-ink-muted">Type the document name, then choose the file to upload.</p>
            )}
          </div>

          <div className="ui-surface overflow-hidden">
            <div className="divide-y divide-slate-100">
              {(customer.documents || []).map((doc, i) => (
                <div key={doc.id || `${doc.fileName}-${i}`} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <IconDoc className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-ink">{doc.type}</div>
                      <div className="text-xs text-ink-muted">{doc.fileName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs font-medium text-ink-soft sm:inline">
                      {String(doc.uploadedAt || '').slice(0, 10)}
                    </span>
                    <button
                      type="button"
                      onClick={() => viewDocument(doc)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-600 hover:text-white"
                      title="View file"
                      aria-label={`View ${doc.fileName}`}
                    >
                      <IconView className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadDocument(doc)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-green-200 bg-green-50 text-green-700 transition hover:bg-green-600 hover:text-white"
                      title="Download file"
                      aria-label={`Download ${doc.fileName}`}
                    >
                      <IconDownload className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-600 hover:text-white"
                      title="Delete file"
                      aria-label={`Delete ${doc.fileName}`}
                      onClick={() => {
                        if (!window.confirm(`Permanently delete ${doc.fileName}?`)) return
                        run(() => deleteDocument(customer.id, doc.id))
                      }}
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(customer.documents || []).length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-ink-soft">No documents uploaded yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'Payments' && (
        <div className="space-y-4">
          <div className="ui-surface p-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Total received
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-ink">
              &#8377;{totalPaid.toLocaleString('en-IN')}
              <span className="text-base font-semibold text-ink-muted">
                {' '}
                of &#8377;{(customer.totalDue || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 via-blue-500 to-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs font-medium text-ink-muted">{progress}% collected</div>
          </div>

          <div className="ui-surface overflow-hidden">
            <div className="divide-y divide-slate-100">
              {paymentEntries.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <span className="font-bold text-ink">&#8377;{p.amount.toLocaleString('en-IN')}</span>
                  <span
                    className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                      p.derivedFromFinance
                        ? 'bg-green-50 text-green-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {p.mode}
                  </span>
                  <span className="text-right text-ink-soft">
                    {p.date}
                    {p.derivedFromFinance && (
                      <span className="block text-[10px] text-green-700">From Finance</span>
                    )}
                  </span>
                </div>
              ))}
              {paymentEntries.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-ink-soft">No payments recorded yet.</div>
              )}
            </div>
          </div>

          <div className="ui-surface p-5">
            <div className="mb-3 text-sm font-bold text-ink">Add payment</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="ui-label">Amount</label>
                <input
                  placeholder="Amount"
                  type="number"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="ui-label">Mode</label>
                <select
                  value={newPayment.mode}
                  onChange={(e) => setNewPayment((p) => ({ ...p, mode: e.target.value }))}
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label">Date</label>
                <input
                  type="date"
                  max={todayForInput()}
                  value={newPayment.date}
                  onChange={(e) => setNewPayment((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>
            {paymentError && <p className="mt-2 text-xs font-medium text-red-600">{paymentError}</p>}
            <button type="button" onClick={submitPayment} className="ui-btn-primary mt-4">
              Add payment
            </button>
          </div>
        </div>
      )}

    </Layout>
  )
}
