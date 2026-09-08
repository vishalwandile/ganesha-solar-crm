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
  { value: '', label: 'All customers' },
  { value: 'all', label: 'Total customers' },
  { value: 'New', label: 'New' },
  { value: 'In progress', label: 'In progress' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Inactive', label: 'Inactive' },
]

export default function CustomerList() {
  const { customers, customerPagination, refreshCustomers, sessionUser } = useCrm()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [categoryDefs, setCategoryDefs] = useState([])
  const canFilterPipeline = hasFeature(sessionUser, 'pipelineFilters')
  const requestedQueue = canFilterPipeline ? searchParams.get('queue') || '' : ''
  const permittedQueues = hasFeature(sessionUser, 'payments')
    ? ['installation', 'pmSuryaghar', 'payments']
    : ['installation', 'pmSuryaghar']
  const queue = permittedQueues.includes(requestedQueue)
    ? requestedQueue
    : ''
  const subStage = queue && queue !== 'payments' ? searchParams.get('subStage') || '' : ''
  const requestedStatus = searchParams.get('status') || ''
  const status = STATUS_FILTERS.some((item) => item.value === requestedStatus)
    ? requestedStatus
    : ''
  const selectedCategory = categoryDefs.find((category) => category.key === queue)

  useEffect(() => {
    if (!canFilterPipeline) return
    crmApi
      .categoryDefinitions()
      .then((data) => setCategoryDefs(data.categories || []))
      .catch(() => setCategoryDefs([]))
  }, [canFilterPipeline])

  useEffect(() => {
    let alive = true
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        await refreshCustomers(query.trim(), page, 10, { queue, subStage, status })
      } finally {
        if (alive) setLoading(false)
      }
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, page, queue, subStage, status, refreshCustomers])

  function setListFilters({ nextQueue = queue, nextSubStage = subStage, nextStatus = status } = {}) {
    const next = new URLSearchParams()
    if (nextQueue) next.set('queue', nextQueue)
    if (nextQueue && nextQueue !== 'payments' && nextSubStage) next.set('subStage', nextSubStage)
    if (nextStatus) next.set('status', nextStatus)
    setSearchParams(next)
    setPage(1)
  }

  function setPipelineFilter(nextQueue, nextSubStage = '') {
    setListFilters({ nextQueue, nextSubStage, nextStatus: status })
  }

  return (
    <Layout title="Customers" subtitle="Search and manage solar consumers">
      <div className="ui-surface flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-xl">
          <label htmlFor="customer-search" className="ui-label">
            Find a customer
          </label>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-600" />
            <input
              id="customer-search"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Name, consumer number, or mobile"
              className="h-12 pl-12 pr-11"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setPage(1)
                }}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-soft transition hover:bg-slate-100 hover:text-ink"
                aria-label="Clear search"
              >
                <IconClose className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            {query.trim()
              ? `${customerPagination.total} matching customer${customerPagination.total === 1 ? '' : 's'}`
              : `${customerPagination.total} total customer${customerPagination.total === 1 ? '' : 's'}`}
          </p>
        </div>
        {hasFeature(sessionUser, 'createCustomer') && (
          <Link to="/customers/new" className="ui-btn-primary shrink-0">
            <IconPlus className="h-4 w-4" />
            Add customer
          </Link>
        )}
      </div>

      <div className="ui-surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <div>
            <label className="ui-label">Status</label>
            <select
              value={status}
              onChange={(event) =>
                setListFilters({ nextQueue: queue, nextSubStage: subStage, nextStatus: event.target.value })
              }
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.value || 'all-customers'} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {canFilterPipeline && (
          <>
          <div>
            <label className="ui-label">Pending queue</label>
            <select value={queue} onChange={(event) => setPipelineFilter(event.target.value)}>
              <option value="">All customers</option>
              <option value="installation">Installation pending</option>
              <option value="pmSuryaghar">PM Suryaghar pending</option>
              {hasFeature(sessionUser, 'payments') && (
                <option value="payments">Payments pending</option>
              )}
            </select>
          </div>
          <div>
            <label className="ui-label">Current pending step</label>
            <select
              value={subStage}
              disabled={!selectedCategory}
              onChange={(event) => setPipelineFilter(queue, event.target.value)}
            >
              <option value="">All pending steps</option>
              {(selectedCategory?.subStages || []).map((stage) => (
                <option key={stage.key} value={stage.key}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>
          </>
          )}
          <button
            type="button"
            className="ui-btn-secondary"
            disabled={!queue && !status}
            onClick={() => setListFilters({ nextQueue: '', nextSubStage: '', nextStatus: '' })}
          >
            Clear filters
          </button>
        </div>

      <div className="ui-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${queue ? 'min-w-[1180px]' : 'min-w-[860px]'}`}>
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
                {queue && queue !== 'payments' && (
                  <>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      Current step
                    </th>
                    <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                      Last completed
                    </th>
                  </>
                )}
                {queue === 'payments' && (
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
                  {queue && queue !== 'payments' && (
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
                  {queue === 'payments' && (
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
                    colSpan={queue === 'payments' ? 10 : queue ? 9 : 7}
                    className="px-5 py-10 text-center text-sm text-ink-soft"
                  >
                    No customers match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-ink-muted">
            {customerPagination.total} customer{customerPagination.total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-xs"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span className="text-xs font-semibold text-ink">
              Page {customerPagination.page} of {customerPagination.totalPages}
            </span>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-xs"
              disabled={loading || page >= customerPagination.totalPages}
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
