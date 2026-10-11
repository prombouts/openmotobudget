/// <reference lib="webworker" />

import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'
import { DEFAULT_MOTORCYCLE_ID, type Record } from '../domain/record'
import { defaultMotorcycle, type Motorcycle } from '../domain/motorcycle'

type Operation = 'initialize' | 'list' | 'list-motorcycles' | 'save' | 'save-motorcycle' | 'remove' | 'import' | 'replace'

type Request = {
  id: number
  operation: Operation
  record?: Record
  motorcycle?: Motorcycle
  motorcycles?: readonly Motorcycle[]
  recordId?: string
  records?: readonly Record[]
}

let database: Database | undefined

async function getDatabase(): Promise<Database> {
  if (database) return database
  if (!self.crossOriginIsolated) {
    throw new Error(
      'Browser SQLite requires cross-origin isolation. Configure COOP and COEP response headers and reload.',
    )
  }

  const sqlite3 = await sqlite3InitModule()
  if (!sqlite3.oo1.OpfsDb) {
    throw new Error('This browser does not support the OPFS storage required for SQLite.')
  }

  database = new sqlite3.oo1.OpfsDb('/motorcycle-records.sqlite3')
  database.exec(`
    CREATE TABLE IF NOT EXISTS motorcycles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL
    ) STRICT;
  `)
  database.exec({
    sql: 'INSERT OR IGNORE INTO motorcycles (id, name) VALUES (?, ?)',
    bind: [defaultMotorcycle.id, defaultMotorcycle.name],
  })
  database.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY NOT NULL,
      motorcycle_id TEXT NOT NULL,
      occurred_on TEXT NOT NULL,
      payload TEXT NOT NULL
    ) STRICT;
  `)
  const recordColumns = database.exec({
    sql: 'PRAGMA table_info(records)',
    rowMode: 'object',
    returnValue: 'resultRows',
  }) as { name: string }[]
  if (!recordColumns.some((column) => column.name === 'motorcycle_id')) {
    database.exec(`
      ALTER TABLE records
      ADD COLUMN motorcycle_id TEXT NOT NULL DEFAULT '${DEFAULT_MOTORCYCLE_ID}';
    `)
  }
  const legacyRows = database.exec({
    sql: 'SELECT id, payload FROM records',
    rowMode: 'object',
    returnValue: 'resultRows',
  }) as { id: string; payload: string }[]
  database.exec('BEGIN')
  try {
    for (const row of legacyRows) {
      const record = JSON.parse(row.payload) as Partial<Record>
      const motorcycleId = record.motorcycleId ?? DEFAULT_MOTORCYCLE_ID
      database.exec({
        sql: 'UPDATE records SET motorcycle_id = ?, payload = ? WHERE id = ?',
        bind: [motorcycleId, JSON.stringify({ ...record, motorcycleId }), row.id],
      })
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return database
}

async function execute(request: Request): Promise<unknown> {
  const db = await getDatabase()

  switch (request.operation) {
    case 'initialize':
      return undefined
    case 'list': {
      const rows = db.exec({
        sql: 'SELECT payload FROM records ORDER BY occurred_on DESC, id DESC',
        rowMode: 'object',
        returnValue: 'resultRows',
      }) as { payload: string }[]
      return rows.map(({ payload }) => JSON.parse(payload))
    }
    case 'list-motorcycles':
      return db.exec({
        sql: 'SELECT id, name FROM motorcycles ORDER BY name COLLATE NOCASE, id',
        rowMode: 'object',
        returnValue: 'resultRows',
      })
    case 'save': {
      if (!request.record) throw new Error('A record is required.')
      db.exec({
        sql: `
          INSERT INTO records (id, motorcycle_id, occurred_on, payload) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET motorcycle_id = excluded.motorcycle_id, occurred_on = excluded.occurred_on, payload = excluded.payload
        `,
        bind: [
          request.record.id,
          request.record.motorcycleId,
          request.record.occurredOn,
          JSON.stringify(request.record),
        ],
      })
      return undefined
    }
    case 'save-motorcycle': {
      if (!request.motorcycle) throw new Error('A motorcycle is required.')
      db.exec({
        sql: `
          INSERT INTO motorcycles (id, name) VALUES (?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name
        `,
        bind: [request.motorcycle.id, request.motorcycle.name],
      })
      return undefined
    }
    case 'remove':
      db.exec({ sql: 'DELETE FROM records WHERE id = ?', bind: [request.recordId ?? ''] })
      return undefined
    case 'import': {
      const records = request.records ?? []
      db.exec('BEGIN')
      try {
        for (const record of records) {
          db.exec({
            sql: 'INSERT OR IGNORE INTO records (id, motorcycle_id, occurred_on, payload) VALUES (?, ?, ?, ?)',
            bind: [record.id, record.motorcycleId, record.occurredOn, JSON.stringify(record)],
          })
        }
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return undefined
    }
    case 'replace': {
      const records = request.records ?? []
      const motorcycles = request.motorcycles ?? [defaultMotorcycle]
      db.exec('BEGIN')
      try {
        db.exec('DELETE FROM records')
        db.exec('DELETE FROM motorcycles')
        for (const motorcycle of motorcycles) {
          db.exec({
            sql: 'INSERT INTO motorcycles (id, name) VALUES (?, ?)',
            bind: [motorcycle.id, motorcycle.name],
          })
        }
        for (const record of records) {
          db.exec({
            sql: 'INSERT INTO records (id, motorcycle_id, occurred_on, payload) VALUES (?, ?, ?, ?)',
            bind: [record.id, record.motorcycleId, record.occurredOn, JSON.stringify(record)],
          })
        }
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      return undefined
    }
  }
}

self.addEventListener('message', (event: MessageEvent<Request>) => {
  void execute(event.data).then(
    (result) => self.postMessage({ id: event.data.id, result }),
    (error: unknown) =>
      self.postMessage({
        id: event.data.id,
        error: error instanceof Error ? error.message : 'Browser SQLite failed unexpectedly.',
      }),
  )
})
