import { useEffect, useState } from 'react'
import StatusBadge from './StatusBadge'
import { CATEGORY_DEFS, calculateExpectedSubsidy, getPmSuryagharProgress, parseCapacityKW } from '../data/mockData'

const STAGE_HINTS = {
  application: 'Application submitted on the national PM Surya Ghar portal',
  bankVerification: 'Bank account details verified for Direct Benefit Transfer',
  installationUploaded: 'Plant details, photos & documents uploaded by vendor',
  discomInspection: 'DISCOM site inspection / commissioning clearance',
  subsidyRequest: 'Consumer / office redeemed subsidy claim (e-token)',
  subsidy: 'Central subsidy disbursed to linked bank account',
}

const DONE = ['Completed', 'Claimed', 'Disbursed', 'Approved', 'Yes']

export default function PmSuryagharPortal({
  customer,
  data,
  onChange,
  notes,
  onNotesChange,
  subsidyAmount,
  subsidyReceivedDate,
  onSubsidyMetaChange,
}) {
  const def = CATEGORY_DEFS.find((c) => c.key === 'pmSuryaghar')
  const stageData =
    data ||
    Object.fromEntries(def.subStages.map((s) => [s.key, s.options[0]]))
  const progress = getPmSuryagharProgress(stageData)
  const estimate = calculateExpectedSubsidy(parseCapacityKW(customer.solarCapacity))
  const [draftNotes, setDraftNotes] = useState(notes || '')

  useEffect(() => {
    setDraftNotes(notes || '')
  }, [notes])

  return (
    <div className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-lift">
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-green-600 px-5 py-6 text-white sm:px-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-400/30 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-28 w-28 rounded-full bg-green-300/20 blur-2xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">
              National portal track
            </div>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight">PM Surya Ghar</h2>
            <p className="mt-1 max-w-xl text-sm text-blue-50/90">
              Internal CRM mirror of portal stages — application → bank → installation → DISCOM →
              subsidy claim → disbursement.
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-100">
              Estimated CFA
            </div>
            <div className="text-2xl font-extrabold">₹{estimate.toLocaleString('en-IN')}</div>
            <div className="text-xs text-blue-100">Based on {customer.solarCapacity} · confirm on portal</div>
          </div>
        </div>

        <div className="relative mt-5">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">
            <span>{progress.done}/{progress.total} stages complete</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 via-white to-green-300 transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg bg-white/15 px-2 py-1 font-medium">
              Current: {progress.currentLabel}
            </span>
            <StatusBadge status={progress.status} />
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-6">
        {def.subStages.map((sub, index) => {
          const value = stageData[sub.key] || sub.options[0]
          const complete = DONE.includes(value)
          const isCurrent = progress.currentLabel === sub.label

          return (
            <div
              key={sub.key}
              className={`rounded-2xl border p-4 transition ${
                isCurrent
                  ? 'border-orange-300 bg-orange-50/60 shadow-soft'
                  : complete
                    ? 'border-green-200 bg-green-50/40'
                    : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                      complete
                        ? 'bg-green-500 text-white'
                        : isCurrent
                          ? 'bg-orange-500 text-white'
                          : 'bg-white text-ink-muted ring-1 ring-slate-200'
                    }`}
                  >
                    {complete ? '✓' : index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink">{sub.label}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">{STAGE_HINTS[sub.key]}</div>
                    {sub.key === 'subsidy' && (
                      <div className="mt-1 text-xs font-semibold text-blue-700">
                        Est. ₹{estimate.toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>

                <select
                  className="w-full lg:w-48"
                  value={value}
                  onChange={(e) => onChange(sub.key, e.target.value)}
                >
                  {sub.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {sub.key === 'subsidy' && (
                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
                  <div>
                    <label className="ui-label">Subsidy amount received (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 78000"
                      value={subsidyAmount ?? ''}
                      onChange={(e) =>
                        onSubsidyMetaChange({
                          subsidyAmount: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="ui-label">Subsidy received date</label>
                    <input
                      type="date"
                      value={subsidyReceivedDate || ''}
                      onChange={(e) =>
                        onSubsidyMetaChange({ subsidyReceivedDate: e.target.value || null })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="ui-label">Portal follow-up notes</label>
          <textarea
            rows={2}
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            onBlur={() => onNotesChange(draftNotes)}
            placeholder="e.g. DISCOM inspection scheduled Friday · bank re-verification pending"
          />
        </div>
      </div>
    </div>
  )
}
