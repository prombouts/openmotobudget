import type { Record } from '../domain/record'
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
  save(record: Record): Promise<void>
  remove(id: string): Promise<void>
  importLegacy(records: readonly Record[]): Promise<void>
  replaceAll(records: readonly Record[]): Promise<void>
}

type WorkerRequest = {
  id: number
  operation: 'initialize' | 'list' | 'save' | 'remove' | 'import' | 'replace'
  record?: Record
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

function isRecord(value: unknown): value is Record {
  if (!value || typeof value !== 'object') return false
  return validateRecord(value as Record).valid
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
      return Array.isArray(values) ? values.filter(isRecord) : []
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
    if (!Array.isArray(values) || values.some((value) => !isRecord(value))) {
      throw new Error('Browser SQLite returned invalid record data.')
    }
    return values
  }

  async save(record: Record): Promise<void> {
    const validation = validateRecord(record)
    if (!validation.valid) {
      throw new Error(`Cannot save invalid record: ${Object.values(validation.errors).join(' ')}`)
    }
    await this.execute('save', { record: validation.value })
  }

  async remove(id: string): Promise<void> {
    await this.execute('remove', { recordId: id })
  }

  async importLegacy(records: readonly Record[]): Promise<void> {
    if (records.length === 0) return
    for (const record of records) {
      if (!isRecord(record)) throw new Error('Cannot import invalid legacy record data.')
    }
    await this.execute('import', { records })
  }

  async replaceAll(records: readonly Record[]): Promise<void> {
    for (const record of records) {
      if (!isRecord(record)) throw new Error('Cannot import invalid record data.')
    }
    if (new Set(records.map((record) => record.id)).size !== records.length) {
      throw new Error('Cannot import records with duplicate identifiers.')
    }
    await this.execute('replace', { records })
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
