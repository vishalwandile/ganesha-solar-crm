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

export function currentOpenStageIndex(categoryDef, savedValues = {}) {
  return categoryDef.subStages.findIndex((stage) => {
    const value =
      savedValues?.[stage.key] ?? savedValues?.[stage.dbKey] ?? stage.options[0]
    return !isStageDone(categoryDef.key || categoryDef.dbKey, value)
  })
}
