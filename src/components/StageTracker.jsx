import { CATEGORY_DEFS, getCategoryStatus } from '../data/mockData'

const NODE_COLOR = {
  Completed: 'bg-green-500 border-green-500 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.15)]',
  'In progress': 'bg-blue-500 border-blue-500 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.15)]',
  Rejected: 'bg-red-500 border-red-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.15)]',
  Pending: 'bg-white border-orange-300 text-orange-500',
  'Not applicable': 'bg-slate-100 border-slate-200 text-slate-400',
}

const LINE_COLOR = {
  Completed: 'bg-gradient-to-r from-green-400 to-green-500',
  'In progress': 'bg-gradient-to-r from-blue-400 to-blue-500',
  Rejected: 'bg-gradient-to-r from-red-400 to-red-500',
  Pending: 'bg-slate-200',
  'Not applicable': 'bg-slate-200',
}

export default function StageTracker({
  customer,
  onSelect,
  activeKey,
  categoryDefs = CATEGORY_DEFS,
}) {
  return (
    <div className="ui-surface overflow-x-auto p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold text-ink">Process pipeline</div>
        <div className="hidden text-[11px] font-medium text-ink-muted sm:block">Click a stage to jump</div>
      </div>
      <div className="flex min-w-[680px] items-center">
        {categoryDefs.map((cat, i) => {
          const isNotApplicable = cat.optional && !customer.categories?.[cat.key]
          const status = isNotApplicable
            ? 'Not applicable'
            : getCategoryStatus(cat, customer.categories?.[cat.key])
          const isLast = i === categoryDefs.length - 1
          const isActive = activeKey === cat.key

          return (
            <div key={cat.key} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => onSelect(cat.key)}
                className="flex flex-col items-center gap-2 focus:outline-none"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition ${
                    NODE_COLOR[status]
                  } ${isActive ? 'scale-110 ring-2 ring-orange-400 ring-offset-2' : 'hover:scale-105'}`}
                >
                  {i + 1}
                </div>
                <span
                  className={`max-w-[88px] text-center text-[11px] leading-tight ${
                    isActive ? 'font-bold text-orange-700' : 'font-medium text-ink-muted'
                  }`}
                >
                  {cat.label}
                </span>
              </button>
              {!isLast && <div className={`mx-2 h-1 flex-1 rounded-full ${LINE_COLOR[status]}`} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
