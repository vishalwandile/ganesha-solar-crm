import { useEffect, useMemo, useRef, useState } from 'react'
import StatusBadge from './StatusBadge'
import { IconChevron } from './Icons'
import { getCategoryStatus, daysBetween } from '../data/mockData'
import {
  collectStageChanges,
  isStageDone,
  SEQUENTIAL_CATEGORY_KEYS,
  stageIsSavedDone,
  stagesDoneBefore,
} from '../lib/pipeline'

function dateKey(subKey) {
  return `${subKey}Date`
}

function todayForInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function numOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

export default function CategoryCard({
  categoryDef,
  data,
  updatedAt,
  notes,
  onSave,
  onEnable,
  onDisable,
  expanded,
  onToggle,
  subsidyEstimate,
  saving,
  closureReady = true,
  closureBlockers = [],
  meterInstallationCompleted = false,
}) {
  const cardRef = useRef(null)
  const isNotApplicable = categoryDef.optional && !data
  const overall = isNotApplicable ? 'Not applicable' : getCategoryStatus(categoryDef, data)
  const isSettled = overall === 'Completed' || overall === 'Not applicable'
  const daysPending = !isSettled && updatedAt ? daysBetween(updatedAt) : null

  const initialDraft = useMemo(() => {
    const values = {}
    const dates = {}
    categoryDef.subStages.forEach((sub) => {
      values[sub.key] = data?.[sub.key] || sub.options[0]
      dates[sub.key] = data?.[dateKey(sub.key)] || ''
    })
    return {
      values,
      dates,
      notes: notes || '',
      rejectionReason: data?.rejectionReason || '',
      extra: {
        bankName: data?.bankName || '',
        loanAmount: data?.loanAmount ?? '',
        installment1Amount: data?.installment1Amount ?? data?.amountReceived ?? '',
        installment1Date: data?.installment1Date || data?.receivedDate || '',
        installment2Amount: data?.installment2Amount ?? '',
        installment2Date: data?.installment2Date || '',
      },
    }
  }, [categoryDef, data, notes])

  const [draft, setDraft] = useState(initialDraft)
  const [savedMsg, setSavedMsg] = useState(false)
  const [localError, setLocalError] = useState('')
  const today = todayForInput()

  useEffect(() => {
    setDraft(initialDraft)
    setLocalError('')
  }, [initialDraft])

  useEffect(() => {
    if (expanded && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [expanded])

  const showFinance =
    categoryDef.key === 'finance' &&
    draft.values.bankLoan &&
    draft.values.bankLoan !== 'Not applicable'
  const sequential = SEQUENTIAL_CATEGORY_KEYS.has(categoryDef.key)
  const installmentTotal =
    Number(draft.extra.installment1Amount || 0) + Number(draft.extra.installment2Amount || 0)
  const loanRemaining = Math.max(0, Number(draft.extra.loanAmount || 0) - installmentTotal)

  const draftExtra = {
    bankName: draft.extra.bankName || '',
    loanAmount: numOrNull(draft.extra.loanAmount),
    installment1Amount: numOrNull(draft.extra.installment1Amount),
    installment1Date: draft.extra.installment1Date || null,
    installment2Amount: numOrNull(draft.extra.installment2Amount),
    installment2Date: draft.extra.installment2Date || null,
  }
  const savedExtra = {
    bankName: data?.bankName || '',
    loanAmount: numOrNull(data?.loanAmount ?? ''),
    installment1Amount: numOrNull(data?.installment1Amount ?? data?.amountReceived ?? ''),
    installment1Date: data?.installment1Date || data?.receivedDate || null,
    installment2Amount: numOrNull(data?.installment2Amount ?? ''),
    installment2Date: data?.installment2Date || null,
  }

  const stageChanges = collectStageChanges(categoryDef, data, draft.values, draft.dates)
  const notesChanged = (draft.notes || '') !== (notes || '')
  const extraChanged =
    showFinance &&
    Object.keys(draftExtra).some((key) => draftExtra[key] !== savedExtra[key])
  const rejectionChanged =
    (draft.rejectionReason || '') !== (data?.rejectionReason || '')
  const hasChanges =
    stageChanges.length > 0 || notesChanged || extraChanged || rejectionChanged
  const closingWithBlockers =
    categoryDef.key === 'closure' && !closureReady && draft.values.projectClosed === 'Yes'

  async function handleSave() {
    setSavedMsg(false)
    setLocalError('')

    const needsReason = stageChanges.some(({ sub }) => draft.values[sub.key] === 'Rejected')
    if (needsReason && !String(draft.rejectionReason || '').trim()) {
      setLocalError('Rejection reason is required before saving.')
      return
    }

    // The API validates each step against the stored state, so changed steps go
    // one request at a time in pipeline order.
    const requests = stageChanges.map(({ sub }, position) => {
      const payload = {
        subStages: [
          {
            key: sub.key,
            value: draft.values[sub.key],
            date: draft.dates[sub.key] || null,
          },
        ],
      }
      if (String(draft.rejectionReason || '').trim()) {
        payload.rejectionReason = draft.rejectionReason
      }
      if (position === 0) {
        if (notesChanged) payload.notes = draft.notes
        if (extraChanged) payload.extra = draftExtra
      }
      return payload
    })

    if (!requests.length) {
      const payload = {}
      if (notesChanged) payload.notes = draft.notes
      if (extraChanged) payload.extra = draftExtra
      if (rejectionChanged) payload.rejectionReason = draft.rejectionReason
      if (!Object.keys(payload).length) return
      requests.push(payload)
    }

    try {
      for (const payload of requests) {
        await onSave(payload)
      }
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2000)
    } catch {
      /* parent surfaces the error */
    }
  }

  return (
    <div
      ref={cardRef}
      className={`overflow-hidden rounded-2xl border bg-white shadow-soft transition ${
        expanded ? 'border-orange-200 ring-1 ring-orange-100' : 'border-slate-200/80 hover:border-blue-200'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">{categoryDef.label}</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {categoryDef.optional ? 'Optional · ' : ''}
              {categoryDef.owner}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {daysPending !== null && daysPending > 0 && (
            <span
              className={`hidden text-xs font-semibold sm:inline ${
                daysPending > 14 ? 'text-orange-600' : 'text-ink-soft'
              }`}
              title="Days since this category's status last changed"
            >
              {daysPending}d pending
            </span>
          )}
          <StatusBadge status={overall} />
          <IconChevron
            className={`h-4 w-4 text-ink-soft transition ${expanded ? 'rotate-180 text-orange-500' : ''}`}
          />
        </div>
      </button>

      {expanded && isNotApplicable && (
        <div className="space-y-3 border-t border-slate-100 px-5 py-4">
          <p className="text-sm text-ink-muted">Not applicable for this customer.</p>
          {onEnable && (
            <button type="button" onClick={onEnable} className="ui-btn-primary">
              Enable {categoryDef.label}
            </button>
          )}
        </div>
      )}

      {expanded && !isNotApplicable && (
        <div className="space-y-3 border-t border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-4 py-4 sm:px-5">
          {categoryDef.optional && onDisable && (
            <div className="flex justify-end">
              <button type="button" onClick={onDisable} className="ui-btn-ghost text-xs">
                Mark not applicable
              </button>
            </div>
          )}

          {categoryDef.subStages.map((sub, index) => {
            const value = draft.values[sub.key]
            const complete = isStageDone(categoryDef.key, value)
            const savedDone = stageIsSavedDone(categoryDef, data, sub)
            const firstIncomplete = categoryDef.subStages.findIndex(
              (stage) => !isStageDone(categoryDef.key, draft.values[stage.key])
            )
            const isCurrent = !complete && index === firstIncomplete
            const statusEditable = sequential
              ? !savedDone && stagesDoneBefore(categoryDef, draft.values, index)
              : true
            const dateEditable = statusEditable || savedDone

            return (
            <div
              key={sub.key}
              className={`rounded-2xl border p-4 transition ${
                complete
                  ? 'border-green-200 bg-green-50/40'
                  : isCurrent
                    ? 'border-orange-300 bg-orange-50/60 shadow-soft'
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
                  <div className="text-sm font-bold text-ink">
                    {sub.label}
                    {sub.key === 'subsidy' && subsidyEstimate ? (
                      <span className="ml-1.5 text-xs font-normal text-ink-muted">
                        (est. &#8377;{subsidyEstimate.toLocaleString('en-IN')})
                      </span>
                    ) : null}
                  </div>
                  {sequential && !statusEditable && (
                    <div className="mt-1 text-[11px] font-medium text-ink-soft">
                      {savedDone
                        ? 'Completed · status locked; date can be corrected'
                        : 'Complete the step above first'}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="ui-label">Status</label>
                  <select
                    disabled={!statusEditable}
                    value={draft.values[sub.key]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        values: { ...d.values, [sub.key]: e.target.value },
                      }))
                    }
                  >
                    {sub.options.map((opt) => (
                      <option
                        key={opt}
                        value={opt}
                        disabled={
                          categoryDef.key === 'closure' &&
                          sub.key === 'projectClosed' &&
                          opt === 'Yes' &&
                          !closureReady
                        }
                      >
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
              {categoryDef.key === 'closure' && !closureReady && (
                <p className="mt-2 text-xs font-medium text-orange-700">
                  Closure requires every applicable section to be completed and 100% payment
                  collection. Pending: {closureBlockers.join(', ')}.
                </p>
              )}
              {draft.values[sub.key] === 'Rejected' && (
                <div className="mt-3">
                  <label className="ui-label">Rejection reason</label>
                  <textarea
                    rows={2}
                    value={draft.rejectionReason}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, rejectionReason: e.target.value }))
                    }
                    placeholder="Required before saving"
                  />
                </div>
              )}
              {categoryDef.key === 'finance' && showFinance && (
                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                  <div>
                    <label className="ui-label">Bank name</label>
                    <input
                      value={draft.extra.bankName}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, extra: { ...d.extra, bankName: e.target.value } }))
                      }
                      placeholder="Bank name"
                    />
                  </div>
                  <div>
                    <label className="ui-label">Loan amount (₹)</label>
                    <input
                      type="number"
                      value={draft.extra.loanAmount}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, extra: { ...d.extra, loanAmount: e.target.value } }))
                      }
                      placeholder="Loan amount"
                    />
                  </div>
                  <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                    <div className="mb-2 text-xs font-bold text-blue-800">
                      First installment — after loan approval
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="ui-label">Amount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.extra.installment1Amount}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              extra: { ...d.extra, installment1Amount: e.target.value },
                            }))
                          }
                          placeholder="First installment amount"
                        />
                      </div>
                      <div>
                        <label className="ui-label">Received date</label>
                        <input
                          type="date"
                          max={today}
                          value={draft.extra.installment1Date || ''}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              extra: { ...d.extra, installment1Date: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 rounded-xl border border-orange-100 bg-orange-50/50 p-3">
                    <div className="mb-1 text-xs font-bold text-orange-800">
                      Second installment — after meter installation
                    </div>
                    <p className="mb-2 text-[11px] text-orange-700">
                      {meterInstallationCompleted
                        ? 'Meter installation is completed. Record the second installment when received.'
                        : 'Meter installation is not completed yet.'}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="ui-label">Amount (₹)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.extra.installment2Amount}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              extra: { ...d.extra, installment2Amount: e.target.value },
                            }))
                          }
                          placeholder="Second installment amount"
                        />
                      </div>
                      <div>
                        <label className="ui-label">Received date</label>
                        <input
                          type="date"
                          max={today}
                          value={draft.extra.installment2Date || ''}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              extra: { ...d.extra, installment2Date: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 grid grid-cols-2 gap-3 rounded-xl bg-slate-100 px-3 py-2.5 text-xs">
                    <div>
                      <span className="text-ink-muted">Total loan received</span>
                      <div className="font-bold text-ink">₹{installmentTotal.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span className="text-ink-muted">Loan balance</span>
                      <div className="font-bold text-ink">₹{loanRemaining.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )
          })}

          <div>
            <label className="ui-label">Notes</label>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Saved with this category"
            />
          </div>

          {localError && <p className="text-sm font-medium text-red-600">{localError}</p>}

          <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              className="ui-btn-primary"
              disabled={saving || !hasChanges || closingWithBlockers}
              onClick={handleSave}
            >
              Save
            </button>
            {hasChanges && !saving && (
              <span className="text-xs font-medium text-ink-soft">
                {stageChanges.length
                  ? `${stageChanges.length} step${stageChanges.length === 1 ? '' : 's'} to update`
                  : 'Unsaved changes'}
              </span>
            )}
            {savedMsg && <span className="text-sm font-semibold text-green-600">Saved</span>}
          </div>
        </div>
      )}
    </div>
  )
}
