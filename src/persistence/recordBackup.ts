import { DEFAULT_MOTORCYCLE_ID, type Record } from '../domain/record'
import { validateRecord } from '../domain/validateRecord'
import {
  defaultMotorcycle,
  type Motorcycle,
  validateMotorcycle,
} from '../domain/motorcycle'

export const BACKUP_FORMAT = 'openmotobudget-backup'
export const BACKUP_VERSION = 1

export type RecordBackup = {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  records: Record[]
  motorcycles: Motorcycle[]
}

export function createRecordBackup(
  records: readonly Record[],
  motorcycles: readonly Motorcycle[],
): RecordBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records: [...records],
    motorcycles: [...motorcycles],
  }
}

export function parseRecordBackup(serialized: string): RecordBackup {
  let value: unknown
  try {
    value = JSON.parse(serialized)
  } catch {
    throw new Error('This file is not valid JSON.')
  }

  if (!value || typeof value !== 'object') {
    throw new Error('This file is not an openmotobudget backup.')
  }

  const backup = value as Partial<RecordBackup>
  if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) {
    throw new Error('This backup was created by an unsupported app or version.')
  }
  if (typeof backup.exportedAt !== 'string' || Number.isNaN(Date.parse(backup.exportedAt))) {
    throw new Error('This backup has an invalid export date.')
  }
  if (!Array.isArray(backup.records)) {
    throw new Error('This backup does not contain a record list.')
  }
  const motorcycles = backup.motorcycles === undefined
    ? [defaultMotorcycle]
    : backup.motorcycles
  if (!Array.isArray(motorcycles)) {
    throw new Error('This backup does not contain a motorcycle list.')
  }

  const records = backup.records.map((record) => ({
    ...record,
    motorcycleId: record.motorcycleId ?? DEFAULT_MOTORCYCLE_ID,
  }))
  const recordIds = new Set<string>()
  for (const record of records) {
    if (!record || typeof record !== 'object' || !validateRecord(record as Record).valid) {
      throw new Error('This backup contains an invalid record.')
    }
    if (recordIds.has(record.id)) {
      throw new Error('This backup contains duplicate record identifiers.')
    }
    recordIds.add(record.id)
  }

  const motorcycleIds = new Set<string>()
  for (const motorcycle of motorcycles) {
    try {
      const validatedMotorcycle = validateMotorcycle(motorcycle)
      if (motorcycleIds.has(validatedMotorcycle.id)) {
        throw new Error('This backup contains duplicate motorcycle identifiers.')
      }
      motorcycleIds.add(validatedMotorcycle.id)
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate')) throw error
      throw new Error('This backup contains an invalid motorcycle.')
    }
  }
  for (const record of records) {
    if (!motorcycleIds.has(record.motorcycleId)) {
      throw new Error('This backup contains a record for an unknown motorcycle.')
    }
  }

  return { ...backup, records, motorcycles } as RecordBackup
}
