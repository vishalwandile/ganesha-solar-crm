import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import { IconClose, IconPlus, IconSearch, IconView } from '../components/Icons'
import { useCrm } from '../context/CrmContext'
import { hasFeature } from '../data/features'
import { crmApi } from '../api/crmApi'

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(date)
    .replaceAll('/', '-')
}

const STATUS_FILTERS = [
  { value: '', label: 'Any status' },
  { value: 'all', label: 'Total customers' },
  { value: 'New', label: 'New' },
  { value: 'In progress', label: 'In progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Inactive', label: 'Inactive' },
]

const QUEUE_FILTERS = [
  { value: '', label: 'Any queue' },
  { value: 'installation', label: 'Installation pending' },
  { value: 'pmSuryaghar', label: 'PM Suryaghar pending' },
  { value: 'closure', label: 'Closure pending' },
  { value: 'payments', label: 'Payments pending', feature: 'payments' },
]

const EMPTY_FILTERS = { search: '', status: '', queue: '', subStage: '' }

// Sliding window: two pages either side of the current one, so a 100-page list
// still shows five buttons and the numbers move along as you page.
const PAGE_WINDOW = 5

function pageItems(current, total) {
  const span = Math.min(PAGE_WINDOW, total)
  const start = Math.min(
    Math.max(1, current - Math.floor(span / 2)),
    Math.max(1, total - span + 1)
  )
  return Array.from({ length: span }, (_, index) => start + index)
}

export default function CustomerList() {
  const { customers, customerPagination, refreshCustomers, sessionUser } = useCrm()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [categoryDefs, setCategoryDefs] = useState([])

  const canFilterPipeline = hasFeature(sessionUser, 'pipelineFilters')
  const canSeePayments = hasFeature(sessionUser, 'payments')
  const queueOptions = QUEUE_FILTERS.filter(
    (option) => !option.feature || hasFeature(sessionUser, option.feature)
  )

  // Applied filters live in the URL so dashboard links and shared links work.
  const appliedSearch = searchParams.get('search') || ''
  const requestedQueue = canFilterPipeline ? searchParams.get('queue') || '' : ''
  const permittedQueues = canSeePayments
    ? ['installation', 'pmSuryaghar', 'closure', 'payments']
    : ['installation', 'pmSuryaghar', 'closure']
  const appliedQueue = permittedQueues.includes(requestedQueue) ? requestedQueue : ''
  const appliedSubStage =
    appliedQueue && !['payments', 'closure'].includes(appliedQueue)
      ? searchParams.get('subStage') || ''
      : ''
  const requestedStatus = searchParams.get('status') || ''
  const appliedStatus = STATUS_FILTERS.some((item) => item.value === requestedStatus)
    ? requestedStatus
    : ''

  const [draft, setDraft] = useState({
    search: appliedSearch,
    status: appliedStatus,
    queue: appliedQueue,
    subStage: appliedSubStage,
  })

  useEffect(() => {
    setDraft({
      search: appliedSearch,
      status: appliedStatus,
      queue: appliedQueue,
      subStage: appliedSubStage,
    })
  }, [appliedSearch, appliedStatus, appliedQueue, appliedSubStage])

  useEffect(() => {
    if (!canFilterPipeline) return
    crmApi
      .categoryDefinitions()
      .then((data) => setCategoryDefs(data.categories || []))
      .catch(() => setCategoryDefs([]))
  }, [canFilterPipeline])

  // Only applied filters and paging trigger a request.
  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        await refreshCustomers(appliedSearch.trim(), page, 10, {
          queue: appliedQueue,
          subStage: appliedSubStage,
          status: appliedStatus,
        })
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [appliedSearch, appliedQueue, appliedSubStage, appliedStatus, page, refreshCustomers])

  const draftCategory = ['payments', 'closure'].includes(draft.queue)
    ? null
    : categoryDefs.find((category) => category.key === draft.queue)
  const appliedCategory = categoryDefs.find((category) => category.key === appliedQueue)

  const dirty =
    draft.search.trim() !== appliedSearch.trim() ||
    draft.status !== appliedStatus ||
    draft.queue !== appliedQueue ||
    draft.subStage !== appliedSubStage
  const hasApplied = Boolean(appliedSearch || appliedStatus || appliedQueue || appliedSubStage)
  const totalPages = Math.max(1, Number(customerPagination.totalPages) || 1)

  function pushFilters(next) {
    const params = new URLSearchParams()
    if (next.search?.trim()) params.set('search', next.search.trim())
    if (next.status) params.set('status', next.status)
    if (next.queue) params.set('queue', next.queue)
    if (next.queue && !['payments', 'closure'].includes(next.queue) && next.subStage) {
      params.set('subStage', next.subStage)
    }
    setSearchParams(params)
    setPage(1)
  }

  function handleSearch(event) {
    event?.preventDefault()
    pushFilters(draft)
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS)
    pushFilters(EMPTY_FILTERS)
  }

  function removeApplied(key) {
    const next = {
      search: appliedSearch,
      status: appliedStatus,
      queue: appliedQueue,
      subStage: appliedSubStage,
      [key]: '',
    }
    if (key === 'queue') next.subStage = ''
    pushFilters(next)
  }

  const activeChips = []
  if (appliedSearch) activeChips.push({ key: 'search', label: `“${appliedSearch}”` })
  if (appliedStatus) {
    activeChips.push({
      key: 'status',
      label: STATUS_FILTERS.find((item) => item.value === appliedStatus)?.label || appliedStatus,
    })
  }
  if (appliedQueue) {
    activeChips.push({
      key: 'queue',
      label: QUEUE_FILTERS.find((item) => item.value === appliedQueue)?.label || appliedQueue,
    })
  }
  if (appliedSubStage) {
    activeChips.push({
      key: 'subStage',
      label:
        appliedCategory?.subStages.find((stage) => stage.key === appliedSubStage)?.label ||
        appliedSubStage,
    })
  }

  return (
    <Layout title="Customers" subtitle="Search and manage solar consumers">
      <form className="ui-surface p-4 sm:p-5" onSubmit={handleSearch}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconSearch className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-bold text-ink">Search &amp; filters</div>
              <div className="text-xs text-ink-muted">
                Choose your filters, then press Search
              </div>
            </div>
          </div>
          {hasFeature(sessionUser, 'createCustomer') && (
            <Link to="/customers/new" className="ui-btn-primary shrink-0">
              <IconPlus className="h-4 w-4" />
              Add customer
            </Link>
          )}
        </div>

        <div
          className={`grid gap-3 sm:grid-cols-2 ${
            canFilterPipeline
              ? 'lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]'
              : 'lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]'
          }`}
        >
          <div>
            <label htmlFor="customer-search" className="ui-label">
              Name, consumer number, or mobile
            </label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-600" />
              <input
                id="customer-search"
                type="text"
                value={draft.search}
                onChange={(event) => setDraft((d) => ({ ...d, search: event.target.value }))}
                placeholder="Start typing, then press Search"
                className="h-11 !pl-11 !pr-10"
              />
              {draft.search && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, search: '' }))}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-soft transition hover:bg-slate-100 hover:text-ink"
                  aria-label="Clear search text"
                >
                  <IconClose className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="ui-label">Status</label>
            <select
              className="h-11"
              value={draft.status}
              onChange={(event) => setDraft((d) => ({ ...d, status: event.target.value }))}
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.value || 'any-status'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {canFilterPipeline && (
            <>
              <div>
                <label className="ui-label">Pending queue</label>
                <select
                  className="h-11"
                  value={draft.queue}
                  onChange={(event) =>
                    setDraft((d) => ({ ...d, queue: event.target.value, subStage: '' }))
                  }
                >
                  {queueOptions.map((item) => (
                    <option key={item.value || 'any-queue'} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label">Pending step</label>
                <select
                  className="h-11"
                  value={draft.subStage}
                  disabled={!draftCategory}
                  onChange={(event) => setDraft((d) => ({ ...d, subStage: event.target.value }))}
                >
                  <option value="">All steps</option>
                  {(draftCategory?.subStages || []).map((stage) => (
                    <option key={stage.key} value={stage.key}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button type="submit" className="ui-btn-primary" disabled={loading}>
            <IconSearch className="h-4 w-4" />
            Search
          </button>
          <button
            type="button"
            className="ui-btn-secondary"
            disabled={!hasApplied && !dirty}
            onClick={clearFilters}
          >
            Reset
          </button>
          {dirty && (
            <span className="text-xs font-semibold text-orange-700">
              Filters changed — press Search to apply
            </span>
          )}
          <span className="ml-auto text-xs font-medium text-ink-muted">
            {customerPagination.total} customer{customerPagination.total === 1 ? '' : 's'} found
          </span>
        </div>

        {activeChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
              Applied
            </span>
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-100"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={() => removeApplied(chip.key)}
                  className="grid h-4 w-4 place-items-center rounded transition hover:bg-orange-200/70"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  <IconClose className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </form>

      <div className="ui-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${appliedQueue ? 'min-w-[1180px]' : 'min-w-[860px]'}`}>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">Name</th>
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Consumer no.
                </th>
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">Mobile</th>
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Created date
                </th>
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Capacity
                </th>
                {appliedQueue && !['payments', 'closure'].includes(appliedQueue) && (
                  <>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      Current step
                    </th>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      Last completed
                    </th>
                  </>
                )}
                {appliedQueue === 'payments' && (
                  <>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      Due
                    </th>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      Received
                    </th>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      Pending
                    </th>
                  </>
                )}
                {appliedQueue === 'closure' && (
                  <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                    Pending reason
                  </th>
                )}
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-ink-muted">
                  View
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="transition hover:bg-orange-50/40">
                  <td className="px-5 py-3.5">
                    <Link to={`/customers/${c.id}`} className="font-semibold text-ink hover:text-orange-600">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-ink-muted">{c.consumerNumber}</td>
                  <td className="px-5 py-3.5 text-ink-muted">{c.mobile}</td>
                  <td className="px-5 py-3.5 tabular-nums text-ink-muted">{formatDate(c.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-bold text-green-700 ring-1 ring-green-100">
                      {c.solarCapacity || '—'}
                    </span>
                  </td>
                  {appliedQueue && !['payments', 'closure'].includes(appliedQueue) && (
                    <>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-orange-700">
                          {c.pipeline?.openSubStage?.label || '—'}
                        </div>
                        {c.pipeline?.outOfSequence && (
                          <div
                            className="mt-0.5 text-[10px] font-semibold text-red-600"
                            title="A later step is already completed; existing data was preserved."
                          >
                            Out of sequence
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">
                        {c.pipeline?.lastCompletedSubStage?.label || 'Not started'}
                      </td>
                    </>
                  )}
                  {appliedQueue === 'payments' && (
                    <>
                      <td className="px-5 py-3.5 font-semibold text-ink">
                        ₹{Number(c.pipeline?.totalDue || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-green-700">
                        ₹{Number(c.pipeline?.totalReceived || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5 font-extrabold text-orange-700">
                        ₹{Number(c.pipeline?.pendingAmount || 0).toLocaleString('en-IN')}
                      </td>
                    </>
                  )}
                  {appliedQueue === 'closure' && (
                    <td className="px-5 py-3.5">
                      {(c.pipeline?.pendingReasons || []).length ? (
                        <ul className="space-y-1 text-xs font-medium text-orange-700">
                          {c.pipeline.pendingReasons.map((reason) => (
                            <li key={reason}>• {reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs font-semibold text-green-700">
                          Ready for closure
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge status={c.overallStatus} />
                      {!c.isActive && <StatusBadge status="Inactive" />}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      to={`/customers/${c.id}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-600 hover:text-white"
                      aria-label={`View ${c.name}`}
                      title="View customer"
                    >
                      <IconView className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && customers.length === 0 && (
                <tr>
                  <td
                    colSpan={
                      appliedQueue === 'payments'
                        ? 10
                        : appliedQueue === 'closure'
                          ? 8
                          : appliedQueue
                            ? 9
                            : 7
                    }
                    className="px-5 py-10 text-center text-sm text-ink-soft"
                  >
                    No customers match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-ink-muted">
            {customerPagination.total} customer{customerPagination.total === 1 ? '' : 's'} · page{' '}
            {page} of {totalPages}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-xs"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            {pageItems(page, totalPages).map((item) => (
              <button
                key={item}
                type="button"
                aria-current={item === page ? 'page' : undefined}
                disabled={loading}
                onClick={() => setPage(item)}
                className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold tabular-nums transition disabled:opacity-50 ${
                  item === page
                    ? 'bg-orange-500 text-white shadow-soft'
                    : 'border border-slate-200 bg-white text-ink hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-xs"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
