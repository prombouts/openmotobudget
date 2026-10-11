import type {
  FuelRecord,
  PartRecord,
  Record,
  RecordDraft,
  RecordKind,
  RecordValidationResult,
  WorkRecord,
  WorkType,
} from './record'
import { DEFAULT_MOTORCYCLE_ID } from './record'

const recordKinds: readonly RecordKind[] = ['fuel', 'part', 'work']
const workTypes: readonly WorkType[] = ['maintenance', 'repair']

function trim(value: string | undefined): string | undefined {
  return value?.trim() || undefined
}

function today(now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isCalendarDate(value: string): boolean {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!matched) return false

  const [, year, month, day] = matched
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  )
}

function isPositive(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isNonNegativeInteger(value: number | undefined): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  )
}

export function validateRecord(
  draft: RecordDraft,
  now: Date = new Date(),
): RecordValidationResult {
  const errors: { [field: string]: string } = {}
  const id = trim(draft.id)
  const motorcycleId = trim(draft.motorcycleId) ?? DEFAULT_MOTORCYCLE_ID
  const occurredOn = trim(draft.occurredOn)
  const notes = trim(draft.notes)
  const currency = trim(draft.currency)
  const hasCost = draft.costAmount !== undefined
  const hasCurrency = currency !== undefined

  if (!id) errors.id = 'An id is required.'
  if (!draft.kind || !recordKinds.includes(draft.kind)) {
    errors.kind = 'A supported record kind is required.'
  }
  if (!occurredOn || !isCalendarDate(occurredOn)) {
    errors.occurredOn = 'A valid date is required.'
  } else if (occurredOn > today(now)) {
    errors.occurredOn = 'The date cannot be in the future.'
  }
  if (
    draft.odometerKm !== undefined &&
    !isNonNegativeInteger(draft.odometerKm)
  ) {
    errors.odometerKm = 'Odometer must be a non-negative whole number.'
  }
  if (hasCost && !isPositive(draft.costAmount)) {
    errors.costAmount = 'Cost must be a positive number.'
  }
  if (hasCost && !hasCurrency) {
    errors.currency = 'Cost and currency must be provided together.'
  }

  switch (draft.kind) {
    case 'fuel':
      if (!isPositive(draft.liters)) errors.liters = 'Liters must be a positive number.'
      if (
        draft.pricePerLiter !== undefined &&
        !isPositive(draft.pricePerLiter)
      ) {
        errors.pricePerLiter = 'Price per liter must be a positive number.'
      }
      break
    case 'part': {
      const partName = trim(draft.partName)
      if (!partName) errors.partName = 'Part name is required.'
      if (!isPositive(draft.quantity)) {
        errors.quantity = 'Quantity must be a positive number.'
      }
      break
    }
    case 'work': {
      const description = trim(draft.description)
      if (!description) errors.description = 'Description is required.'
      if (!draft.workType || !workTypes.includes(draft.workType)) {
        errors.workType = 'A supported work type is required.'
      }
      break
    }
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors }

  const base = {
    id: id!,
    motorcycleId,
    occurredOn: occurredOn!,
    ...(draft.odometerKm !== undefined ? { odometerKm: draft.odometerKm } : {}),
    ...(hasCost ? { costAmount: draft.costAmount! } : {}),
    ...(hasCost ? { currency: currency! } : {}),
    ...(notes ? { notes } : {}),
  }

  let value: Record
  switch (draft.kind!) {
    case 'fuel':
      value = {
        ...base,
        kind: 'fuel',
        liters: draft.liters!,
        ...(draft.pricePerLiter !== undefined
          ? { pricePerLiter: draft.pricePerLiter }
          : {}),
      } satisfies FuelRecord
      break
    case 'part':
      value = {
        ...base,
        kind: 'part',
        partName: trim(draft.partName)!,
        quantity: draft.quantity!,
      } satisfies PartRecord
      break
    case 'work':
      value = {
        ...base,
        kind: 'work',
        workType: draft.workType!,
        description: trim(draft.description)!,
      } satisfies WorkRecord
      break
  }

  return { valid: true, value }
}
