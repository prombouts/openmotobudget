# Squad Decisions

## Active Decisions

### 2026-09-29T11:52:59.705+02:00: Initialize motorcycle expense tracking squad

**By:** Lead

**What:** Establish the confirmed descriptive-naming Squad roster for ReactApp: Lead, Frontend, Backend, Data, Tester, Scribe, Ralph, Rai, and Fact Checker.

**Why:** The application needs coordinated ownership of React UI, services and persistence, motorcycle expense data, quality, and review.

**Consequences:** Route work using `.squad/routing.md`; store cross-agent decisions in the inbox for Scribe to merge.

### 2026-09-30T14:35:04.807+02:00: Migrate durable records to browser SQLite WebAssembly and OPFS (consolidated)

**By:** Lead, Backend, Tester

**What:** Supersede the local Node HTTP API, `node:sqlite`, and `data/motorcycle-records.sqlite` persistence decision. Persist records exclusively in browser SQLite using the official `@sqlite.org/sqlite-wasm` package and its OPFS VFS, hosted by an ESM Web Worker behind the existing asynchronous repository interface and typed worker messages. Require cross-origin isolation. Remove the server runtime, `/api` proxy, repository database file, and API tests; migrate valid legacy localStorage data once and transactionally into OPFS. Do not fall back to another persistence store: surface unavailable OPFS, Worker, or database initialization as a blocking persistence error. Test the public `SqliteOpfsRecordRepository` worker protocol in Vitest for CRUD/import, invalid saves, initialization failures, and malformed worker results, while validating actual WASM/OPFS behavior in Chromium served with the configured COOP/COEP headers.

**Why:** Durable browser-only SQLite compiled to WebAssembly with OPFS is required; a local server, project filesystem database, or fallback browser storage violates that boundary. Vitest's Node environment cannot provide the cross-origin-isolated browser Worker and OPFS APIs required by SQLite's `OpfsDb`, so protocol tests must retain explicit error boundaries without falsely simulating the runtime.

**Consequences:** The MVP record model and its validation contract remain persistence-independent. Update development/build commands and README for the browser-worker runtime; require a browser integration run for the real persistence layer.

### 2026-09-29T14:14:19.888+02:00: Define MVP record and currency validation contract (consolidated)

**By:** Lead, Backend, Tester

**What:** Use one discriminated `Record` model with `fuel`, `part`, and `work` variants. Saved records require a stable non-empty id, ISO calendar date no later than the user's local today, non-negative integer odometer, and kind-specific required fields; notes are optional and trimmed. Monetary cost remains optional, but cost and currency must be supplied together, cost must be finite and strictly positive, and currency must be non-empty and normalized consistently. EUR is the initial form default, and an untouched default currency with no cost is treated as absent. Validate at the persistence boundary, preserve currency per record, and use upsert-by-id semantics; malformed stored data must be ignored rather than breaking the UI.

**Why:** The model needs explicit common and kind-specific invariants while allowing records without costs. This consolidates the approved form/persistence contract, the local repository validation rules, and the tester's identified EUR-default mismatch; the delivered implementation resolves that mismatch so an untouched EUR draft without cost is valid.

**Consequences:** Frontend forms expose common fields plus selected-kind fields, preserve compatible unsaved input on kind changes, map validation errors to controls, sort newest dates first with deterministic id tie-breakers at presentation, and require confirmation for deletion. Tests cover valid kinds, trimming, mandatory and numeric/date failures, optional cost/currency combinations, malformed-data recovery, and add/edit/delete/empty flows.

### 2026-09-29T14:14:19.888+02:00: Define currency-safe expense reporting (consolidated)

**By:** Data

**What:** Treat `costAmount` as the total amount for one record in its recorded currency. Reports group by currency and show totals for priced records plus counts of records with no cost. Monthly aggregation groups valid priced records by `(occurredOn.slice(0, 7), currency)`, with `fuel`, `part`, and `work` as stacked categories; monthly totals are derived from those category sums. Unpriced records are excluded from monetary sums and exposed only through separate month/category counts.

**Why:** The MVP has optional costs, no exchange-rate basis, and accepts any non-empty currency string. Combining currencies or treating absent prices as zero would produce misleading totals, and `pricePerLiter` is supplemental fuel detail rather than a substitute for record-level cost.

**Consequences:** The frontend must not create combined-currency totals or stacks. It should select/filter a currency or show separate currency series/panels, preserve exact persisted currency values, sort `YYYY-MM` ascending, and distinguish empty states for no records, no priced records, and no records in the selected currency.

## Governance

- All meaningful changes require team consensus.
- Document architectural decisions here.
- Keep history focused on work, decisions focused on direction.
