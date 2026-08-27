import { NavLink } from 'react-router-dom'
import { IconClose, IconDashboard, IconTeam, IconUsers } from './Icons'
import { useCrm } from '../context/CrmContext'
import { hasFeature } from '../data/features'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconDashboard, end: true, feature: 'dashboard' },
  { to: '/customers', label: 'Customers', icon: IconUsers, feature: 'customers' },
  { to: '/users', label: 'Users & teams', icon: IconTeam, feature: 'users' },
]

export default function Sidebar({ open, onClose }) {
  const { sessionUser } = useCrm()
  const items = NAV_ITEMS.filter((item) => hasFeature(sessionUser, item.feature))

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200/80 bg-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:self-start lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-slate-200">
              <img
                src="/ganesha-solar-logo.png"
                alt="Ganesha Solar logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-ink">Ganesha Solar</div>
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Services CRM
              </div>
            </div>
          </div>
          <button type="button" className="ui-btn-ghost p-2 lg:hidden" onClick={onClose} aria-label="Close menu">
            <IconClose />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-50 to-blue-50 text-orange-700 shadow-soft ring-1 ring-orange-100'
                      : 'text-ink-muted hover:bg-slate-50 hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                        isActive
                          ? 'bg-orange-500 text-white shadow-soft'
                          : 'bg-slate-100 text-ink-muted group-hover:bg-blue-50 group-hover:text-blue-600'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="m-4 rounded-2xl bg-gradient-to-br from-green-50 via-white to-blue-50 p-4 ring-1 ring-green-100">
          <div className="text-xs font-bold uppercase tracking-wide text-green-700">Solar ops</div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Track applications, installation, finance &amp; subsidy in one place.
          </p>
        </div>
      </aside>
    </>
  )
}
