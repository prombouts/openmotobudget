import { describe, expect, it } from 'vitest'
import type { Record } from './record'
import { expenseChartState, expenseCurrencies, monthlyExpenses } from './monthlyExpenses'

const records: Record[] = [
  { id: 'fuel-jan', motorcycleId: 'default-motorcycle', kind: 'fuel', occurredOn: '2026-01-04', odometerKm: 100, liters: 10, costAmount: 20, currency: 'EUR' },
  { id: 'part-jan', motorcycleId: 'default-motorcycle', kind: 'part', occurredOn: '2026-01-20', odometerKm: 200, partName: 'filter', quantity: 1, costAmount: 15, currency: 'EUR' },
  { id: 'maintenance-feb', motorcycleId: 'default-motorcycle', kind: 'work', workType: 'maintenance', occurredOn: '2026-02-04', odometerKm: 300, description: 'service', costAmount: 80, currency: 'EUR' },
  { id: 'repair-feb', motorcycleId: 'default-motorcycle', kind: 'work', workType: 'repair', occurredOn: '2026-02-12', odometerKm: 400, description: 'tyre repair', costAmount: 30, currency: 'EUR' },
  { id: 'fuel-usd', motorcycleId: 'default-motorcycle', kind: 'fuel', occurredOn: '2026-02-13', odometerKm: 450, liters: 8, costAmount: 25, currency: 'USD' },
  { id: 'no-cost', motorcycleId: 'default-motorcycle', kind: 'part', occurredOn: '2026-03-01', odometerKm: 500, partName: 'clip', quantity: 1, currency: 'GBP' },
]

describe('monthlyExpenses', () => {
  it('groups priced records by calendar month and record kind with a monthly total', () => {
    expect(monthlyExpenses(records, 'EUR')).toEqual([
      { month: '2026-01', fuel: 20, part: 15, work: 0, unpriced: { fuel: 0, part: 0, work: 0 }, total: 35 },
      { month: '2026-02', fuel: 0, part: 0, work: 110, unpriced: { fuel: 0, part: 0, work: 0 }, total: 110 },
    ])
  })

  it('keeps currency totals separate while retaining per-category unpriced counts', () => {
    expect(expenseCurrencies(records)).toEqual(['EUR', 'GBP', 'USD'])
    expect(monthlyExpenses(records, 'USD')).toEqual([
      { month: '2026-02', fuel: 25, part: 0, work: 0, unpriced: { fuel: 0, part: 0, work: 0 }, total: 25 },
    ])
    expect(monthlyExpenses(records, 'GBP')).toEqual([
      { month: '2026-03', fuel: 0, part: 0, work: 0, unpriced: { fuel: 0, part: 1, work: 0 }, total: 0 },
    ])
  })

  it('counts unpriced records by record kind without adding them to the total', () => {
    const unpricedRecords: Record[] = [
      { id: 'fuel', motorcycleId: 'default-motorcycle', kind: 'fuel', occurredOn: '2026-04-01', odometerKm: 600, liters: 9, currency: 'EUR' },
      { id: 'part', motorcycleId: 'default-motorcycle', kind: 'part', occurredOn: '2026-04-02', odometerKm: 610, partName: 'bolt', quantity: 1, currency: 'EUR' },
      { id: 'work', motorcycleId: 'default-motorcycle', kind: 'work', workType: 'repair', occurredOn: '2026-04-03', odometerKm: 620, description: 'adjustment', currency: 'EUR' },
    ]

    expect(monthlyExpenses(unpricedRecords, 'EUR')).toEqual([
      { month: '2026-04', fuel: 0, part: 0, work: 0, unpriced: { fuel: 1, part: 1, work: 1 }, total: 0 },
    ])
  })

  it('aggregates records without an odometer', () => {
    const record: Record = {
      id: 'part-without-odometer',
      motorcycleId: 'default-motorcycle',
      kind: 'part',
      occurredOn: '2026-05-01',
      partName: 'bolt',
      quantity: 1,
      costAmount: 4,
      currency: 'EUR',
    }

    expect(monthlyExpenses([record], 'EUR')).toEqual([
      { month: '2026-05', fuel: 0, part: 4, work: 0, unpriced: { fuel: 0, part: 0, work: 0 }, total: 4 },
    ])
  })

  it('identifies a selected currency with no priced records, including unpriced-only currencies', () => {
    expect(expenseChartState(records, 'GBP')).toBe('no-priced-records-for-currency')
    expect(expenseChartState(records, 'CAD')).toBe('no-priced-records-for-currency')
    expect(expenseChartState(records, 'EUR')).toBe('ready')
  })
})
