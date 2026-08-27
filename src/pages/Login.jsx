import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCrm } from '../context/CrmContext'

export default function Login() {
  const { login } = useCrm()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username || !password) {
      setError('Enter a username and password.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-mesh px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-blue-300/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-green-300/20 blur-3xl" />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md animate-fade-up overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-8 shadow-lift backdrop-blur-xl"
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-orange-500 via-blue-500 to-green-500" />

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-24 w-28 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-slate-200">
            <img
              src="/ganesha-solar-logo.png"
              alt="Ganesha Solar logo"
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Ganesha Solar</h1>
          <p className="mt-1 text-sm font-medium text-ink-muted">Sign in to Services CRM</p>
        </div>

        <div className="mb-4">
          <label className="ui-label">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            autoComplete="username"
          />
        </div>
        <div className="mb-5">
          <label className="ui-label">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-100">
            {error}
          </p>
        )}

        <button type="submit" className="ui-btn-primary w-full py-3" disabled={busy}>
          Sign in
        </button>

        <p className="mt-4 text-center text-[11px] text-ink-soft">
          © {new Date().getFullYear()} Ganesha Solar Services. All rights reserved.
        </p>
      </form>
    </div>
  )
}
