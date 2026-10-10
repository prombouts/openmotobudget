# Squad Team

> A React application for tracking motorcycle expenses, cost categories, and expense reporting.

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. Does not generate domain artifacts. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Lead | Lead | `.squad/agents/lead/charter.md` | ✅ Active |
| Frontend | Frontend Dev | `.squad/agents/frontend/charter.md` | ✅ Active |
| Backend | Backend Dev | `.squad/agents/backend/charter.md` | ✅ Active |
| Data | Data Specialist | `.squad/agents/data/charter.md` | ✅ Active |
| Tester | Tester | `.squad/agents/tester/charter.md` | ✅ Active |
| Scribe | (silent) | `.squad/agents/scribe/charter.md` | 📋 Silent |
| Ralph | (monitor) | `.squad/agents/ralph/charter.md` | 🔄 Monitor |
| Rai | (background) | `.squad/agents/Rai/charter.md` | 🛡️ Background |
| Fact Checker | (verifier) | `.squad/agents/fact-checker/charter.md` | 🔍 Verifier |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- Small isolated features with clear specs
- Boilerplate/scaffolding generation
- Documentation fixes and README updates

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium features with clear specs and acceptance criteria
- Refactoring with existing test coverage
- API endpoint additions following established patterns
- Migration scripts with well-defined schemas

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions and system design
- Multi-system integration requiring coordination
- Ambiguous requirements needing clarification
- Security-critical changes (auth, encryption, access control)
- Performance-critical paths requiring benchmarking
- Changes requiring cross-team discussion

## Project Context

- **Owner:** Peter Rombouts
- **Project:** ReactApp
- **Stack:** React; application services, persistence, calculations, and reporting
- **Description:** A React application for tracking motorcycle expenses, cost categories, and expense reporting.
- **Created:** 2026-09-29T11:52:59.705+02:00
