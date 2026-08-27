import { useCrm } from '../context/CrmContext'
import { IconMenu } from './Icons'

export default function Topbar({ title, subtitle, onMenu }) {
  const { sessionUser, logout } = useCrm()
  const initials = (sessionUser?.name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" className="ui-btn-ghost p-2 lg:hidden" onClick={onMenu} aria-label="Open menu">
            <IconMenu />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2 sm:pr-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-green-500 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-ink">{sessionUser?.name}</div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">
                {sessionUser?.team}
              </div>
            </div>
            <button type="button" onClick={logout} className="ui-btn-ghost hidden px-2 py-1 text-xs sm:inline-flex">
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
