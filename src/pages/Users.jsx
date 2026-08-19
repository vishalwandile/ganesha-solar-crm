import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { IconPlus, IconTeam } from '../components/Icons'
import { useCrm } from '../context/CrmContext'
import { TEAMS, CATEGORY_DEFS } from '../data/mockData'

const TEAM_COLORS = {
  Admin: 'bg-orange-50 text-orange-700 ring-orange-200',
  Office: 'bg-blue-50 text-blue-700 ring-blue-200',
  Installation: 'bg-green-50 text-green-700 ring-green-200',
  Sales: 'bg-orange-50 text-orange-800 ring-orange-200',
  Account: 'bg-blue-50 text-blue-800 ring-blue-200',
  Loan: 'bg-green-50 text-green-800 ring-green-200',
}

const EMPTY = {
  name: '',
  username: '',
  password: '',
  team: TEAMS[0],
  permissionCategories: [],
}

export default function Users() {
  const { users, refreshUsers, addUser, sessionUser } = useCrm()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    refreshUsers().catch(() => {})
  }, [refreshUsers])

  function togglePerm(category) {
    setForm((f) => {
      const exists = f.permissionCategories.some((p) => p.category === category)
      if (exists) {
        return {
          ...f,
          permissionCategories: f.permissionCategories.filter((p) => p.category !== category),
        }
      }
      return {
        ...f,
        permissionCategories: [...f.permissionCategories, { category, canEdit: true }],
      }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
      setError('Name, username, and password are required.')
      return
    }
    setBusy(true)
    try {
      await addUser(form)
      setForm(EMPTY)
      setOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to add user')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Users & teams" subtitle="Manage access and edit permissions">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          Admin assigns which categories each user can edit. Teams:{' '}
          <span className="font-semibold text-ink">{TEAMS.join(', ')}</span>.
        </p>
        {sessionUser?.isAdmin && (
          <button type="button" className="ui-btn-primary shrink-0" onClick={() => setOpen((v) => !v)}>
            <IconPlus className="h-4 w-4" />
            {open ? 'Close form' : 'Add user'}
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="ui-surface space-y-3 p-5">
          <div className="text-sm font-bold text-ink">New user</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="ui-label">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="ui-label">Username *</label>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. ravi.kulkarni"
              />
            </div>
            <div>
              <label className="ui-label">Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="ui-label">Team</label>
              <select value={form.team} onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}>
                {TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="ui-label">Edit permissions</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_DEFS.map((c) => {
                const checked = form.permissionCategories.some((p) => p.category === c.key)
                return (
                  <label
                    key={c.key}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
                      checked
                        ? 'bg-orange-50 text-orange-700 ring-orange-200'
                        : 'bg-slate-50 text-ink-muted ring-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-1.5"
                      checked={checked}
                      onChange={() => togglePerm(c.key)}
                    />
                    {c.label}
                  </label>
                )
              })}
            </div>
          </div>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <button type="submit" className="ui-btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save user'}
          </button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => (
          <div key={u.id} className="ui-surface p-5 transition hover:shadow-lift">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 text-sm font-bold text-white">
                  {u.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-bold text-ink">{u.name}</div>
                  <div className="text-xs text-ink-muted">@{u.username}</div>
                </div>
              </div>
              <span
                className={`rounded-lg px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${
                  TEAM_COLORS[u.team] || 'bg-slate-100 text-slate-700 ring-slate-200'
                }`}
              >
                {u.team}
              </span>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
              <IconTeam className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <p className="text-xs leading-relaxed text-ink-muted">
                {u.permissionsLabel || 'View only'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
