export type RecordKind = 'fuel' | 'part' | 'work'
export type WorkType = 'maintenance' | 'repair'
export const DEFAULT_CURRENCY = 'EUR'

interface RecordBase {
  id: string
  occurredOn: string
  odometerKm?: number
  costAmount?: number
  currency?: string
  notes?: string
}

export interface FuelRecord extends RecordBase {
  kind: 'fuel'
  liters: number
  pricePerLiter?: number
}

export interface PartRecord extends RecordBase {
  kind: 'part'
  partName: string
  quantity: number
}

export interface WorkRecord extends RecordBase {
  kind: 'work'
  workType: WorkType
  description: string
}

export type Record = FuelRecord | PartRecord | WorkRecord

export interface RecordDraft {
  id?: string
  kind?: RecordKind
  occurredOn?: string
  odometerKm?: number
  costAmount?: number
  currency?: string
  notes?: string
  liters?: number
  pricePerLiter?: number
  partName?: string
  quantity?: number
  workType?: WorkType
  description?: string
}

export function createInitialRecordDraft(now: Date = new Date()): RecordDraft {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return {
    occurredOn: `${now.getFullYear()}-${month}-${day}`,
    currency: DEFAULT_CURRENCY,
  }
}

export type RecordValidationResult =
  | { valid: true; value: Record }
  | { valid: false; errors: { [field: string]: string } }
