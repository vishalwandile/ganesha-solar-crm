const COLOR_MAP = {
  New: 'bg-slate-100 text-slate-700 ring-slate-200',
  Pending: 'bg-orange-50 text-orange-700 ring-orange-200',
  'Not applicable': 'bg-slate-50 text-slate-500 ring-slate-200',
  'In progress': 'bg-blue-50 text-blue-700 ring-blue-200',
  'Request submitted': 'bg-blue-50 text-blue-700 ring-blue-200',
  Completed: 'bg-green-50 text-green-700 ring-green-200',
  Inactive: 'bg-slate-200 text-slate-700 ring-slate-300',
  Rejected: 'bg-red-50 text-red-700 ring-red-200',
  Approved: 'bg-green-50 text-green-700 ring-green-200',
  Yes: 'bg-green-50 text-green-700 ring-green-200',
  No: 'bg-slate-100 text-slate-600 ring-slate-200',
  Claimed: 'bg-blue-50 text-blue-700 ring-blue-200',
  Disbursed: 'bg-green-50 text-green-700 ring-green-200',
}

export default function StatusBadge({ status }) {
  const cls = COLOR_MAP[status] || 'bg-slate-100 text-slate-600 ring-slate-200'
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  )
}
