---
status: active
date: 2026-05-20
subject: 2026-05-20.campaign-readiness-analysis
topics: [google-ads, campaign-analysis, readiness-audit, cli]
research: [research-campaign-readiness-analysis.md]
iterations: []
spec: 
memory:
  - campaign-readiness-plan-2026-05-20.md
  - campaign-readiness-analysis-2026-05-20.md
  - ruby-rewrite-phases-1-2-5-2026-05-20.md
  - phase6-skill-update-cleanup-2026-05-21.md
  - review-iterate-session-2026-05-21.md
---

# Plan: Analyze Campaign Readiness CLI

## Goal
Add a bounded `analyze-campaign` workflow that gathers campaign readiness data from Google Ads, runs deterministic health checks, and produces JSON/text output that can be handed to a model or operator for final deployment analysis.

## Context used / assumptions
- User context: run `b-plan` for `.context/2026-05-20.campaign-readiness-analysis/`.
- Session/workflow context: `.context/workflow/current-session.json`, active research subject, and existing campaign-readiness memory.
- Artifacts used: `index.md`, `research-campaign-readiness-analysis.md`, `research/notes-api-capabilities.md`, `research/notes-analysis-guidelines.md`.
- Code inspected: `src/cli.js`, `src/client.js`, `enable-keywords.js`, `scripts/add-sitelinks.js`, `tests/campaign-builder.test.js`, `skills/google-ads-high-converting/SKILL.md`, `docs/google-ads-api.md`.
- Assumptions:
  - Keep the CLI data-focused; do not embed model calls in the Node CLI.
  - Default reporting window should mirror existing reporting habits (`LAST_30_DAYS`) unless a flag overrides it.
  - Conversion actions will be reported at account scope with campaign-readiness caveats documented in output.

## Scope
- Add a new CLI command: `analyze-campaign --campaign="Name" [--format=json|text] [--date-range=LAST_30_DAYS]`.
- Gather the seven researched readiness dimensions: campaign settings, ad groups, RSA ads, keywords, sitelinks, other assets, negatives, and conversion actions.
- Normalize raw Google Ads rows into a stable report schema.
- Compute deterministic checks and flags that a model/operator can review.
- Document how to use the command from the local project skill.
- Add test coverage for report shaping and deterministic checks.

## Out of scope
- Live campaign mutations or automatic remediation.
- Automatic model scoring or external LLM API calls from Node.
- UI/dashboard work.
- Broad refactors of existing campaign-builder safety logic.
- Full pagination/streaming for very large accounts unless needed by first live test.

## Affected files
- `src/cli.js` — register `analyze-campaign`, parse new flags, and expose help text.
- `src/campaign-analysis.js` *(new)* — campaign lookup, GAQL data gathering, normalization, deterministic checks, and text/JSON formatters.
- `tests/campaign-analysis.test.js` *(new)* — unit coverage for summarizers, check generation, and output shape.
- `skills/google-ads-high-converting/SKILL.md` — add operator workflow for readiness analysis.
- `docs/google-ads-api.md` or `docs/analyze-campaign.md` — capture any query constraints/usage discovered during implementation.

## Implementation steps
1. **Lock the report contract**
   - Define the output schema for campaign summary, ad groups, ads, keywords, sitelinks, assets, negatives, conversion actions, and deterministic findings.
   - Decide which checks are `PASS`, `WARNING`, or `FAIL` in code versus deferred to the model.
2. **Create `src/campaign-analysis.js`**
   - Add helpers to resolve the target campaign and build GAQL queries for each resource.
   - Keep query builders isolated so field changes are easy to patch after live testing.
3. **Normalize raw Google Ads rows**
   - Convert enum-like values to readable status strings where needed.
   - Aggregate keyword/ad counts per ad group and attach metrics.
   - Split sitelinks from other assets and surface campaign-level negatives/conversions clearly.
4. **Compute deterministic readiness checks**
   - Examples: campaign found, search-channel check, enabled/paused status visibility, active ad groups, enabled keywords, enabled RSA ads, RSA minimum asset counts, sitelink presence, other asset presence, negative keyword presence, conversion action presence.
   - Emit both raw findings and summary counts so a model can reason on top of them.
5. **Wire the CLI surface**
   - Add `analyze-campaign` command handling in `src/cli.js`.
   - Support at least `--campaign`, `--format`, and `--date-range`; default to text output with a JSON option for downstream prompting.
6. **Add test coverage**
   - Unit test normalization and deterministic checks with representative fixtures.
   - Avoid live API tests in Jest; keep tests pure and reproducible.
7. **Document the operator workflow**
   - Update the local Google Ads skill with a short “run analyze-campaign, then hand result to the model” recipe.
   - Record GAQL caveats and any campaign-specific limitations uncovered during the first live verification.
8. **Run live verification against a real campaign**
   - Start with `business-purchase-us`.
   - Capture any GAQL incompatibilities, missing fields, or formatting issues and patch the report contract before calling the feature done.

## Verification
- `npm test`
- `node src/cli.js analyze-campaign --campaign="business-purchase-us" --format=text`
- `node src/cli.js analyze-campaign --campaign="business-purchase-us" --format=json`
- Compare campaign-level findings with existing commands where relevant:
  - `node src/cli.js verify-campaign --campaign="business-purchase-us"`
  - `node src/cli.js negatives --campaign="business-purchase-us"`
- Manual review: confirm the JSON output is detailed enough for a model to score the seven dimensions without extra API calls.

## Risks
- Some GAQL field combinations may fail on first pass, especially asset/metrics joins.
- Google Ads response shapes may mix numeric enums and strings, requiring normalization.
- Conversion actions are not naturally campaign-scoped; output must explain that limitation.
- Real accounts may need pagination or narrower date windows if the first test surfaces query limits.

## Recommended next step
Use `/b-build-hard` with this plan. The work is bounded, but live GAQL verification and report-shape iteration add enough ambiguity to justify the harder build workflow.
