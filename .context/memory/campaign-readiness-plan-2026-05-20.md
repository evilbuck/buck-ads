---
date: 2026-05-20
domains: [ads, planning]
topics: [google-ads, campaign-analysis, readiness-audit, cli]
subject: 2026-05-20.campaign-readiness-analysis
artifacts: [plan-analyze-campaign.md, tasks.md, index.md]
related: [campaign-readiness-analysis-2026-05-20.md]
priority: high
status: active
---

# Session: 2026-05-20 - Campaign Readiness Implementation Plan

## Context
- Previous work: Research defined the seven analysis dimensions and hybrid CLI + model approach.
- Goal: Convert the research into an actionable implementation plan for an `analyze-campaign` command.

## Decisions Made
- Keep the Node CLI data-only; no embedded LLM calls.
- Introduce a dedicated `src/campaign-analysis.js` module instead of overloading `src/cli.js`.
- Default to text output with a JSON mode for downstream prompting.
- Treat live verification against `business-purchase-us` as mandatory before calling the feature complete.

## Implementation Notes
- Plan saved at `.context/2026-05-20.campaign-readiness-analysis/plan-analyze-campaign.md`.
- Subject task tracker created at `.context/2026-05-20.campaign-readiness-analysis/tasks.md`.
- Backlog item created: `.context/backlog/items/implement-analyze-campaign-readiness-audit.md`.

## Next Steps
- [ ] Run `/b-build-hard` using the new plan.
- [ ] Implement the analysis module and CLI wiring.
- [ ] Add Jest coverage.
- [ ] Run live verification and capture GAQL caveats in docs/skill updates.
