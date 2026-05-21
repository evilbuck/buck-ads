---
date: 2026-05-20
domains: [tooling, ads]
topics: [google-ads, keywords, enable-keywords, mcp, ad-group-criterion, mutation-api]
subject: 2026-05-20.google-ads-keyword-audit
artifacts: [enable-keywords.js]
related: [pi-package-setup-2026-05-20.md]
priority: high
status: active
---

# Session: 2026-05-20 - Google Ads Keyword Audit & Enable

## Context
- Previous work: Pi package setup for buck-ads
- Goal: Audit ad groups for missing keywords; enable paused keywords in business-purchase-us campaign

## Decisions Made
- Used MCP `google_ads_mcp_search` for read-only queries (ad groups, keywords, status)
- Built standalone `enable-keywords.js` script for the mutation since CLI had no enable command
- Discovered `customer.mutateResources()` does NOT work for ad_group_criterion UPDATES — must use `customer.adGroupCriteria.update()` with typed `resources.AdGroupCriterion` instances
- Updated `google-ads` skill (v3 → v4) with new mutation patterns, enable-keywords command, and keyword audit workflow

## Implementation Notes
- Key files created: `enable-keywords.js`
- Key files modified: `~/.pi/agent/skills/google-ads/SKILL.md` (v3→v4)
- Campaign: `business-purchase-us` (ID: 23825732817)
- Customer ID: 2081039078
- **76 paused keywords enabled** across 6 ad groups:
  - Business / Marketing QR Codes (14)
  - Dynamic / Editable QR Codes (15)
  - Split Testing / A/B Testing QR (11)
  - Competitor Alternatives (15)
  - Bulk / Batch QR Codes (10)
  - QR Analytics / Tracking (12)
- 1 keyword ("qr code marketing") was enabled during testing before the batch run
- `small business focused` ad group already had all keywords enabled (33)
- Both campaigns have 0 conversions — negative keyword audit recommended

## API Learnings
- `google-ads-api` library: `mutateResources()` fails for UPDATES with "field cannot be cleared" / "resource name missing"
- Correct pattern: `new resources.AdGroupCriterion({status: enums.AdGroupCriterionStatus.ENABLED})` + set `resource_name` + `customer.adGroupCriteria.update([criterion])`
- Query results return numeric status enums (3=PAUSED), GAQL WHERE uses string names (status = PAUSED)
- MCP search tool is read-only — all writes go through CLI or standalone scripts
- MCP `conditions` and `orderings` must be string arrays, not object arrays

## Next Steps
- [ ] Run search terms audit to find negative keyword opportunities (0 conversions across both campaigns)
- [ ] Consider pausing Campaign #1 (generic, $52 spent, 0 conversions) to focus budget on business-purchase-us
- [ ] Monitor keyword performance after enabling
