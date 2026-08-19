import { useEffect } from 'react'
import Layout from '../components/Layout'
import { IconBell } from '../components/Icons'
import { useCrm } from '../context/CrmContext'

export default function Notifications() {
  const {
    notifications,
    refreshNotifications,
    markAllNotificationsRead,
    markNotificationRead,
  } = useCrm()
  const unread = notifications.filter((n) => !n.read).length

  useEffect(() => {
    refreshNotifications().catch(() => {})
  }, [refreshNotifications])

  return (
    <Layout title="Notifications" subtitle="Stage changes and important updates">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <IconBell className="h-4 w-4" />
          </span>
          <span>
            <span className="font-bold text-ink">{unread}</span> unread
          </span>
        </div>
        <button type="button" onClick={() => markAllNotificationsRead()} className="ui-btn-secondary">
          Mark all as read
        </button>
      </div>

      <div className="ui-surface overflow-hidden">
        <div className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markNotificationRead(n.id)}
              className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50 ${
                n.read ? 'bg-white' : 'bg-gradient-to-r from-orange-50/70 to-transparent'
              }`}
            >
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  n.read ? 'bg-slate-200' : 'bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.15)]'
                }`}
              />
              <div>
                <div className={`text-sm ${n.read ? 'text-ink-muted' : 'font-semibold text-ink'}`}>
                  {n.text}
                </div>
                <div className="mt-0.5 text-xs text-ink-soft">
                  {String(n.at || '').replace('T', ' ').slice(0, 16)}
                </div>
              </div>
            </button>
          ))}
          {notifications.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-ink-soft">No notifications yet.</div>
          )}
        </div>
      </div>
    </Layout>
  )
}
