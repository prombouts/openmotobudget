# Project Context

- **Owner:** Peter Rombouts
- **Project:** A React application for tracking motorcycle expenses, cost categories, and expense reporting.
- **Stack:** React; application services, persistence, calculations, and reporting
- **Created:** 2026-09-29T11:52:59.705+02:00

## Learnings

Initial team setup complete.

📌 Team update (2026-09-29T14:14:19.888+02:00): Local SQLite persistence via loopback Node API and the validated discriminated record contract are now canonical; EUR remains the initial draft default while cost/currency stay optional as a pair — decided by Lead, Backend, Tester.

📌 Team update (2026-09-30T14:35:04.807+02:00): Browser SQLite WebAssembly with OPFS in an ESM Worker supersedes the Node SQLite API; cross-origin isolation, transactional legacy migration, and blocking initialization errors are required — decided by Lead, Backend, Tester.
