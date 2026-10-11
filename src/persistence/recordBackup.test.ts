import { describe, expect, it } from 'vitest'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createRecordBackup,
  parseRecordBackup,
} from './recordBackup'

const fuelRecord = {
  id: 'fuel-1',
  kind: 'fuel' as const,
  occurredOn: '2020-09-01',
  liters: 10,
}

describe('record backups', () => {
  it('creates a versioned backup and parses it again', () => {
    const backup = createRecordBackup([fuelRecord])

    expect(backup).toMatchObject({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      records: [fuelRecord],
    })
    expect(parseRecordBackup(JSON.stringify(backup))).toEqual(backup)
  })

  it('rejects malformed, unsupported, and invalid backup data', () => {
    expect(() => parseRecordBackup('not json')).toThrow('This file is not valid JSON.')
    expect(() => parseRecordBackup(JSON.stringify({
      format: BACKUP_FORMAT,
      version: 99,
      exportedAt: '2020-09-01T12:00:00.000Z',
      records: [],
    }))).toThrow('This backup was created by an unsupported app or version.')
    expect(() => parseRecordBackup(JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: '2020-09-01T12:00:00.000Z',
      records: [{ ...fuelRecord, liters: 0 }],
    }))).toThrow('This backup contains an invalid record.')
  })

  it('rejects backups with duplicate records', () => {
    expect(() => parseRecordBackup(JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: '2020-09-01T12:00:00.000Z',
      records: [fuelRecord, fuelRecord],
    }))).toThrow('This backup contains duplicate record identifiers.')
  })
})
