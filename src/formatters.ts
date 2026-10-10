const DUTCH_LOCALE = 'nl-NL'

export function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(DUTCH_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(DUTCH_LOCALE, {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(DUTCH_LOCALE).format(value)
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(DUTCH_LOCALE, {
      style: 'currency',
      currency,
    }).format(amount)
  } catch {
    return `${currency} ${formatNumber(amount)}`
  }
}
