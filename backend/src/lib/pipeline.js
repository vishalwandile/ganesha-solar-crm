export const STAGE_QUEUE_KEYS = ['installation', 'pmSuryaghar']
export const PIPELINE_QUEUE_KEYS = [...STAGE_QUEUE_KEYS, 'closure', 'payments']
export const SEQUENTIAL_CATEGORY_KEYS = new Set(STAGE_QUEUE_KEYS)

function normalizedCategoryKey(key) {
  return key === 'pm_suryaghar' ? 'pmSuryaghar' : key
}

export function isStageDone(categoryKey, value) {
  const category = normalizedCategoryKey(categoryKey)
  if (['Completed', 'Yes', 'Claimed', 'Disbursed'].includes(value)) return true
  if (value === 'Approved') return category !== 'finance'
  if (value === 'Not applicable' || value === 'Not Applicable') return true
  return false
}

export function resolveCategoryPipeline(categoryDef, values = {}) {
  const categoryKey = normalizedCategoryKey(categoryDef.key || categoryDef.dbKey)
  const stages = categoryDef.subStages.map((stage, index) => {
    const value = values[stage.key] ?? values[stage.dbKey] ?? stage.options[0]
    return {
      key: stage.key,
      dbKey: stage.dbKey,
      label: stage.label,
      index,
      value,
      date: values[`${stage.key}Date`] || null,
      done: isStageDone(categoryKey, value),
    }
  })
  const openIndex = stages.findIndex((stage) => !stage.done)
  const openStage = openIndex === -1 ? null : stages[openIndex]
  const lastCompletedStage =
    openIndex === 0
      ? null
      : stages[openIndex === -1 ? stages.length - 1 : openIndex - 1] || null
  const outOfSequence =
    openIndex !== -1 && stages.slice(openIndex + 1).some((stage) => stage.done)

  return {
    stages,
    openIndex,
    openStage,
    lastCompletedStage,
    complete: openIndex === -1,
    outOfSequence,
  }
}

export function stageChangeLock(categoryDef, values, stageKey, nextValue, nextDate) {
  const categoryKey = normalizedCategoryKey(categoryDef.key || categoryDef.dbKey)

  // Only Installation and PM Suryaghar are sequential. Finance (and the rest)
  // can move to any status at any time.
  if (!SEQUENTIAL_CATEGORY_KEYS.has(categoryKey)) return { allowed: true }

  const pipeline = resolveCategoryPipeline(categoryDef, values)
  const attemptedIndex = pipeline.stages.findIndex(
    (stage) => stage.key === stageKey || stage.dbKey === stageKey
  )
  if (attemptedIndex === -1) return { allowed: false, reason: 'unknown' }

  const attempted = pipeline.stages[attemptedIndex]
  const valueChanged = nextValue !== attempted.value
  const dateChanged = (nextDate || null) !== (attempted.date || null)
  if (!valueChanged && !dateChanged) return { allowed: true }
  if (attemptedIndex === pipeline.openIndex) return { allowed: true }

  // Correcting only the date on a completed step is safe; its status/order is unchanged.
  if (attempted.done && !valueChanged) return { allowed: true }

  return {
    allowed: false,
    reason: pipeline.complete ? 'complete' : 'locked',
    openStage: pipeline.openStage,
    attemptedStage: attempted,
  }
}

export function loanReceivedFromExtra(extra) {
  if (!extra || typeof extra !== 'object') return 0
  const hasInstallments =
    Object.prototype.hasOwnProperty.call(extra, 'installment1_amount') ||
    Object.prototype.hasOwnProperty.call(extra, 'installment2_amount')
  if (hasInstallments) {
    const installmentTotal =
      Number(extra.installment1_amount || 0) + Number(extra.installment2_amount || 0)
    // Some legacy rows acquired empty installment keys before their old receipt was migrated.
    // Prefer real installment values, but do not discard the only recorded receipt.
    return installmentTotal || Number(extra.amount_received || 0)
  }
  return Number(extra.amount_received || 0)
}
