import type { Record } from '../domain/record'
import {
  type Motorcycle,
  validateMotorcycle,
} from '../domain/motorcycle'
import { validateRecord } from '../domain/validateRecord'

export const RECORDS_STORAGE_KEY = 'motorcycle-records'

export interface RecordRepository {
  list(): Record[]
  findById(id: string): Record | undefined
  save(record: Record): void
  remove(id: string): void
}

export interface AsyncRecordRepository {
  list(): Promise<Record[]>
  listMotorcycles(): Promise<Motorcycle[]>
  save(record: Record): Promise<void>
  saveMotorcycle(motorcycle: Motorcycle): Promise<void>
  remove(id: string): Promise<void>
  importLegacy(records: readonly Record[]): Promise<void>
  replaceAll(records: readonly Record[], motorcycles: readonly Motorcycle[]): Promise<void>
}

type WorkerRequest = {
  id: number
  operation: 'initialize' | 'list' | 'list-motorcycles' | 'save' | 'save-motorcycle' | 'remove' | 'import' | 'replace'
  record?: Record
  motorcycle?: Motorcycle
  motorcycles?: readonly Motorcycle[]
  recordId?: string
  records?: readonly Record[]
}

type WorkerResponse = {
  id: number
  result?: unknown
  error?: string
}

interface SqliteWorker {
  postMessage(request: WorkerRequest): void
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerResponse>) => void): void
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
}

export type SqliteWorkerFactory = () => SqliteWorker

function normalizeRecord(value: unknown): Record | undefined {
  if (!value || typeof value !== 'object') return undefined
  const validation = validateRecord(value as Record)
  return validation.valid ? validation.value : undefined
}

export class LocalStorageRecordRepository implements RecordRepository {
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  private readonly storageKey: string

  constructor(
    storage: Pick<Storage, 'getItem' | 'setItem'>,
    storageKey = RECORDS_STORAGE_KEY,
  ) {
    this.storage = storage
    this.storageKey = storageKey
  }

  list(): Record[] {
    const serialized = this.storage.getItem(this.storageKey)
    if (!serialized) return []
    try {
      const values: unknown = JSON.parse(serialized)
      return Array.isArray(values)
        ? values.flatMap((value) => {
          const record = normalizeRecord(value)
          return record ? [record] : []
        })
        : []
    } catch {
      return []
    }
  }

  findById(id: string): Record | undefined {
    return this.list().find((record) => record.id === id)
  }

  save(record: Record): void {
    const validation = validateRecord(record)
    if (!validation.valid) {
      throw new Error(`Cannot save invalid record: ${Object.values(validation.errors).join(' ')}`)
    }
    const records = this.list()
    const index = records.findIndex((existing) => existing.id === record.id)
    if (index === -1) records.push(validation.value)
    else records[index] = validation.value
    this.persist(records)
  }

  remove(id: string): void {
    this.persist(this.list().filter((record) => record.id !== id))
  }

  private persist(records: Record[]): void {
    this.storage.setItem(this.storageKey, JSON.stringify(records))
  }
}

function createSqliteWorker(): SqliteWorker {
  return new Worker(new URL('./sqliteOpfsWorker.ts', import.meta.url), { type: 'module' })
}

export class SqliteOpfsRecordRepository implements AsyncRecordRepository {
  private readonly worker: SqliteWorker
  private readonly pending = new Map<number, {
    resolve: (result: unknown) => void
    reject: (error: Error) => void
  }>()
  private nextRequestId = 1
  private readonly ready: Promise<void>

  constructor(workerFactory: SqliteWorkerFactory = createSqliteWorker) {
    this.worker = workerFactory()
    this.worker.addEventListener('message', (event) => {
      const pending = this.pending.get(event.data.id)
      if (!pending) return
      this.pending.delete(event.data.id)
      if (event.data.error) pending.reject(new Error(event.data.error))
      else pending.resolve(event.data.result)
    })
    this.worker.addEventListener('error', (event) => {
      const error = new Error(`Browser SQLite worker failed: ${event.message}`)
      this.pending.forEach(({ reject }) => reject(error))
      this.pending.clear()
    })
    this.ready = this.request('initialize').then(() => undefined)
  }

  async list(): Promise<Record[]> {
    const values: unknown = await this.execute('list')
    if (!Array.isArray(values)) {
      throw new Error('Browser SQLite returned invalid record data.')
    }
    const records: Record[] = []
    for (const value of values) {
      const record = normalizeRecord(value)
      if (!record) {
        throw new Error('Browser SQLite returned invalid record data.')
      }
      records.push(record)
    }
    return records
  }

  async listMotorcycles(): Promise<Motorcycle[]> {
    const values: unknown = await this.execute('list-motorcycles')
    if (!Array.isArray(values)) throw new Error('Browser SQLite returned invalid motorcycle data.')
    try {
      return values.map((value) => validateMotorcycle(value as Motorcycle))
    } catch {
      throw new Error('Browser SQLite returned invalid motorcycle data.')
    }
  }

  async save(record: Record): Promise<void> {
    const validation = validateRecord(record)
    if (!validation.valid) {
      throw new Error(`Cannot save invalid record: ${Object.values(validation.errors).join(' ')}`)
    }
    await this.execute('save', { record: validation.value })
  }

  async saveMotorcycle(motorcycle: Motorcycle): Promise<void> {
    await this.execute('save-motorcycle', { motorcycle: validateMotorcycle(motorcycle) })
  }

  async remove(id: string): Promise<void> {
    await this.execute('remove', { recordId: id })
  }

  async importLegacy(records: readonly Record[]): Promise<void> {
    if (records.length === 0) return
    for (const record of records) {
      if (!normalizeRecord(record)) throw new Error('Cannot import invalid legacy record data.')
    }
    await this.execute('import', { records })
  }

  async replaceAll(
    records: readonly Record[],
    motorcycles: readonly Motorcycle[],
  ): Promise<void> {
    for (const record of records) {
      if (!normalizeRecord(record)) throw new Error('Cannot import invalid record data.')
    }
    if (new Set(records.map((record) => record.id)).size !== records.length) {
      throw new Error('Cannot import records with duplicate identifiers.')
    }
    const validatedMotorcycles = motorcycles.map(validateMotorcycle)
    if (new Set(validatedMotorcycles.map((motorcycle) => motorcycle.id)).size !== motorcycles.length) {
      throw new Error('Cannot import motorcycles with duplicate identifiers.')
    }
    const motorcycleIds = new Set(validatedMotorcycles.map((motorcycle) => motorcycle.id))
    if (records.some((record) => record.motorcycleId && !motorcycleIds.has(record.motorcycleId))) {
      throw new Error('Cannot import a record for an unknown motorcycle.')
    }
    await this.execute('replace', { records, motorcycles: validatedMotorcycles })
  }

  private async execute(
    operation: WorkerRequest['operation'],
    request: Omit<WorkerRequest, 'id' | 'operation'> = {},
  ): Promise<unknown> {
    await this.ready
    return this.request(operation, request)
  }

  private request(
    operation: WorkerRequest['operation'],
    request: Omit<WorkerRequest, 'id' | 'operation'> = {},
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextRequestId++
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, operation, ...request })
    })
  }
}
