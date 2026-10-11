import type { Record } from '../domain/record'
import { validateRecord } from '../domain/validateRecord'

export const BACKUP_FORMAT = 'openmotobudget-backup'
export const BACKUP_VERSION = 1

export type RecordBackup = {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  records: Record[]
}

export function createRecordBackup(records: readonly Record[]): RecordBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    records: [...records],
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

  const recordIds = new Set<string>()
  for (const record of backup.records) {
    if (!record || typeof record !== 'object' || !validateRecord(record as Record).valid) {
      throw new Error('This backup contains an invalid record.')
    }
    if (recordIds.has(record.id)) {
      throw new Error('This backup contains duplicate record identifiers.')
    }
    recordIds.add(record.id)
  }

  return backup as RecordBackup
}
