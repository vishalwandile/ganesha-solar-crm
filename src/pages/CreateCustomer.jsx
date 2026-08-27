import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { IconUpload } from '../components/Icons'
import { useCrm } from '../context/CrmContext'
import { DOCUMENT_TYPES } from '../data/mockData'
import { hasFeature } from '../data/features'

const FIELD_GROUPS = [
  {
    title: 'Customer details',
    hint: 'Primary contact and consumer identity',
    accent: 'from-orange-500 to-orange-400',
    fields: [
      { key: 'firstName', label: 'First name', required: true, maxLength: 50 },
      { key: 'middleName', label: 'Middle name', maxLength: 50 },
      { key: 'lastName', label: 'Last name', required: true, maxLength: 50 },
      { key: 'consumerNumber', label: 'Consumer number', required: true, maxLength: 40 },
      { key: 'mobile', label: 'Mobile number', required: true, inputMode: 'numeric', maxLength: 10 },
      { key: 'email', label: 'Email', type: 'email', maxLength: 120 },
    ],
  },
  {
    title: 'Address',
    hint: 'Service location for installation',
    accent: 'from-blue-500 to-blue-400',
    fields: [
      { key: 'address', label: 'Address', full: true, required: true, maxLength: 250 },
      { key: 'village', label: 'Village', required: true, maxLength: 80 },
      { key: 'taluka', label: 'Taluka', required: true, maxLength: 80 },
      { key: 'district', label: 'District', required: true, maxLength: 80 },
      { key: 'pin', label: 'PIN code', required: true, inputMode: 'numeric', maxLength: 6 },
    ],
  },
  {
    title: 'Electricity and solar',
    hint: 'Technical details for the installation',
    accent: 'from-green-500 to-green-400',
    fields: [
      { key: 'electricityConnectionNo', label: 'Electricity connection / bill no.', required: true, maxLength: 50 },
      { key: 'solarCapacity', label: 'Solar capacity (kW)', required: true, type: 'number', min: '0.1', step: '0.1' },
      { key: 'solarModule', label: 'Solar module details', required: true, maxLength: 120 },
      { key: 'inverter', label: 'On-grid inverter details', required: true, maxLength: 120 },
      { key: 'totalDue', label: 'Amount due (₹)', required: true, type: 'number', min: '0', step: '0.01' },
    ],
  },
]
const ALLOWED_UPLOAD_EXTENSIONS = /\.(pdf|doc|docx|png|jpe?g)$/i

export default function CreateCustomer() {
  const navigate = useNavigate()
  const { createCustomer, sessionUser } = useCrm()
  const canUploadDocs = hasFeature(sessionUser, 'documents')
  const [form, setForm] = useState({ enableNameChange: false, enableFinance: false })
  const [files, setFiles] = useState({})
  const [otherDocName, setOtherDocName] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saved, setSaved] = useState(false)

  const standardDocs = DOCUMENT_TYPES.filter((t) => t !== 'Other')

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function validate() {
    const errors = {}
    const value = (key) => String(form[key] || '').trim()
    const namePattern = /^[\p{L}][\p{L}\s'-]*$/u

    for (const key of ['firstName', 'lastName']) {
      if (value(key).length < 2) errors[key] = 'Enter at least 2 characters.'
      else if (!namePattern.test(value(key))) errors[key] = 'Use letters, spaces, apostrophes, or hyphens only.'
    }
    if (value('middleName') && value('middleName').length < 2) {
      errors.middleName = 'Enter at least 2 characters or leave it blank.'
    } else if (value('middleName') && !namePattern.test(value('middleName'))) {
      errors.middleName = 'Use letters, spaces, apostrophes, or hyphens only.'
    }
    if (!/^[A-Za-z0-9/-]{3,40}$/.test(value('consumerNumber'))) {
      errors.consumerNumber = 'Use 3–40 letters, numbers, /, or -.'
    }
    if (!/^[6-9]\d{9}$/.test(value('mobile'))) {
      errors.mobile = 'Enter a valid 10-digit Indian mobile number.'
    }
    if (value('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value('email'))) {
      errors.email = 'Enter a valid email address.'
    }
    for (const key of ['address', 'village', 'taluka', 'district']) {
      if (value(key).length < 2) errors[key] = 'Enter at least 2 characters.'
    }
    if (!/^\d{6}$/.test(value('pin'))) errors.pin = 'Enter a valid 6-digit PIN code.'
    if (value('electricityConnectionNo').length < 3) {
      errors.electricityConnectionNo = 'Enter at least 3 characters.'
    }
    const capacity = Number(value('solarCapacity'))
    if (!Number.isFinite(capacity) || capacity <= 0) errors.solarCapacity = 'Enter a capacity greater than 0.'
    if (value('solarModule').length < 2) errors.solarModule = 'Enter solar module details.'
    if (value('inverter').length < 2) errors.inverter = 'Enter inverter details.'
    const totalDue = Number(value('totalDue'))
    if (!value('totalDue') || !Number.isFinite(totalDue) || totalDue < 0) {
      errors.totalDue = 'Enter a valid amount of 0 or more.'
    }
    if (files.Other && otherDocName.trim().length < 2) {
      errors.otherDocument = 'Enter at least 2 characters for the document name.'
    }
    for (const file of Object.values(files)) {
      if (!file) continue
      if (file.size > 500 * 1024) errors.files = 'Every file must be 500 KB or smaller.'
      if (!ALLOWED_UPLOAD_EXTENSIONS.test(file.name)) {
        errors.files = 'Only PDF, DOC, DOCX, PNG, JPG, and JPEG files are allowed.'
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!validate()) return

    setSaved(true)
    try {
      const uploadFiles = { ...files }
      if (files.Other) {
        uploadFiles.Other = { file: files.Other, name: otherDocName.trim() }
      }
      const created = await createCustomer(form, canUploadDocs ? uploadFiles : {})
      navigate(`/customers/${created.id}`)
    } catch (err) {
      setSaved(false)
      setError(err.message || 'Failed to save customer')
    }
  }

  return (
    <Layout title="Add customer" subtitle="Create a new solar consumer record">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5">
        {FIELD_GROUPS.map((group) => (
          <div key={group.title} className="ui-surface overflow-hidden">
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <div className={`mt-0.5 h-8 w-1.5 rounded-full bg-gradient-to-b ${group.accent}`} />
              <div>
                <div className="text-sm font-bold text-ink">{group.title}</div>
                <div className="text-xs text-ink-muted">{group.hint}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
              {group.fields.map((f) => (
                <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
                  <label className="ui-label">
                    {f.label}
                    {f.required ? ' *' : ''}
                  </label>
                  <input
                    placeholder={f.label}
                    value={form[f.key] || ''}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    required={f.required}
                    type={f.type || 'text'}
                    inputMode={f.inputMode}
                    maxLength={f.maxLength}
                    min={f.min}
                    step={f.step}
                    aria-invalid={Boolean(fieldErrors[f.key])}
                    className={fieldErrors[f.key] ? 'border-red-400 focus:border-red-500' : ''}
                  />
                  {fieldErrors[f.key] && (
                    <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors[f.key]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="ui-surface p-5">
          <label className="flex cursor-pointer items-start gap-3 border-b border-slate-100 pb-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
              checked={!!form.enableNameChange}
              onChange={(e) => handleChange('enableNameChange', e.target.checked)}
            />
            <span>
              <span className="block text-sm font-bold text-ink">Enable Name Change track</span>
              <span className="text-xs text-ink-muted">
                Optional — only when consumer name change is required before solar application.
              </span>
            </span>
          </label>
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
              checked={!!form.enableFinance}
              onChange={(e) => handleChange('enableFinance', e.target.checked)}
            />
            <span>
              <span className="block text-sm font-bold text-ink">Enable Finance / Loan track</span>
              <span className="text-xs text-ink-muted">
                Enable when this customer is applying for a bank loan.
              </span>
            </span>
          </label>
        </div>

        {canUploadDocs && (
          <div className="ui-surface overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-sm font-bold text-ink">Documents</div>
            <div className="text-xs text-ink-muted">
              PDF, DOC, DOCX, PNG, JPG, or JPEG · maximum 500 KB
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
            {standardDocs.map((doc) => (
              <label
                key={doc}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed px-3 py-6 text-center transition ${
                  files[doc]
                    ? 'border-green-400 bg-green-50/60'
                    : 'border-slate-300 bg-slate-50/60 hover:border-orange-400 hover:bg-orange-50/50'
                }`}
              >
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) =>
                    setFiles((prev) => ({ ...prev, [doc]: e.target.files?.[0] || null }))
                  }
                />
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 text-white shadow-soft">
                  <IconUpload className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-ink">{doc}</span>
                <span className="text-[11px] text-ink-soft">
                  {files[doc] ? files[doc].name : 'Choose file'}
                </span>
              </label>
            ))}
          </div>
          <div className="border-t border-slate-100 p-5">
            <div className="mb-2 text-xs font-semibold text-ink">Other document</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="ui-label">Document name</label>
                <input
                  value={otherDocName}
                  onChange={(e) => setOtherDocName(e.target.value)}
                  placeholder="e.g. PAN card, NOC"
                />
              </div>
              <div>
                <label className="ui-label">File</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:border-blue-500 hover:bg-blue-50">
                  <IconUpload className="h-5 w-5" />
                  <span className="min-w-0 truncate">{files.Other?.name || 'Choose file'}</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      setFiles((prev) => ({ ...prev, Other: e.target.files?.[0] || null }))
                      setFieldErrors((prev) => ({ ...prev, otherDocument: '' }))
                    }}
                  />
                </label>
              </div>
            </div>
            {fieldErrors.otherDocument && (
              <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.otherDocument}</p>
            )}
            {fieldErrors.files && (
              <p className="mt-2 text-xs font-medium text-red-600">{fieldErrors.files}</p>
            )}
          </div>
        </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="ui-btn-primary" disabled={saved}>
            Save
          </button>
          <button type="button" onClick={() => navigate('/customers')} className="ui-btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  )
}
