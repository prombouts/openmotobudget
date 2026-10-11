import { describe, expect, it } from 'vitest'
import {
  createInitialRecordDraft,
  DEFAULT_CURRENCY,
  DEFAULT_MOTORCYCLE_ID,
  type Record,
  type RecordDraft,
} from './record'
import { validateRecord } from './validateRecord'

const now = new Date(2026, 8, 29)
const validFuel: RecordDraft = {
  id: ' fuel-1 ',
  kind: 'fuel',
  occurredOn: '2026-09-29',
  odometerKm: 0,
  liters: 12.5,
  costAmount: 24.75,
  currency: ' EUR ',
  notes: ' full tank ',
}

describe('validateRecord', () => {
  it('starts drafts with the local calendar date and configurable EUR currency default', () => {
    expect(createInitialRecordDraft(new Date(2026, 8, 29))).toEqual({
      occurredOn: '2026-09-29',
      currency: DEFAULT_CURRENCY,
      motorcycleId: DEFAULT_MOTORCYCLE_ID,
    })
    expect(DEFAULT_CURRENCY).toBe('EUR')
  })

  it('normalizes and validates a fuel record', () => {
    const result = validateRecord(validFuel, now)

    expect(result).toEqual({
      valid: true,
      value: {
        id: 'fuel-1',
        motorcycleId: DEFAULT_MOTORCYCLE_ID,
        kind: 'fuel',
        occurredOn: '2026-09-29',
        odometerKm: 0,
        liters: 12.5,
        costAmount: 24.75,
        currency: 'EUR',
        notes: 'full tank',
      },
    })
  })

  it.each<[string, RecordDraft, unknown]>([
    [
      'part',
      {
        id: ' part-1 ',
        kind: 'part',
        occurredOn: '2024-02-29',
        odometerKm: 500,
        partName: ' oil filter ',
        quantity: 2,
        notes: ' installed ',
      },
      {
        id: 'part-1',
        kind: 'part',
        occurredOn: '2024-02-29',
        odometerKm: 500,
        partName: 'oil filter',
        quantity: 2,
        notes: 'installed',
      },
    ],
    [
      'maintenance work',
      {
        id: 'work-1',
        kind: 'work',
        occurredOn: '2026-01-01',
        odometerKm: 501,
        workType: 'maintenance',
        description: ' chain service ',
      },
      {
        id: 'work-1',
        kind: 'work',
        occurredOn: '2026-01-01',
        odometerKm: 501,
        workType: 'maintenance',
        description: 'chain service',
      },
    ],
    [
      'repair work',
      {
        id: 'work-2',
        kind: 'work',
        occurredOn: '2026-01-02',
        odometerKm: 502,
        workType: 'repair',
        description: ' replace mirror ',
      },
      {
        id: 'work-2',
        kind: 'work',
        occurredOn: '2026-01-02',
        odometerKm: 502,
        workType: 'repair',
        description: 'replace mirror',
      },
    ],
  ])('validates and normalizes %s records', (_name, draft, value) => {
    expect(validateRecord(draft, now)).toEqual({
      valid: true,
      value: { ...(value as Record), motorcycleId: DEFAULT_MOTORCYCLE_ID },
    })
  })

  it.each<[string, RecordDraft, string, string]>([
    ['missing id', { ...validFuel, id: ' ' }, 'id', 'An id is required.'],
    ['missing kind', { ...validFuel, kind: undefined }, 'kind', 'A supported record kind is required.'],
    ['invalid calendar date', { ...validFuel, occurredOn: '2026-02-29' }, 'occurredOn', 'A valid date is required.'],
    ['future date', { ...validFuel, occurredOn: '2026-09-30' }, 'occurredOn', 'The date cannot be in the future.'],
    ['negative odometer', { ...validFuel, odometerKm: -1 }, 'odometerKm', 'Odometer must be a non-negative whole number.'],
    ['fractional odometer', { ...validFuel, odometerKm: 1.5 }, 'odometerKm', 'Odometer must be a non-negative whole number.'],
    ['non-finite odometer', { ...validFuel, odometerKm: Number.NaN }, 'odometerKm', 'Odometer must be a non-negative whole number.'],
    ['zero liters', { ...validFuel, liters: 0 }, 'liters', 'Liters must be a positive number.'],
    ['infinite price per liter', { ...validFuel, pricePerLiter: Infinity }, 'pricePerLiter', 'Price per liter must be a positive number.'],
    ['zero cost', { ...validFuel, costAmount: 0 }, 'costAmount', 'Cost must be a positive number.'],
    ['non-finite cost', { ...validFuel, costAmount: Infinity }, 'costAmount', 'Cost must be a positive number.'],
    ['cost without currency', { ...validFuel, currency: ' ' }, 'currency', 'Cost and currency must be provided together.'],
  ])('rejects %s', (_name, draft, field, message) => {
    expect(validateRecord(draft, now)).toMatchObject({
      valid: false,
      errors: { [field]: message },
    })
  })

  it.each<[string, RecordDraft, string, string]>([
    ['fuel', { ...validFuel, liters: undefined }, 'liters', 'Liters must be a positive number.'],
    ['part', { ...validFuel, kind: 'part', partName: ' ', quantity: 0 }, 'partName', 'Part name is required.'],
    ['part quantity', { ...validFuel, kind: 'part', partName: 'chain', quantity: -1 }, 'quantity', 'Quantity must be a positive number.'],
    ['work type', { ...validFuel, kind: 'work', description: 'service', workType: undefined }, 'workType', 'A supported work type is required.'],
    ['work description', { ...validFuel, kind: 'work', workType: 'repair', description: ' ' }, 'description', 'Description is required.'],
  ])('enforces required %s fields', (_name, draft, field, message) => {
    expect(validateRecord(draft, now)).toMatchObject({
      valid: false,
      errors: { [field]: message },
    })
  })

  it('omits empty optional fields', () => {
    expect(
      validateRecord(
        {
          ...validFuel,
          costAmount: undefined,
          currency: undefined,
          notes: ' ',
          pricePerLiter: undefined,
          odometerKm: undefined,
        },
        now,
      ),
    ).toEqual({
      valid: true,
      value: {
        id: 'fuel-1',
        motorcycleId: DEFAULT_MOTORCYCLE_ID,
        kind: 'fuel',
        occurredOn: '2026-09-29',
        liters: 12.5,
      },
    })

  })

  it.each<[string, RecordDraft]>([
    ['fuel', validFuel],
    [
      'part',
      {
        id: 'part-optional-odometer',
        kind: 'part',
        occurredOn: '2026-09-29',
        partName: 'filter',
        quantity: 1,
      },
    ],
    [
      'work',
      {
        id: 'work-optional-odometer',
        kind: 'work',
        occurredOn: '2026-09-29',
        workType: 'maintenance',
        description: 'service',
      },
    ],
  ])('accepts and omits an absent odometer for %s records', (_kind, draft) => {
    const result = validateRecord({ ...draft, odometerKm: undefined }, now)

    expect(result).toMatchObject({ valid: true })
    if (result.valid) expect(result.value).not.toHaveProperty('odometerKm')
  })

  it.each<[string, RecordDraft]>([
    ['fuel', validFuel],
    [
      'part',
      {
        id: 'part-invalid-odometer',
        kind: 'part',
        occurredOn: '2026-09-29',
        partName: 'filter',
        quantity: 1,
      },
    ],
    [
      'work',
      {
        id: 'work-invalid-odometer',
        kind: 'work',
        occurredOn: '2026-09-29',
        workType: 'repair',
        description: 'repair',
      },
    ],
  ])('rejects an invalid supplied odometer for %s records', (_kind, draft) => {
    expect(validateRecord({ ...draft, odometerKm: -1 }, now)).toMatchObject({
      valid: false,
      errors: { odometerKm: 'Odometer must be a non-negative whole number.' },
    })
  })

  it('accepts EUR-initialized no-cost drafts and normalizes currency away', () => {
    expect(
      validateRecord(
        { ...validFuel, costAmount: undefined, currency: DEFAULT_CURRENCY },
        now,
      ),
    ).toEqual({
      valid: true,
      value: {
        id: 'fuel-1',
        motorcycleId: DEFAULT_MOTORCYCLE_ID,
        kind: 'fuel',
        occurredOn: '2026-09-29',
        odometerKm: 0,
        liters: 12.5,
        notes: 'full tank',
      },
    })
  })

  it('rejects future, invalid, and incomplete fields together', () => {
    const result = validateRecord(
      {
        id: 'work-1',
        kind: 'work',
        occurredOn: '2026-09-30',
        odometerKm: -1,
        costAmount: 0,
        description: ' ',
      },
      now,
    )

    expect(result).toMatchObject({
      valid: false,
      errors: {
        occurredOn: 'The date cannot be in the future.',
        odometerKm: 'Odometer must be a non-negative whole number.',
        costAmount: 'Cost must be a positive number.',
        currency: 'Cost and currency must be provided together.',
        workType: 'A supported work type is required.',
        description: 'Description is required.',
      },
    })
  })
})
