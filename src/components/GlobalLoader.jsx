import { useEffect, useState } from 'react'
import { subscribeToApiLoading } from '../api/client'

export default function GlobalLoader() {
  const [visible, setVisible] = useState(false)

  useEffect(() => subscribeToApiLoading(setVisible), [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/10 backdrop-blur-[3px]"
      role="status"
      aria-label="Loading"
      aria-live="polite"
    >
      <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-white/80 bg-white/90 shadow-lift">
        <span className="absolute inset-3 animate-spin rounded-full border-[3px] border-slate-100 border-t-orange-500 border-r-blue-500" />
        <span className="h-6 w-6 animate-pulse rounded-full bg-gradient-to-br from-orange-400 via-blue-500 to-green-500 shadow-soft" />
      </div>
    </div>
  )
}
