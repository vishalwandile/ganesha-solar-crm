import { useEffect, useRef, useState } from 'react'
import StatusBadge from './StatusBadge'
import { IconChevron } from './Icons'
import { getCategoryStatus, daysBetween } from '../data/mockData'

export default function CategoryCard({
  categoryDef,
  data,
  updatedAt,
  notes,
  onChange,
  onNotesChange,
  onEnable,
  onDisable,
  expanded,
  onToggle,
  subsidyEstimate,
  financeFields,
  onFinanceChange,
}) {
  const [draftNote, setDraftNote] = useState(notes || '')
  const [rejectionReason, setRejectionReason] = useState(data?.rejectionReason || '')
  const cardRef = useRef(null)
  const isNotApplicable = categoryDef.optional && !data
  const overall = isNotApplicable ? 'Not applicable' : getCategoryStatus(categoryDef, data)
  const isSettled = overall === 'Completed' || overall === 'Not applicable'
  const daysPending = !isSettled && updatedAt ? daysBetween(updatedAt) : null
  const showRejection =
    data &&
    (Object.values(data).includes('Rejected') || data.rejectionReason)

  useEffect(() => {
    setDraftNote(notes || '')
  }, [notes])

  useEffect(() => {
    setRejectionReason(data?.rejectionReason || '')
  }, [data?.rejectionReason])

  useEffect(() => {
    if (expanded && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [expanded])

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

          {categoryDef.subStages.map((sub) => (
            <div
              key={sub.key}
              className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm font-medium text-ink">
                {sub.label}
                {sub.key === 'subsidy' && subsidyEstimate ? (
                  <span className="ml-1.5 text-xs font-normal text-ink-muted">
                    (est. &#8377;{subsidyEstimate.toLocaleString('en-IN')})
                  </span>
                ) : null}
              </span>
              <select
                className="w-full sm:w-44"
                value={data?.[sub.key] || sub.options[0]}
                onChange={(e) => onChange(sub.key, e.target.value)}
              >
                {sub.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {categoryDef.key === 'finance' &&
            data?.bankLoan &&
            data.bankLoan !== 'Not applicable' &&
            onFinanceChange && (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3 sm:grid-cols-2">
                <div>
                  <label className="ui-label">Bank name</label>
                  <input
                    value={financeFields?.bankName || data.bankName || ''}
                    onChange={(e) => onFinanceChange({ bankName: e.target.value })}
                    placeholder="Bank name"
                  />
                </div>
                <div>
                  <label className="ui-label">Loan amount (₹)</label>
                  <input
                    type="number"
                    value={financeFields?.loanAmount ?? data.loanAmount ?? ''}
                    onChange={(e) =>
                      onFinanceChange({
                        loanAmount: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="Loan amount"
                  />
                </div>
                <div>
                  <label className="ui-label">Amount received (₹)</label>
                  <input
                    type="number"
                    value={financeFields?.amountReceived ?? data.amountReceived ?? ''}
                    onChange={(e) =>
                      onFinanceChange({
                        amountReceived: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    placeholder="Amount received"
                  />
                </div>
                <div>
                  <label className="ui-label">Received date</label>
                  <input
                    type="date"
                    value={financeFields?.receivedDate || data.receivedDate || ''}
                    onChange={(e) => onFinanceChange({ receivedDate: e.target.value || null })}
                  />
                </div>
              </div>
            )}

          {showRejection && (
            <div>
              <label className="ui-label">Rejection reason</label>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                onBlur={() => onChange('rejectionReason', rejectionReason)}
                placeholder="Required when status is Rejected"
              />
            </div>
          )}

          <div>
            <label className="ui-label">Notes</label>
            <textarea
              rows={2}
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              onBlur={() => onNotesChange(draftNote)}
              placeholder="e.g. waiting on DISCOM inspection slot, follow up Friday"
            />
          </div>
        </div>
      )}
    </div>
  )
}
