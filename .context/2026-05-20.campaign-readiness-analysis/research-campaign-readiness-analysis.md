---
status: active
date: 2026-05-20
subject: 2026-05-20.campaign-readiness-analysis
topics: [google-ads, campaign-analysis, readiness-audit, sitelinks, rsa, keywords, ad-groups, assets, conversion-tracking, skill-design]
informs: []
---

# Research: Campaign Readiness Analysis Tool Design

## Summary

This research defines the complete architecture for a Google Ads campaign readiness analysis tool. It covers what data to gather, how to analyze it, what to pass to the model, and how to structure the output. The approach is **hybrid**: a CLI command gathers structured data from the Google Ads API, then a skill (or model prompt) analyzes the data against defined criteria to produce a readiness score and actionable recommendations.

## Key Findings

### 1. Seven Analysis Dimensions

A complete campaign readiness audit covers seven weighted dimensions:

| # | Dimension | Weight | Source Resources |
|---|-----------|--------|------------------|
| 1 | **Sitelinks** | 15% | `campaign_asset` (SITELINK), `asset` |
| 2 | **Ad Groups** | 20% | `ad_group`, `ad_group_criterion`, `ad_group_ad` |
| 3 | **Ad Quality (RSA)** | 20% | `ad_group_ad` with RSA fields, `ad_group_ad.ad_strength`, `ad_group_ad.policy_summary` |
| 4 | **Keywords** | 20% | `ad_group_criterion` with keyword fields, quality_score |
| 5 | **Assets** | 10% | `campaign_asset` (CALLOUT, SNIPPET, etc.) |
| 6 | **Campaign Settings** | 10% | `campaign` with status, network, bidding |
| 7 | **Conversion Tracking** | 5% | `conversion_action` with status, category |

### 2. Data Gathering Requires 6-8 API Queries

All data is available through the MCP `google_ads_mcp_search` tool (read-only). The queries:

1. **Campaign basics** — status, channel, network, optimization_score, serving_status, bidding
2. **Ad groups** — name, status, per-group metrics
3. **Keywords** — text, match_type, status, quality_score per ad group
4. **Ads** — RSA content, status, ad_strength, policy_status per ad group
5. **Sitelinks** — title, URLs, descriptions, status, performance
6. **Other assets** — callouts, snippets, etc.
7. **Negative keywords** — text, match_type at campaign level
8. **Conversion actions** — name, status, category, counting_type

### 3. Analysis Requires Model Judgment + Rules

Some checks are deterministic (pass/fail), others require model evaluation:

**Deterministic checks** (can be coded):
- Ad group status = ENABLED?
- Keywords exist and are ENABLED?
- RSA has ≥ 3 headlines and ≥ 2 descriptions?
- Sitelinks exist (≥ 2)?
- Campaign is not PAUSED?
- Conversion actions configured?

**Model-judgment checks** (need LLM):
- Are sitelinks "high converting" (relevant, compelling, distinct pages)?
- Is keyword coverage adequate for the intent themes?
- Are RSA headlines varied in messaging type?
- Are ad groups logically themed?
- Overall readiness assessment

### 4. Recommended Implementation: Hybrid CLI + Skill

**CLI command**: `node src/cli.js analyze-campaign --campaign="name"`
- Gathers all data from API into structured JSON
- Runs deterministic checks automatically
- Outputs structured JSON with raw data + deterministic pass/fail results

**Skill/Analysis layer**: Uses the model to evaluate subjective criteria
- Reads the CLI's JSON output
- Applies analysis guidelines (from this research)
- Produces a readiness score (0-100) and deployment status (READY / NEEDS WORK / NOT READY)
- Outputs prioritized action items

### 5. Existing Tooling Can Be Extended

The existing `src/cli.js` already has:
- Campaign listing and querying
- Search term analysis
- Negative keyword management
- Campaign verification (`verify-campaign`)

The `verify-campaign` command is the closest existing analog — it checks campaign existence, paused status, search-only channel, and network settings. The new `analyze-campaign` command should be a superset.

### 6. MCP Query Constraints

From the google-ads skill (v4):
- `conditions` and `orderings` must be string arrays, not objects
- `fields` must be valid GAQL field names (check metadata first)
- No `*` in SELECT clause
- Some fields cause `UNRECOGNIZED_FIELD` errors (stick to known-working fields)
- `campaign_asset` is the correct resource for sitelinks/asset querying (not `extension_feed_item` which is invalid)

## Recommendations

### Phase 1: Data Gathering CLI
1. Add `analyze-campaign` command to `src/cli.js`
2. Takes `--campaign="name"` and optional `--format=json|text` (default: text)
3. Runs 6-8 API queries via the existing client
4. Outputs structured JSON with all raw data + deterministic checks
5. For text format, outputs a human-readable summary

### Phase 2: Analysis Skill
1. Create a new skill or extend `google-ads` skill with analysis guidelines
2. Include the model prompting template
3. Define evaluation criteria per dimension
4. Include scoring rubric (PASS/FAIL/WARNING with weights)

### Phase 3: Integration
1. Wire CLI output → skill analysis
2. Test against the `business-purchase-us` campaign
3. Iterate on analysis criteria based on real results

## Open Questions

- **Should analysis be a single CLI command or multi-step?** Single command preferred for simplicity, but may need pagination for large campaigns.
- **Should the CLI include model API calls?** No — keep CLI data-only, let the agent/skill handle analysis via prompting.
- **Should we create a standalone script instead of extending cli.js?** Could go either way. Extending cli.js is cleaner since it shares the client infrastructure.
- **How to handle campaigns with many ad groups?** May need to limit queries or paginate. Default limit of 500 results per query should cover most campaigns.

## Sources Consulted

- Google Ads API resource metadata (via MCP `get_resource_metadata` for campaign, ad_group, ad_group_ad)
- Google Ads API documentation on asset querying (developers.google.com/google-ads/api/docs/assets/fetching-assets)
- Google Ads Help on sitelink assets and asset best practices
- Optimyzee 2026 Google Ads Audit Checklist
- WonderAds Campaign Launch Checklist
- Existing skill: `~/.pi/agent/skills/google-ads/SKILL.md` (v4)
- Existing codebase: `src/cli.js`, `src/campaign-builder.js`, `scripts/add-sitelinks.js`
