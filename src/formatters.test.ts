import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, formatMonth, formatNumber } from './formatters'

describe('Dutch display formatters', () => {
  it('formats calendar-only dates and months in Dutch without changing their source values', () => {
    expect(formatDate('2026-01-04')).toBe('4 jan 2026')
    expect(formatMonth('2026-01')).toBe('jan 2026')
  })

  it('uses Dutch decimal and grouping punctuation for numbers and currency', () => {
    expect(formatNumber(24500)).toBe('24.500')
    expect(formatNumber(14.2)).toBe('14,2')
    expect(formatCurrency(48.5, 'EUR')).toBe('€ 48,50')
  })

  it('rounds floating-point artifacts to the locale display precision', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0,3')
    expect(formatCurrency(0.1 + 0.2, 'EUR')).toBe('€ 0,30')
  })
})
