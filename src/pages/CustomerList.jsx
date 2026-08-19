import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import StatusBadge from '../components/StatusBadge'
import { IconPlus, IconSearch } from '../components/Icons'
import { useCrm } from '../context/CrmContext'

export default function CustomerList() {
  const { customers, refreshCustomers } = useCrm()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await refreshCustomers()
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [refreshCustomers])

  useEffect(() => {
    const t = setTimeout(() => {
      refreshCustomers(query.trim())
    }, 250)
    return () => clearTimeout(t)
  }, [query, refreshCustomers])

  return (
    <Layout title="Customers" subtitle="Search and manage solar consumers">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, consumer number, or mobile"
            className="pl-10"
          />
        </div>
        <Link to="/customers/new" className="ui-btn-primary shrink-0">
          <IconPlus className="h-4 w-4" />
          Add customer
        </Link>
      </div>

      <div className="ui-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">Name</th>
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Consumer no.
                </th>
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">Mobile</th>
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Capacity
                </th>
                <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-ink-muted">Status</th>
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
                  <td className="px-5 py-3.5">
                    <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-bold text-green-700 ring-1 ring-green-100">
                      {c.solarCapacity || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.overallStatus} />
                  </td>
                </tr>
              ))}
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink-soft">
                    No customers match your search.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink-soft">
                    Loading customers…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
