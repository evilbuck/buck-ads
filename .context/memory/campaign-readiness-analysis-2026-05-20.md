---
date: 2026-05-20
domains: [ads, research]
topics: [google-ads, campaign-analysis, readiness-audit, sitelinks, rsa, keywords, assets, skill-design]
subject: 2026-05-20.campaign-readiness-analysis
artifacts: [research-campaign-readiness-analysis.md, research/notes-api-capabilities.md, research/notes-analysis-guidelines.md, index.md]
related: [google-ads-keyword-audit-2026-05-20.md]
priority: high
status: active
---

# Session: 2026-05-20 - Campaign Readiness Analysis Research

## Context
- Previous work: Keyword audit and enable for business-purchase-us campaign
- Goal: Design complete campaign readiness/deployment analysis tooling

## Decisions Made
- **Hybrid approach**: CLI gathers data, skill/model analyzes it
- **Seven analysis dimensions** with weighted scoring: Sitelinks (15%), Ad Groups (20%), Ad Quality/RSA (20%), Keywords (20%), Assets (10%), Campaign Settings (10%), Conversion Tracking (5%)
- **Two-layer analysis**: Deterministic checks (pass/fail) in code, subjective analysis via model prompting
- **Extend existing CLI** rather than creating standalone script — shares client infrastructure
- **Output format**: Structured JSON from CLI + formatted text report from analysis

## Implementation Notes
- Key artifacts: `research-campaign-readiness-analysis.md` (canonical summary), `research/notes-api-capabilities.md`, `research/notes-analysis-guidelines.md`
- API queries needed: 6-8 MCP search queries per campaign
- `campaign_asset` is the correct resource for sitelinks (NOT `extension_feed_item`)
- `ad_group_ad.ad_strength` field provides Google's own RSA quality rating
- `ad_group_criterion.quality_info.quality_score` available for keyword quality
- `conversion_action` resource available for conversion tracking audit

## Next Steps
- [ ] Run `/b-plan` to create implementation plan for `analyze-campaign` CLI command
- [ ] Extend `src/cli.js` with `analyze-campaign` command
- [ ] Create/update skill with analysis prompting template
- [ ] Test against `business-purchase-us` campaign
- [ ] Consider creating `google-ads-analyzer` skill or extending existing `google-ads` skill
