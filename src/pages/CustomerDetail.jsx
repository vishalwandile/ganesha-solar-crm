import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import CategoryCard from '../components/CategoryCard'
import StageTracker from '../components/StageTracker'
import PmSuryagharPortal from '../components/PmSuryagharPortal'
import { IconDoc, IconPlus } from '../components/Icons'
import { useCrm } from '../context/CrmContext'
import {
  CATEGORY_DEFS,
  PAYMENT_MODES,
  DOCUMENT_TYPES,
  OVERALL_STATUSES,
  calculateExpectedSubsidy,
  parseCapacityKW,
} from '../data/mockData'

const TABS = ['Status tracking', 'PM Suryaghar', 'Documents', 'Payments', 'Photos', 'History']

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    customerCache,
    loadCustomer,
    updateOverallStatus,
    updateSubStage,
    updateCategoryNotes,
    updateCategoryExtra,
    enableCategory,
    disableCategory,
    updateSubsidyMeta,
    addPayment,
    addDocument,
    addPhoto,
  } = useCrm()

  const customer = customerCache[id]
  const [loading, setLoading] = useState(!customer)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('Status tracking')
  const [expandedKey, setExpandedKey] = useState(null)
  const [newPayment, setNewPayment] = useState({ amount: '', mode: PAYMENT_MODES[0], date: '' })
  const [paymentError, setPaymentError] = useState('')
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0])
  const [photoCaption, setPhotoCaption] = useState('')
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

  if (loading && !customer) {
    return (
      <Layout title="Loading…">
        <div className="ui-surface px-5 py-10 text-center text-sm text-ink-soft">Loading customer…</div>
      </Layout>
    )
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

  function handleSubChange(categoryKey, subKey, value) {
    if (subKey === 'rejectionReason') {
      run(() => updateCategoryExtra(customer.id, categoryKey, { rejectionReason: value }))
      return
    }
    if (value === 'Rejected') {
      const existing = customer.categories?.[categoryKey]?.rejectionReason
      const reason = existing || window.prompt('Rejection reason (required):')
      if (!reason?.trim()) {
        setError('Rejection reason is required when status is Rejected')
        return
      }
      run(() => updateSubStage(customer.id, categoryKey, subKey, value, reason.trim()))
      return
    }
    run(() => updateSubStage(customer.id, categoryKey, subKey, value))
  }

  function handleNotes(categoryKey, text) {
    run(() => updateCategoryNotes(customer.id, categoryKey, text))
  }

  function handleFinanceMeta(fields) {
    run(() => updateCategoryExtra(customer.id, 'finance', fields))
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
    run(async () => {
      await addPayment(customer.id, newPayment)
      setNewPayment({ amount: '', mode: PAYMENT_MODES[0], date: '' })
    })
  }

  function handleDocUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    run(() => addDocument(customer.id, docType, file))
    e.target.value = ''
  }

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    run(() => addPhoto(customer.id, file, photoCaption || file.name))
    setPhotoCaption('')
    e.target.value = ''
  }

  const totalPaid = (customer.payments || []).reduce((sum, p) => sum + p.amount, 0)
  const expectedSubsidy =
    customer.expectedSubsidy ??
    calculateExpectedSubsidy(parseCapacityKW(customer.solarCapacity))
  const progress = customer.totalDue
    ? Math.min(100, Math.round((totalPaid / customer.totalDue) * 100))
    : 0
  const otherCategories = CATEGORY_DEFS.filter((c) => c.key !== 'pmSuryaghar')

  return (
    <Layout title={customer.name} subtitle={`${customer.consumerNumber} · ${customer.mobile}`}>
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      )}
      {busy && <div className="text-xs font-semibold text-blue-600">Saving…</div>}

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
          <label className="ui-label mb-0 mr-1">Overall status</label>
          <select
            className="w-40"
            value={customer.overallStatus}
            onChange={(e) => run(() => updateOverallStatus(customer.id, e.target.value))}
          >
            {OVERALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <StatusBadge status={customer.overallStatus} />
        </div>
      </div>

      <StageTracker
        customer={customer}
        onSelect={selectCategory}
        activeKey={tab === 'PM Suryaghar' ? 'pmSuryaghar' : expandedKey}
      />

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-soft">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              tab === t
                ? t === 'PM Suryaghar'
                  ? 'bg-blue-600 text-white shadow-soft'
                  : 'bg-orange-500 text-white shadow-soft'
                : 'text-ink-muted hover:bg-slate-50 hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Status tracking' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-green-50 px-4 py-3 text-sm">
            <span className="font-semibold text-blue-800">PM Suryaghar</span>
            <span className="text-ink-muted"> has a dedicated portal-style tab. </span>
            <button
              type="button"
              className="font-bold text-blue-700 underline"
              onClick={() => setTab('PM Suryaghar')}
            >
              Open PM Suryaghar portal
            </button>
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
              onChange={(subKey, value) => handleSubChange(cat.key, subKey, value)}
              onNotesChange={(text) => handleNotes(cat.key, text)}
              onEnable={cat.optional ? () => run(() => enableCategory(customer.id, cat.key)) : undefined}
              onDisable={
                cat.optional ? () => run(() => disableCategory(customer.id, cat.key)) : undefined
              }
              financeFields={cat.key === 'finance' ? customer.categories?.finance : null}
              onFinanceChange={cat.key === 'finance' ? handleFinanceMeta : undefined}
            />
          ))}
        </div>
      )}

      {tab === 'PM Suryaghar' && (
        <PmSuryagharPortal
          customer={customer}
          data={customer.categories?.pmSuryaghar}
          notes={customer.categoryNotes?.pmSuryaghar || ''}
          onNotesChange={(text) => handleNotes('pmSuryaghar', text)}
          onChange={(subKey, value) => handleSubChange('pmSuryaghar', subKey, value)}
          subsidyAmount={customer.subsidyAmount}
          subsidyReceivedDate={customer.subsidyReceivedDate}
          onSubsidyMetaChange={(fields) => run(() => updateSubsidyMeta(customer.id, fields))}
        />
      )}

      {tab === 'Documents' && (
        <div className="space-y-4">
          <div className="ui-surface p-5">
            <div className="mb-3 text-sm font-bold text-ink">Upload document</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="sm:w-48">
                <label className="ui-label">Type</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <label className="ui-btn-primary cursor-pointer">
                <IconPlus className="h-4 w-4" />
                Choose file
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocUpload} />
              </label>
            </div>
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
                  <div className="text-xs font-medium text-ink-soft">
                    {String(doc.uploadedAt || '').slice(0, 10)}
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
              {(customer.payments || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                  <span className="font-bold text-ink">&#8377;{p.amount.toLocaleString('en-IN')}</span>
                  <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                    {p.mode}
                  </span>
                  <span className="text-ink-soft">{p.date}</span>
                </div>
              ))}
              {(customer.payments || []).length === 0 && (
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

      {tab === 'Photos' && (
        <div className="space-y-4">
          <div className="ui-surface p-5">
            <div className="mb-3 text-sm font-bold text-ink">Upload installation photo</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="ui-label">Caption</label>
                <input
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="e.g. Panel mounting complete"
                />
              </div>
              <label className="ui-btn-primary cursor-pointer">
                <IconPlus className="h-4 w-4" />
                Choose photo
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(customer.photos || []).map((p) => (
              <div key={p.id} className="ui-surface overflow-hidden p-3">
                {p.fileUrl ? (
                  <img
                    src={p.fileUrl}
                    alt={p.caption || 'Installation'}
                    className="mb-3 h-32 w-full rounded-xl object-cover ring-1 ring-slate-100"
                  />
                ) : (
                  <div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-gradient-to-br from-orange-50 via-blue-50 to-green-50 text-xs font-semibold text-ink-muted ring-1 ring-slate-100">
                    Installation photo
                  </div>
                )}
                <div className="text-sm font-semibold text-ink">{p.caption}</div>
                <div className="text-xs text-ink-soft">{String(p.uploadedAt || '').slice(0, 10)}</div>
              </div>
            ))}
            {(customer.photos || []).length === 0 && (
              <div className="ui-surface col-span-full px-5 py-10 text-center text-sm text-ink-soft">
                No installation photos uploaded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'History' && (
        <div className="ui-surface overflow-hidden">
          <div className="divide-y divide-slate-100">
            {[...(customer.history || [])].map((h) => (
              <div key={h.id} className="flex gap-3 px-5 py-4">
                <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-400" />
                <div>
                  <div className="text-sm font-semibold text-ink">{h.action}</div>
                  <div className="text-xs text-ink-muted">
                    {h.user} · {String(h.at || '').replace('T', ' ').slice(0, 16)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
