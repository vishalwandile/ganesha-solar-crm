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

export default function Dashboard() {
  const navigate = useNavigate()
  const { loadDashboard, dashboard, quickLookup, sessionUser } = useCrm()
  const [query, setQuery] = useState('')
  const [quickMatch, setQuickMatch] = useState(null)
  const [lookupMsg, setLookupMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await loadDashboard()
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
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
  const recent = dashboard.recent || []

  return (
    <Layout title="Dashboard" subtitle="Overview of solar applications and customer status">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          {loading
            ? 'Loading…'
            : `Welcome back — ${dashboard.total} active customers in the pipeline.`}
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
        <div className="ui-stat ui-stat-orange">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Total customers
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-ink">
            {dashboard.total}
          </div>
        </div>
        {OVERALL_STATUSES.map((status) => (
          <div key={status} className={`ui-stat ${STAT_STYLES[status] || 'ui-stat-slate'}`}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {status}
            </div>
            <div className="text-3xl font-extrabold tracking-tight text-ink">
              {counts[status] || 0}
            </div>
          </div>
        ))}
        <div className="ui-stat ui-stat-slate">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Inactive
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-ink">
            {dashboard.inactive || 0}
          </div>
        </div>
      </div>

      <div className="ui-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-sm font-bold text-ink">Recently updated</div>
            <div className="text-xs text-ink-muted">Latest activity across customers</div>
          </div>
          <Link to="/customers" className="text-xs font-bold text-blue-600 hover:text-blue-700">
            View all
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recent.map((item) => (
            <Link
              key={item.id}
              to={`/customers/${item.customer.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{item.customer.name}</div>
                <div className="truncate text-xs text-ink-muted">{item.action}</div>
              </div>
              <StatusBadge status={item.customer.overallStatus} />
            </Link>
          ))}
          {!loading && recent.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-ink-soft">No activity yet.</div>
          )}
        </div>
      </div>
    </Layout>
  )
}
