/// <reference lib="webworker" />

import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm'
import type { Record } from '../domain/record'

type Operation = 'initialize' | 'list' | 'save' | 'remove' | 'import'

type Request = {
  id: number
  operation: Operation
  record?: Record
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
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY NOT NULL,
      occurred_on TEXT NOT NULL,
      payload TEXT NOT NULL
    ) STRICT;
  `)
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
    case 'save': {
      if (!request.record) throw new Error('A record is required.')
      db.exec({
        sql: `
          INSERT INTO records (id, occurred_on, payload) VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET occurred_on = excluded.occurred_on, payload = excluded.payload
        `,
        bind: [
          request.record.id,
          request.record.occurredOn,
          JSON.stringify(request.record),
        ],
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
            sql: 'INSERT OR IGNORE INTO records (id, occurred_on, payload) VALUES (?, ?, ?)',
            bind: [record.id, record.occurredOn, JSON.stringify(record)],
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
