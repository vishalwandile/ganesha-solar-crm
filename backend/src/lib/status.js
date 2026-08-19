/**
 * Port of frontend getCategoryStatus() — returns FE-facing status labels.
 */
export function getCategoryStatus(subStageDefs, valuesByKey) {
  if (!valuesByKey) return 'Not applicable'

  const values = subStageDefs.map((s) => valuesByKey[s.key] ?? valuesByKey[s.sub_stage_key])
  if (values.some((v) => v === 'Rejected')) return 'Rejected'

  const isDone = (v) =>
    ['Completed', 'Yes', 'Disbursed', 'Approved', 'Claimed', 'Not applicable', 'Not Applicable'].includes(v)

  const isStarted = (v) =>
    isDone(v) || ['Request submitted', 'Request Submitted', 'In progress', 'In Progress'].includes(v)

  if (values.every((v) => v === 'Not applicable' || v === 'Not Applicable')) return 'Not applicable'
  if (values.every(isDone)) return 'Completed'
  if (values.some(isStarted)) return 'In progress'
  return 'Pending'
}

export function calculateExpectedSubsidy(capacityKW) {
  if (!capacityKW || capacityKW <= 0) return 0
  if (capacityKW <= 2) return Math.round(30000 * capacityKW)
  if (capacityKW < 3) return Math.round(60000 + (capacityKW - 2) * 18000)
  return 78000
}

export function parseCapacityKW(capacity) {
  if (typeof capacity === 'number') return capacity
  const match = /([\d.]+)/.exec(String(capacity || ''))
  return match ? parseFloat(match[1]) : 0
}
