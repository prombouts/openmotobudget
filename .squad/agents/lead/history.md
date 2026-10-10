# Project Context

- **Owner:** Peter Rombouts
- **Project:** A React application for tracking motorcycle expenses, cost categories, and expense reporting.
- **Stack:** React; application services, persistence, calculations, and reporting
- **Created:** 2026-09-29T11:52:59.705+02:00

## Learnings

Initial team setup complete.

📌 Team update (2026-09-29T14:14:19.888+02:00): Peter selected local SQLite API persistence, superseding deferred/browser-local persistence; the MVP record and currency validation contract is consolidated and canonical — decided by Lead, Backend, Tester.

📌 Team update (2026-09-30T14:35:04.807+02:00): Browser SQLite WebAssembly with OPFS in an ESM Worker supersedes the Node SQLite API; cross-origin isolation, transactional legacy migration, and blocking initialization errors are required — decided by Lead, Backend, Tester.
