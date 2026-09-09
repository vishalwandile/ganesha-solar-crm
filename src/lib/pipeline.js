export const SEQUENTIAL_CATEGORY_KEYS = new Set(['installation', 'pmSuryaghar'])
export const BANK_LOAN_SEQUENCE = [
  'Not applicable',
  'Request submitted',
  'Approved',
  'Completed',
]

export function normalizeBankLoanValue(value) {
  if (value === 'Not Applicable') return 'Not applicable'
  if (value === 'Request Submitted') return 'Request submitted'
  return value
}

export function allowedBankLoanValues(currentValue) {
  const current = normalizeBankLoanValue(currentValue)
  const allowed = new Set(['Rejected'])
  if (current) allowed.add(current)
  if (current === 'Rejected') {
    allowed.add('Not applicable')
    allowed.add('Request submitted')
    return [...allowed]
  }
  const index = BANK_LOAN_SEQUENCE.indexOf(current)
  if (index === -1) {
    allowed.add('Not applicable')
    allowed.add('Request submitted')
    return [...allowed]
  }
  if (index + 1 < BANK_LOAN_SEQUENCE.length) {
    allowed.add(BANK_LOAN_SEQUENCE[index + 1])
  }
  return [...allowed]
}

export function isStageDone(categoryKey, value) {
  const category = categoryKey === 'pm_suryaghar' ? 'pmSuryaghar' : categoryKey
  if (['Completed', 'Yes', 'Claimed', 'Disbursed'].includes(value)) return true
  if (value === 'Approved') return category !== 'finance'
  if (value === 'Not applicable' || value === 'Not Applicable') return true
  return false
}

/**
 * Every step before `index` is done in the given values. Driven by the draft so
 * marking a step complete unlocks the next one before anything is saved.
 */
export function stagesDoneBefore(categoryDef, values = {}, index) {
  const categoryKey = categoryDef.key || categoryDef.dbKey
  return categoryDef.subStages
    .slice(0, index)
    .every((stage) => isStageDone(categoryKey, values?.[stage.key] ?? stage.options[0]))
}

export function stageIsSavedDone(categoryDef, saved, stage) {
  return isStageDone(categoryDef.key || categoryDef.dbKey, saved?.[stage.key] ?? stage.options[0])
}

/**
 * Steps whose status or date differ from what is stored, in pipeline order, so
 * a single Save can send just those steps instead of the whole category.
 */
export function collectStageChanges(categoryDef, saved, values = {}, dates = {}) {
  return categoryDef.subStages
    .map((sub, index) => ({ sub, index }))
    .filter(({ sub }) => {
      const savedValue = saved?.[sub.key] ?? sub.options[0]
      const savedDate = saved?.[`${sub.key}Date`] || ''
      return (
        (values[sub.key] ?? sub.options[0]) !== savedValue ||
        (dates[sub.key] || '') !== savedDate
      )
    })
}
