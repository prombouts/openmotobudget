import type { Record } from './record'

export const expenseCategories = ['fuel', 'part', 'work'] as const
export type ExpenseCategory = (typeof expenseCategories)[number]
export type UnpricedExpenseCounts = { [category in ExpenseCategory]: number }

export interface MonthlyExpense {
  month: string
  fuel: number
  part: number
  work: number
  unpriced: UnpricedExpenseCounts
  total: number
}

export type ExpenseChartState =
  | 'no-records'
  | 'no-priced-records'
  | 'no-priced-records-for-currency'
  | 'ready'

export function expenseCurrencies(records: readonly Record[]): string[] {
  return [...new Set(
    records.flatMap((record) => record.currency ? [record.currency] : []),
  )].sort()
}

export function expenseChartState(
  records: readonly Record[],
  currency: string | undefined,
): ExpenseChartState {
  if (records.length === 0) return 'no-records'

  const pricedRecords = records.filter(
    (record) => record.costAmount !== undefined && record.currency,
  )
  if (pricedRecords.length === 0) return 'no-priced-records'

  return pricedRecords.some((record) => record.currency === currency)
    ? 'ready'
    : 'no-priced-records-for-currency'
}

export function monthlyExpenses(
  records: readonly Record[],
  currency: string,
): MonthlyExpense[] {
  const months = new Map<string, Omit<MonthlyExpense, 'month' | 'total'>>()

  for (const record of records) {
    if (record.currency !== currency) continue

    const month = record.occurredOn.slice(0, 7)
    const values = months.get(month) ?? {
      fuel: 0,
      part: 0,
      work: 0,
      unpriced: { fuel: 0, part: 0, work: 0 },
    }
    if (record.costAmount === undefined) {
      values.unpriced[record.kind] += 1
    } else {
      values[record.kind] += record.costAmount
    }
    months.set(month, values)
  }

  return [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => ({
      month,
      ...values,
      total: expenseCategories.reduce((total, category) => total + values[category], 0),
    }))
}
