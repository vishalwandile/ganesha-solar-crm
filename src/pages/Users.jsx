import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { IconPlus, IconTeam } from '../components/Icons'
import { useCrm } from '../context/CrmContext'
import { TEAMS, CATEGORY_DEFS } from '../data/mockData'
import { FEATURES, defaultFeaturesForTeam } from '../data/features'

const TEAM_COLORS = {
  Admin: 'bg-orange-50 text-orange-700 ring-orange-200',
  Office: 'bg-blue-50 text-blue-700 ring-blue-200',
  Installation: 'bg-green-50 text-green-700 ring-green-200',
  Sales: 'bg-orange-50 text-orange-800 ring-orange-200',
  Account: 'bg-blue-50 text-blue-800 ring-blue-200',
  Loan: 'bg-green-50 text-green-800 ring-green-200',
}

function emptyForm() {
  return {
    name: '',
    username: '',
    mobile: '',
    password: '',
    team: TEAMS[0],
    permissionCategories: [],
    features: defaultFeaturesForTeam(TEAMS[0]),
  }
}

function FeatureChecks({ selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FEATURES.map((feature) => {
        const checked = selected.includes(feature.key)
        return (
          <label
            key={feature.key}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
              checked
                ? 'bg-blue-50 text-blue-700 ring-blue-200'
                : 'bg-slate-50 text-ink-muted ring-slate-200'
            }`}
          >
            <input
              type="checkbox"
              className="mr-1.5"
              checked={checked}
              onChange={() => onToggle(feature.key)}
            />
            {feature.label}
          </label>
        )
      })}
    </div>
  )
}

function CategoryChecks({ selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_DEFS.map((c) => {
        const checked = selected.some((p) => p.category === c.key)
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
              onChange={() => onToggle(c.key)}
            />
            {c.label}
          </label>
        )
      })}
    </div>
  )
}

function toggleList(list, key) {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key]
}

function togglePerms(perms, category) {
  const exists = perms.some((p) => p.category === category)
  if (exists) return perms.filter((p) => p.category !== category)
  return [...perms, { category, canEdit: true }]
}

export default function Users() {
  const { users, refreshUsers, addUser, updateUserAccess, deleteUser, sessionUser } = useCrm()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editMobile, setEditMobile] = useState('')
  const [editFeatures, setEditFeatures] = useState([])
  const [editPerms, setEditPerms] = useState([])

  useEffect(() => {
    refreshUsers().catch(() => {})
  }, [refreshUsers])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.name.trim().length < 2) {
      setError('Name must contain at least 2 characters.')
      return
    }
    if (!/^[A-Za-z0-9._-]{3,40}$/.test(form.username.trim())) {
      setError('Username must contain 3–40 letters, numbers, dots, underscores, or hyphens.')
      return
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      setError('Enter a valid 10-digit Indian mobile number.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must contain at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      await addUser(form)
      setForm(emptyForm())
      setOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to add user')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(user) {
    setEditingId(user.id)
    setEditMobile(user.mobile || '')
    setEditFeatures(user.isAdmin ? FEATURES.map((f) => f.key) : user.features || [])
    setEditPerms(user.permissions || [])
  }

  async function saveAccess(user) {
    setError('')
    if (editMobile && !/^[6-9]\d{9}$/.test(editMobile)) {
      setError('Enter a valid 10-digit Indian mobile number.')
      return
    }
    setBusy(true)
    try {
      await updateUserAccess(user.id, {
        features: user.isAdmin ? FEATURES.map((f) => f.key) : editFeatures,
        permissions: editPerms,
        mobile: editMobile,
      })
      setEditingId(null)
    } catch (err) {
      setError(err.message || 'Failed to update access')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layout title="Users & teams" subtitle="Assign screens and category edit rights">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          Features hide UI and APIs. Category permissions still control which pipeline stages a user can edit.
          Teams: <span className="font-semibold text-ink">{TEAMS.join(', ')}</span>.
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
              <label className="ui-label">Mobile number *</label>
              <input
                inputMode="numeric"
                maxLength={10}
                value={form.mobile}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))
                }
                placeholder="10-digit mobile number"
                required
              />
            </div>
            <div>
              <label className="ui-label">Team</label>
              <select
                value={form.team}
                onChange={(e) => {
                  const team = e.target.value
                  setForm((f) => ({
                    ...f,
                    team,
                    features: defaultFeaturesForTeam(team),
                  }))
                }}
              >
                {TEAMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="ui-label">Screens & features</div>
            <FeatureChecks
              selected={form.features}
              onToggle={(key) => setForm((f) => ({ ...f, features: toggleList(f.features, key) }))}
            />
          </div>
          <div>
            <div className="ui-label">Edit permissions</div>
            <CategoryChecks
              selected={form.permissionCategories}
              onToggle={(key) =>
                setForm((f) => ({
                  ...f,
                  permissionCategories: togglePerms(f.permissionCategories, key),
                }))
              }
            />
          </div>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          <button type="submit" className="ui-btn-primary" disabled={busy}>
            Save
          </button>
        </form>
      )}

      {error && !open && <p className="text-xs font-medium text-red-600">{error}</p>}

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
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="text-sm font-bold text-ink">{u.name}</div>
                    {u.isSystemAdmin && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">
                        System Admin
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted">@{u.username}</div>
                  {u.mobile && <div className="mt-0.5 text-xs text-ink-muted">{u.mobile}</div>}
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
                {(u.features || []).length
                  ? FEATURES.filter((f) => (u.isAdmin ? true : (u.features || []).includes(f.key)))
                      .map((f) => f.label)
                      .join(', ')
                  : 'No screens assigned'}
              </p>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Stages: {u.permissionsLabel || 'View only'}</p>
            {sessionUser?.isAdmin && editingId === u.id && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="ui-label">Mobile number</label>
                  <input
                    inputMode="numeric"
                    maxLength={10}
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div>
                  <div className="ui-label">Screens & features</div>
                  {u.isAdmin ? (
                    <p className="text-xs text-ink-muted">Admin always has every feature.</p>
                  ) : (
                    <FeatureChecks selected={editFeatures} onToggle={(key) => setEditFeatures((prev) => toggleList(prev, key))} />
                  )}
                </div>
                <div>
                  <div className="ui-label">Edit permissions</div>
                  <CategoryChecks selected={editPerms} onToggle={(key) => setEditPerms((prev) => togglePerms(prev, key))} />
                </div>
                <div className="flex gap-2">
                  <button type="button" className="ui-btn-primary" disabled={busy} onClick={() => saveAccess(u)}>
                    Save access
                  </button>
                  <button type="button" className="ui-btn-secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {sessionUser?.isAdmin && editingId !== u.id && (
              <button type="button" className="mt-3 mr-3 text-xs font-bold text-blue-700 hover:text-blue-800" onClick={() => startEdit(u)}>
                Edit access
              </button>
            )}
            {sessionUser?.isAdmin && !u.isSystemAdmin && u.id !== sessionUser.id && (
              <button
                type="button"
                className="mt-3 text-xs font-bold text-red-600 hover:text-red-700"
                onClick={async () => {
                  if (!window.confirm(`Delete ${u.name}'s access? Their audit history will be kept.`)) return
                  setError('')
                  try {
                    await deleteUser(u.id)
                  } catch (err) {
                    setError(err.message || 'Failed to delete user')
                  }
                }}
              >
                Delete user
              </button>
            )}
          </div>
        ))}
      </div>
    </Layout>
  )
}
