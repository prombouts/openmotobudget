# Work Routing

How to decide who handles work for the motorcycle-expense application.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Scope, architecture, cross-cutting review | Lead | Feature boundaries, technical decisions, pull-request review |
| React screens, forms, dashboards | Frontend | Expense entry UI, filters, accessibility, visualizations |
| Services, persistence, calculations | Backend | Expense service, storage adapters, totals and running-cost calculations |
| Motorcycle cost taxonomy and reporting | Data | Categories, data model, report definitions, data-quality rules |
| Tests, quality, edge cases | Tester | Unit/integration tests, validation cases, regressions |
| Decisions and cross-agent context | Scribe | Decision merging, history and session logs |
| Queue and follow-through | Ralph | Backlog health, stalled work, next steps |
| Responsible-AI awareness and content safety | Rai | Privacy, secrets, accessibility and safety review |
| Verification and devil's-advocate review | Fact Checker | Claim verification, pre-mortems, evidence checks |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Lead |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it and assigns the appropriate `squad:{member}` label.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the inbox for untriaged issues.

## Rules

1. Eager by default — start all agents who can make independent progress.
2. Scribe runs after substantial work as a background agent.
3. Quick factual questions are answered directly by the coordinator.
4. Route overlapping work to the agent whose domain is the primary concern.
5. A team request fans out to all relevant agents.
6. Include Tester early when a feature changes behavior.
7. Include Data when changes affect categories, calculations, reporting, or retained expense data.
8. Include Rai and Fact Checker for the reviews their policies require.
