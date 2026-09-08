import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import { IconPlus, IconSearch } from '../components/Icons'
import { useCrm } from '../context/CrmContext'
import { hasFeature } from '../data/features'
import { OVERALL_STATUSES, CATEGORY_DEFS, getCategoryStatus } from '../data/mockData'

function currentStageLabel(customer) {
  if (!customer?.categories) return 'Open profile for stages'
  const stuck = CATEGORY_DEFS.find((cat) => {
    const isNotApplicable = cat.optional && !customer.categories[cat.key]
    if (isNotApplicable) return false
    const status = getCategoryStatus(cat, customer.categories[cat.key])
    return status !== 'Completed' && status !== 'Not applicable'
  })
  return stuck ? stuck.label : 'All categories completed'
}

const STAT_STYLES = {
  New: 'ui-stat-slate',
  'In progress': 'ui-stat-blue',
  Completed: 'ui-stat-green',
}

function queueUrl(queue, subStage) {
  const params = new URLSearchParams({ queue })
  if (subStage) params.set('subStage', subStage)
  return `/customers?${params}`
}

function statusUrl(status) {
  return `/customers?status=${encodeURIComponent(status)}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { loadDashboard, dashboard, quickLookup, sessionUser } = useCrm()
  const [query, setQuery] = useState('')
  const [quickMatch, setQuickMatch] = useState(null)
  const [lookupMsg, setLookupMsg] = useState('')

  useEffect(() => {
    loadDashboard().catch(() => {})
  }, [loadDashboard])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setQuickMatch(null)
      setLookupMsg('')
      return
    }
    const t = setTimeout(async () => {
      try {
        const match = await quickLookup(q)
        setQuickMatch(match)
        setLookupMsg(match ? '' : 'No customer found for that number.')
      } catch {
        setLookupMsg('Lookup failed.')
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, quickLookup])

  const counts = dashboard.counts || {}

  return (
    <Layout title="Dashboard" subtitle="Overview of solar applications and customer status">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          {`Welcome back — ${dashboard.total} active customers in the pipeline.`}
        </p>
        {hasFeature(sessionUser, 'createCustomer') && (
          <Link to="/customers/new" className="ui-btn-primary">
            <IconPlus className="h-4 w-4" />
            Add customer
          </Link>
        )}
      </div>

      <div className="ui-surface p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <IconSearch className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-bold text-ink">Quick status check</div>
            <div className="text-xs text-ink-muted">Look up by consumer number</div>
          </div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. CN-104822"
          className="max-w-lg"
        />
        {quickMatch && (
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-left transition hover:bg-blue-50"
            onClick={() => navigate(`/customers/${quickMatch.id}`)}
          >
            <div>
              <div className="text-sm font-bold text-ink">{quickMatch.name}</div>
              <div className="text-xs text-ink-muted">Currently at: {currentStageLabel(quickMatch)}</div>
            </div>
            <StatusBadge status={quickMatch.overallStatus} />
          </button>
        )}
        {lookupMsg && <div className="mt-3 text-sm text-ink-soft">{lookupMsg}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Link to={statusUrl('all')} className="ui-stat ui-stat-orange transition hover:ring-2 hover:ring-orange-200">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Total customers
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-ink">
            {dashboard.total}
          </div>
        </Link>
        {OVERALL_STATUSES.map((status) => (
          <Link
            key={status}
            to={statusUrl(status)}
            className={`ui-stat ${STAT_STYLES[status] || 'ui-stat-slate'} transition hover:ring-2 hover:ring-orange-200`}
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {status}
            </div>
            <div className="text-3xl font-extrabold tracking-tight text-ink">
              {counts[status] || 0}
            </div>
          </Link>
        ))}
        <Link to={statusUrl('Inactive')} className="ui-stat ui-stat-slate transition hover:ring-2 hover:ring-orange-200">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Inactive
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-ink">
            {dashboard.inactive || 0}
          </div>
        </Link>
      </div>

      {hasFeature(sessionUser, 'pipelineFilters') && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-ink">Pending work queues</h2>
            <p className="text-sm text-ink-muted">
              Active customers only. Each customer appears at their first incomplete step.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {(dashboard.pipeline || []).map((queue) => (
              <div key={queue.key} className="ui-surface overflow-hidden">
                <Link
                  to={queueUrl(queue.key)}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 transition hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-extrabold text-ink">{queue.label}</div>
                    {queue.type === 'payments' && (
                      <div className="mt-0.5 text-xs font-semibold text-orange-700">
                        ₹{Number(queue.pendingAmount || 0).toLocaleString('en-IN')} pending
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl bg-orange-50 px-3 py-1.5 text-xl font-extrabold text-orange-700 ring-1 ring-orange-100">
                    {queue.pendingCount || 0}
                  </div>
                </Link>
                {queue.type === 'stage' && (
                  <div className="flex flex-wrap gap-2 p-4">
                    {(queue.subStages || []).map((stage) => (
                      <Link
                        key={stage.key}
                        to={queueUrl(queue.key, stage.key)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                          stage.count
                            ? 'bg-blue-50 text-blue-700 ring-blue-100 hover:bg-blue-100'
                            : 'bg-slate-50 text-ink-soft ring-slate-100'
                        }`}
                      >
                        {stage.label} <span className="ml-1 font-extrabold">{stage.count}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {queue.type === 'payments' && (
                  <div className="px-5 py-4 text-xs text-ink-muted">
                    Customers whose amount due is greater than payments and loan installments received.
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

    </Layout>
  )
}
