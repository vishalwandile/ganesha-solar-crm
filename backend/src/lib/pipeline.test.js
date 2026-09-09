import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isStageDone,
  loanReceivedFromExtra,
  resolveCategoryPipeline,
  stageChangeLock,
} from './pipeline.js'

const installation = {
  key: 'installation',
  subStages: [
    { key: 'material', dbKey: 'material', label: 'Material', options: ['No', 'Yes'] },
    { key: 'work', dbKey: 'work', label: 'Work', options: ['Pending', 'Completed'] },
    { key: 'meter', dbKey: 'meter', label: 'Meter', options: ['Pending', 'Completed'] },
  ],
}

test('resolves first incomplete and contiguous last completed stages', () => {
  const result = resolveCategoryPipeline(installation, {
    material: 'Yes',
    work: 'Pending',
    meter: 'Completed',
  })
  assert.equal(result.openStage.key, 'work')
  assert.equal(result.lastCompletedStage.key, 'material')
  assert.equal(result.outOfSequence, true)
})

test('locks future stage changes without erasing legacy values', () => {
  const values = { material: 'No', work: 'Pending', meter: 'Completed' }
  const result = stageChangeLock(installation, values, 'work', 'Completed', null)
  assert.equal(result.allowed, false)
  assert.equal(result.openStage.key, 'material')
  assert.equal(values.meter, 'Completed')
})

test('allows current stage progress and completed-stage date correction', () => {
  const values = {
    material: 'Yes',
    materialDate: '2026-09-01',
    work: 'Pending',
    meter: 'Pending',
  }
  assert.equal(
    stageChangeLock(installation, values, 'work', 'Completed', '2026-09-02').allowed,
    true
  )
  assert.equal(
    stageChangeLock(installation, values, 'material', 'Yes', '2026-09-03').allowed,
    true
  )
  assert.equal(
    stageChangeLock(installation, values, 'material', 'No', '2026-09-01').allowed,
    false
  )
})

test('one UI save advances two steps only when sent as ordered requests', () => {
  const batched = { material: 'No', work: 'Pending', meter: 'Pending' }
  // Both steps in a single request: the second is validated against stored state.
  assert.equal(stageChangeLock(installation, batched, 'material', 'Yes', null).allowed, true)
  assert.equal(stageChangeLock(installation, batched, 'work', 'Completed', null).allowed, false)

  // Sequential requests: each one is applied before the next is validated.
  const sequential = { material: 'No', work: 'Pending', meter: 'Pending' }
  assert.equal(stageChangeLock(installation, sequential, 'material', 'Yes', null).allowed, true)
  sequential.material = 'Yes'
  assert.equal(stageChangeLock(installation, sequential, 'work', 'Completed', null).allowed, true)
  sequential.work = 'Completed'
  assert.equal(stageChangeLock(installation, sequential, 'meter', 'Completed', null).allowed, true)
})

test('uses category-aware completion and installment-aware receipts', () => {
  assert.equal(isStageDone('finance', 'Approved'), false)
  assert.equal(isStageDone('nameChange', 'Approved'), true)
  assert.equal(
    loanReceivedFromExtra({
      installment1_amount: 100000,
      installment2_amount: 80000,
      amount_received: 999999,
    }),
    180000
  )
  assert.equal(loanReceivedFromExtra({ amount_received: 140000 }), 140000)
  assert.equal(
    loanReceivedFromExtra({ amount_received: 140000, installment1_amount: null }),
    140000
  )
})

const finance = {
  key: 'finance',
  subStages: [
    {
      key: 'bankLoan',
      dbKey: 'bank_loan',
      label: 'Bank Loan',
      options: ['Not applicable', 'Request submitted', 'Approved', 'Completed', 'Rejected'],
    },
  ],
}

test('bank loan must advance one status at a time except rejected', () => {
  const current = { bankLoan: 'Not applicable' }
  assert.equal(
    stageChangeLock(finance, current, 'bankLoan', 'Request submitted', null).allowed,
    true
  )
  assert.equal(stageChangeLock(finance, current, 'bankLoan', 'Rejected', null).allowed, true)
  assert.equal(stageChangeLock(finance, current, 'bankLoan', 'Approved', null).allowed, false)
  assert.equal(stageChangeLock(finance, current, 'bankLoan', 'Completed', null).allowed, false)
  assert.equal(
    stageChangeLock(finance, { bankLoan: 'Request submitted' }, 'bankLoan', 'Approved', null)
      .allowed,
    true
  )
  assert.equal(
    stageChangeLock(finance, { bankLoan: 'Request submitted' }, 'bankLoan', 'Completed', null)
      .allowed,
    false
  )
  assert.equal(
    stageChangeLock(finance, { bankLoan: 'Approved' }, 'bankLoan', 'Rejected', null).allowed,
    true
  )
  assert.equal(
    stageChangeLock(finance, { bankLoan: 'Completed' }, 'bankLoan', 'Approved', null).allowed,
    false
  )
})
