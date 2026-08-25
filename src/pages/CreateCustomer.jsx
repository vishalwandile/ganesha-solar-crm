import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { IconDoc } from '../components/Icons'
import { useCrm } from '../context/CrmContext'
import { DOCUMENT_TYPES } from '../data/mockData'
import { hasFeature } from '../data/features'

const FIELD_GROUPS = [
  {
    title: 'Customer details',
    hint: 'Primary contact and consumer identity',
    accent: 'from-orange-500 to-orange-400',
    fields: [
      { key: 'firstName', label: 'First name', required: true },
      { key: 'middleName', label: 'Middle name' },
      { key: 'lastName', label: 'Last name', required: true },
      { key: 'consumerNumber', label: 'Consumer number', required: true },
      { key: 'mobile', label: 'Mobile number', required: true },
      { key: 'email', label: 'Email' },
    ],
  },
  {
    title: 'Address',
    hint: 'Service location for installation',
    accent: 'from-blue-500 to-blue-400',
    fields: [
      { key: 'address', label: 'Address', full: true },
      { key: 'village', label: 'Village' },
      { key: 'taluka', label: 'Taluka' },
      { key: 'district', label: 'District' },
      { key: 'pin', label: 'PIN code' },
    ],
  },
  {
    title: 'Electricity and solar',
    hint: 'Technical details for the installation',
    accent: 'from-green-500 to-green-400',
    fields: [
      { key: 'electricityConnectionNo', label: 'Electricity connection / bill no.' },
      { key: 'solarCapacity', label: 'Solar capacity (kW)', required: true },
      { key: 'solarModule', label: 'Solar module details' },
      { key: 'inverter', label: 'On-grid inverter details' },
      { key: 'totalDue', label: 'Amount due (₹)' },
    ],
  },
]

export default function CreateCustomer() {
  const navigate = useNavigate()
  const { createCustomer, sessionUser } = useCrm()
  const canUploadDocs = hasFeature(sessionUser, 'documents')
  const [form, setForm] = useState({ enableNameChange: false })
  const [files, setFiles] = useState({})
  const [otherDocName, setOtherDocName] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const standardDocs = DOCUMENT_TYPES.filter((t) => t !== 'Other')

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (
      !form.firstName?.trim() ||
      !form.lastName?.trim() ||
      !form.consumerNumber?.trim() ||
      !form.mobile?.trim()
    ) {
      setError('First name, last name, consumer number, and mobile are required.')
      return
    }

    if (files.Other && !otherDocName.trim()) {
      setError('Enter a name for the other document.')
      return
    }

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
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="ui-surface p-5">
          <label className="flex cursor-pointer items-start gap-3">
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
        </div>

        {canUploadDocs && (
        <div className="ui-surface overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-sm font-bold text-ink">Documents</div>
            <div className="text-xs text-ink-muted">Aadhaar, electricity bill, bank passbook, or any other document</div>
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
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setFiles((prev) => ({ ...prev, [doc]: e.target.files?.[0] || null }))
                  }
                />
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-soft ring-1 ring-slate-200">
                  <IconDoc className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-ink">{doc}</span>
                <span className="text-[11px] text-ink-soft">
                  {files[doc] ? files[doc].name : 'Click to upload'}
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
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) =>
                    setFiles((prev) => ({ ...prev, Other: e.target.files?.[0] || null }))
                  }
                />
                {files.Other && (
                  <p className="mt-1 text-[11px] text-ink-soft">{files.Other.name}</p>
                )}
              </div>
            </div>
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
            {saved ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => navigate('/customers')} className="ui-btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  )
}
