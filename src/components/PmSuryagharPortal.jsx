import { useEffect, useMemo, useState } from 'react'
import StatusBadge from './StatusBadge'
import { calculateExpectedSubsidy, getPmSuryagharProgress, parseCapacityKW } from '../data/mockData'
import { currentOpenStageIndex, isStageDone } from '../lib/pipeline'

const STAGE_HINTS = {
  application: 'Application submitted on the national PM Surya Ghar portal',
  bankVerification: 'Bank account details verified for Direct Benefit Transfer',
  installationUploaded: 'Plant details, photos & documents uploaded by vendor',
  discomInspection: 'DISCOM site inspection / commissioning clearance',
  subsidyRequest: 'Consumer / office redeemed subsidy claim (e-token)',
  subsidy: 'Central subsidy disbursed to linked bank account',
}

function dateKey(subKey) {
  return `${subKey}Date`
}

function todayForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export default function PmSuryagharPortal({
  customer,
  categoryDef,
  data,
  notes,
  subsidyAmount,
  subsidyReceivedDate,
  onSave,
  saving,
}) {
  const def = categoryDef
  const initialDraft = useMemo(() => {
    const source = data || {}
    const values = {}
    const dates = {}
    def.subStages.forEach((sub) => {
      values[sub.key] = source[sub.key] || sub.options[0]
      dates[sub.key] = source[dateKey(sub.key)] || ''
    })
    return {
      values,
      dates,
      notes: notes || '',
      subsidyAmount: subsidyAmount ?? '',
      subsidyReceivedDate: subsidyReceivedDate || '',
    }
  }, [def, data, notes, subsidyAmount, subsidyReceivedDate])

  const [draft, setDraft] = useState(initialDraft)
  const [savedMsg, setSavedMsg] = useState('')
  const progress = getPmSuryagharProgress(draft.values, def)
  const savedOpenIndex = currentOpenStageIndex(def, data)
  const estimate = calculateExpectedSubsidy(parseCapacityKW(customer.solarCapacity))
  const today = todayForInput()

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  async function handleStageSave(sub) {
    setSavedMsg('')
    const payload = {
      subStages: [{
        key: sub.key,
        value: draft.values[sub.key],
        date: draft.dates[sub.key] || null,
      }],
      notes: draft.notes,
    }
    if (sub.key === 'subsidy') {
      payload.subsidyAmount =
        draft.subsidyAmount === '' ? null : Number(draft.subsidyAmount)
      payload.subsidyReceivedDate = draft.subsidyReceivedDate || null
    }
    try {
      await onSave(payload)
      setSavedMsg(sub.key)
      setTimeout(() => setSavedMsg(''), 2000)
    } catch {
      /* parent surfaces the error */
    }
  }

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
            <span>
              {progress.done}/{progress.total} stages complete
            </span>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="ui-label">Portal follow-up notes</label>
          <textarea
            rows={2}
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Saved together with the stage you update"
          />
        </div>

        {def.subStages.map((sub, index) => {
          const value = draft.values[sub.key] || sub.options[0]
          const complete = isStageDone(def.key, value)
          const isCurrent = index === savedOpenIndex
          const statusEditable = index === savedOpenIndex
          const dateEditable = statusEditable || complete
          const canSave = statusEditable || complete

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
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-ink">{sub.label}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">{STAGE_HINTS[sub.key]}</div>
                  {!statusEditable && (
                    <div className="mt-1 text-[11px] font-medium text-ink-soft">
                      {complete
                        ? 'Completed · status locked; dates can be corrected'
                        : 'Complete the current step first'}
                    </div>
                  )}
                  {sub.key === 'subsidy' && (
                    <div className="mt-1 text-xs font-semibold text-blue-700">
                      Est. ₹{estimate.toLocaleString('en-IN')}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="ui-label">Status</label>
                      <select
                        disabled={!statusEditable}
                        value={value}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            values: { ...d.values, [sub.key]: e.target.value },
                          }))
                        }
                      >
                        {sub.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="ui-label">Date</label>
                      <input
                        type="date"
                        disabled={!dateEditable}
                        max={today}
                        value={draft.dates[sub.key] || ''}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            dates: { ...d.dates, [sub.key]: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {sub.key === 'subsidy' && (
                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 sm:grid-cols-2">
                  <div>
                    <label className="ui-label">Subsidy amount received (₹)</label>
                    <input
                      type="number"
                      disabled={!canSave}
                      placeholder="e.g. 78000"
                      value={draft.subsidyAmount}
                      onChange={(e) => setDraft((d) => ({ ...d, subsidyAmount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="ui-label">Subsidy received date</label>
                    <input
                      type="date"
                      disabled={!canSave}
                      max={today}
                      value={draft.subsidyReceivedDate}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, subsidyReceivedDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className="ui-btn-primary"
                  disabled={saving || !canSave}
                  onClick={() => handleStageSave(sub)}
                >
                  Save
                </button>
                {savedMsg === sub.key && (
                  <span className="text-sm font-semibold text-green-600">Saved</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
