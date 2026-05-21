---
date: 2026-05-20
domains: [docs, ads]
topics: [google-ads-api, documentation-review, cleanup]
related: []
priority: medium
status: active
---

# Session: 2026-05-20 - Google Ads API Docs Review & Cleanup

## Context
- User asked for review and feedback on `docs/google-ads-api.md`, a freshly researched reference doc
- Reviewed for accuracy, structure, duplication, and project alignment

## Changes Made

Consolidated and cleaned `docs/google-ads-api.md`:

1. **Removed duplicated sections** — Three copies of GAQL/constraints/report-options/common-resources consolidated to one each. Single MCP section instead of two.
2. **Trimmed legacy libraries** — `google-ads-node` and `google-ads-nodejs` reduced from ~100 lines with examples to a 3-row reference table.
3. **Replaced deprecated ETA with RSA** — Expanded Text Ad example replaced with Responsive Search Ad (ETA deprecated June 2022).
4. **Fixed date range inconsistency** — Removed `from_date`/`to_date` examples in favor of `date_range` with both predefined constants and custom `{start, end}` objects.
5. **Added frontmatter** — Library version, API version, last verified date.
6. **Documented env var conventions** — `GOOGLE_ADS_*` prefix matching project's actual `.env.example` and `src/cli.js` usage. Updated all examples to use correct env var names.
7. **Added table of contents** — For the 700+ line doc.
8. **Added Rate Limits & Quotas section** — Google Ads API limits, batch size guidance, exponential backoff pattern.
9. **Added Gotchas section** — Numeric vs string enums, resource name construction, customer ID format, ETA deprecation notice.
10. **Consolidated Resources/Metrics/Segments** — Merged "Available Resources", "Available Metrics", "Common Segments", and "Common Resources" into a single "Resources, Metrics & Segments" section.

## File
- `docs/google-ads-api.md` — 34KB → 31KB, cleaner structure, no duplications
