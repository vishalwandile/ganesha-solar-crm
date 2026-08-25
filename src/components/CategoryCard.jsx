import { useEffect, useMemo, useRef, useState } from 'react'
import StatusBadge from './StatusBadge'
import { IconChevron } from './Icons'
import { getCategoryStatus, daysBetween } from '../data/mockData'

function dateKey(subKey) {
  return `${subKey}Date`
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
        amountReceived: data?.amountReceived ?? '',
        receivedDate: data?.receivedDate || '',
      },
    }
  }, [categoryDef, data, notes])

  const [draft, setDraft] = useState(initialDraft)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  useEffect(() => {
    if (expanded && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [expanded])

  const showFinance = categoryDef.key === 'finance' && draft.values.bankLoan && draft.values.bankLoan !== 'Not applicable'

  async function handleStageSave(sub) {
    setSavedMsg('')
    const value = draft.values[sub.key]
    if (value === 'Rejected' && !String(draft.rejectionReason || '').trim()) {
      return
    }
    const payload = {
      subStages: [{
        key: sub.key,
        value,
        date: draft.dates[sub.key] || null,
      }],
      rejectionReason: draft.rejectionReason || null,
      notes: draft.notes,
    }
    if (showFinance) {
      payload.extra = {
        bankName: draft.extra.bankName,
        loanAmount: draft.extra.loanAmount === '' ? null : Number(draft.extra.loanAmount),
        amountReceived: draft.extra.amountReceived === '' ? null : Number(draft.extra.amountReceived),
        receivedDate: draft.extra.receivedDate || null,
      }
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

          <div>
            <label className="ui-label">Notes</label>
            <textarea
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Saved together with the stage you update"
            />
          </div>

          {categoryDef.subStages.map((sub) => (
            <div key={sub.key} className="rounded-xl border border-slate-100 bg-white p-3">
              <span className="mb-2 block text-sm font-medium text-ink">
                {sub.label}
                {sub.key === 'subsidy' && subsidyEstimate ? (
                  <span className="ml-1.5 text-xs font-normal text-ink-muted">
                    (est. &#8377;{subsidyEstimate.toLocaleString('en-IN')})
                  </span>
                ) : null}
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="ui-label">Status</label>
                  <select
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
              {categoryDef.key === 'closure' && !closureReady && (
                <p className="mt-2 text-xs font-medium text-orange-700">
                  Complete {closureBlockers.join(', ')} before marking this project closed.
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
                  <div>
                    <label className="ui-label">Amount received (₹)</label>
                    <input
                      type="number"
                      value={draft.extra.amountReceived}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          extra: { ...d.extra, amountReceived: e.target.value },
                        }))
                      }
                      placeholder="Amount received"
                    />
                  </div>
                  <div>
                    <label className="ui-label">Received date</label>
                    <input
                      type="date"
                      value={draft.extra.receivedDate || ''}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          extra: { ...d.extra, receivedDate: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className="ui-btn-primary"
                  disabled={
                    saving ||
                    (draft.values[sub.key] === 'Rejected' &&
                      !String(draft.rejectionReason || '').trim()) ||
                    (categoryDef.key === 'closure' && !closureReady)
                  }
                  onClick={() => handleStageSave(sub)}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {savedMsg === sub.key && (
                  <span className="text-sm font-semibold text-green-600">Saved</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
