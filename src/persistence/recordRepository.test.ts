import { describe, expect, it } from 'vitest'
import type { Record } from '../domain/record'
import {
  LocalStorageRecordRepository,
  RECORDS_STORAGE_KEY,
  SqliteOpfsRecordRepository,
  type SqliteWorkerFactory,
} from './recordRepository'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class MemorySqliteWorker {
  private readonly records = new Map<string, Record>()
  private messageListener?: (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void

  postMessage(request: {
    id: number
    operation: 'initialize' | 'list' | 'save' | 'remove' | 'import'
    record?: Record
    recordId?: string
    records?: readonly Record[]
  }): void {
    queueMicrotask(() => {
      switch (request.operation) {
        case 'initialize':
          return this.respond(request.id)
        case 'list':
          return this.respond(request.id, [...this.records.values()])
        case 'save':
          this.records.set(request.record!.id, request.record!)
          return this.respond(request.id)
        case 'remove':
          this.records.delete(request.recordId!)
          return this.respond(request.id)
        case 'import':
          request.records?.forEach((record) => {
            if (!this.records.has(record.id)) this.records.set(record.id, record)
          })
          return this.respond(request.id)
      }
    })
  }

  addEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') this.messageListener = listener as (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void
  }

  private respond(id: number, result?: unknown, error?: string): void {
    this.messageListener?.({ data: { id, result, error } } as MessageEvent)
  }
}

class ErroringSqliteWorker {
  private messageListener?: (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void

  postMessage(request: {
    id: number
    operation: 'initialize' | 'list' | 'save' | 'remove' | 'import'
  }): void {
    queueMicrotask(() => {
      this.messageListener?.({
        data: {
          id: request.id,
          error: request.operation === 'initialize'
            ? 'OPFS is unavailable'
            : 'SQLite worker request failed',
        },
      } as MessageEvent)
    })
  }

  addEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') this.messageListener = listener as (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void
  }
}

class InvalidResultSqliteWorker {
  private messageListener?: (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void

  postMessage(request: {
    id: number
    operation: 'initialize' | 'list' | 'save' | 'remove' | 'import'
  }): void {
    queueMicrotask(() => {
      this.messageListener?.({
        data: {
          id: request.id,
          result: request.operation === 'list' ? [{ id: 'malformed' }] : undefined,
        },
      } as MessageEvent)
    })
  }

  addEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') this.messageListener = listener as (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void
  }
}

class CrashingSqliteWorker {
  private messageListener?: (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void
  private errorListener?: (event: ErrorEvent) => void

  postMessage(request: {
    id: number
    operation: 'initialize' | 'list' | 'save' | 'remove' | 'import'
  }): void {
    queueMicrotask(() => {
      if (request.operation === 'initialize') {
        this.messageListener?.({ data: { id: request.id } } as MessageEvent)
      } else {
        this.errorListener?.({ message: 'worker crashed' } as ErrorEvent)
      }
    })
  }

  addEventListener(
    type: 'message' | 'error',
    listener: ((event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') this.messageListener = listener as (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => void
    else this.errorListener = listener as (event: ErrorEvent) => void
  }
}

const fuelRecord: Record = {
  id: 'fuel-1',
  kind: 'fuel',
  occurredOn: '2020-09-01',
  odometerKm: 1250,
  liters: 10,
}

describe('LocalStorageRecordRepository', () => {
  it('upserts records in local storage', () => {
    const storage = new MemoryStorage()
    const repository = new LocalStorageRecordRepository(storage)

    repository.save(fuelRecord)
    repository.save({ ...fuelRecord, odometerKm: 1300 })

    expect(repository.list()).toEqual([{ ...fuelRecord, odometerKm: 1300 }])
    expect(repository.findById('fuel-1')).toMatchObject({ odometerKm: 1300 })
    expect(storage.getItem(RECORDS_STORAGE_KEY)).toContain('"fuel-1"')
  })

  describe('SqliteOpfsRecordRepository', () => {
    const workerFactory: SqliteWorkerFactory = () => new MemorySqliteWorker()

    it('upserts, lists, imports, and removes records through the SQLite worker', async () => {
      const repository = new SqliteOpfsRecordRepository(workerFactory)
      const importedRecord: Record = {
        id: 'part-1',
        kind: 'part',
        occurredOn: '2020-10-01',
        odometerKm: 1300,
        partName: 'filter',
        quantity: 1,
      }

      await repository.importLegacy([fuelRecord, importedRecord])
      await repository.save({ ...fuelRecord, liters: 12 })
      await repository.importLegacy([{ ...fuelRecord, liters: 99 }])

      expect(await repository.list()).toEqual([
        { ...fuelRecord, liters: 12 },
        importedRecord,
      ])

      await repository.remove('fuel-1')
      expect(await repository.list()).toEqual([importedRecord])
    })

    it('rejects invalid records before sending them to browser SQLite', async () => {
      const repository = new SqliteOpfsRecordRepository(workerFactory)

      await expect(repository.save({ ...fuelRecord, liters: 0 } as Record))
        .rejects.toThrow('Cannot save invalid record: Liters must be a positive number.')
    })

    it('surfaces OPFS initialization failures without falling back to another store', async () => {
      const repository = new SqliteOpfsRecordRepository(
        () => new ErroringSqliteWorker(),
      )

      await expect(repository.list()).rejects.toThrow('OPFS is unavailable')
    })

    it('rejects malformed data returned by the SQLite worker', async () => {
      const repository = new SqliteOpfsRecordRepository(
        () => new InvalidResultSqliteWorker(),
      )

      await expect(repository.list()).rejects.toThrow(
        'Browser SQLite returned invalid record data.',
      )
    })

    it('turns a worker error event into a persistence failure', async () => {
      const repository = new SqliteOpfsRecordRepository(
        () => new CrashingSqliteWorker(),
      )

      await expect(repository.list()).rejects.toThrow(
        'Browser SQLite worker failed: worker crashed',
      )
    })
  })

  it('loads valid records, ignores malformed entries, and retains storage order', () => {
    const storage = new MemoryStorage()
    const partRecord: Record = {
      id: 'part-1',
      kind: 'part',
      occurredOn: '2020-10-01',
      odometerKm: 1300,
      partName: 'filter',
      quantity: 1,
    }
    storage.setItem(
      RECORDS_STORAGE_KEY,
      JSON.stringify([
        fuelRecord,
        { ...partRecord, id: '', partName: 'invalid' },
        { id: 'not-a-record' },
        partRecord,
      ]),
    )

    const repository = new LocalStorageRecordRepository(storage)
    expect(repository.list()).toEqual([fuelRecord, partRecord])
    expect(repository.findById('part-1')).toEqual(partRecord)
    expect(repository.findById('missing')).toBeUndefined()
  })

  it('persists records without an odometer', () => {
    const storage = new MemoryStorage()
    const repository = new LocalStorageRecordRepository(storage)
    const record: Record = {
      id: 'fuel-without-odometer',
      kind: 'fuel',
      occurredOn: '2020-09-01',
      liters: 10,
    }

    repository.save(record)

    expect(repository.list()).toEqual([record])
    expect(JSON.parse(storage.getItem(RECORDS_STORAGE_KEY)!)).toEqual([record])
  })

  it.each([
    ['malformed JSON', '{not json'],
    ['a non-array value', JSON.stringify({ record: fuelRecord })],
  ])('returns an empty list for %s', (_name, storedValue) => {
    const storage = new MemoryStorage()
    storage.setItem(RECORDS_STORAGE_KEY, storedValue)

    expect(new LocalStorageRecordRepository(storage).list()).toEqual([])
  })

  it('deletes matching records and persists the remaining records', () => {
    const storage = new MemoryStorage()
    const repository = new LocalStorageRecordRepository(storage)
    const partRecord: Record = {
      id: 'part-1',
      kind: 'part',
      occurredOn: '2020-10-01',
      odometerKm: 1300,
      partName: 'filter',
      quantity: 1,
    }

    repository.save(fuelRecord)
    repository.save(partRecord)
    repository.remove('fuel-1')

    expect(repository.list()).toEqual([partRecord])
    expect(JSON.parse(storage.getItem(RECORDS_STORAGE_KEY)!)).toEqual([partRecord])
  })

  it('refuses invalid records rather than persisting them', () => {
    const storage = new MemoryStorage()
    const repository = new LocalStorageRecordRepository(storage)

    expect(() =>
      repository.save({ ...fuelRecord, liters: 0 } as Record),
    ).toThrow('Cannot save invalid record: Liters must be a positive number.')
    expect(storage.getItem(RECORDS_STORAGE_KEY)).toBeNull()
  })
})
