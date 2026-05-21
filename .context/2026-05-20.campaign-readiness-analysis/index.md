# Campaign Readiness Analysis

**Created**: 2026-05-20
**Status**: active

## Purpose
Research and design a complete campaign readiness/deployment analysis tool for Google Ads.

## Artifacts
- `research/notes-api-capabilities.md` — API resource inventory for each analysis dimension
- `research/notes-analysis-guidelines.md` — Analysis best practices and model prompting strategy
- `research-campaign-readiness-analysis.md` — Canonical synthesized research summary
- `plan-analyze-campaign.md` — **SUPERSEDED** — Original Node.js implementation plan
- `plan-ruby-rewrite.md` — **CURRENT** — Full Ruby rewrite plan replacing all JS code
- `tasks.md` — Subject-local progress tracker

## Context
- Task: Rewrite entire buck-ads project in Ruby using the officially supported `google-ads-googleads` gem
- Existing JS tooling: `src/cli.js`, `src/campaign-analysis.js`, `src/campaign-builder.js`, `enable-keywords.js`, `scripts/add-sitelinks.js`
- MCP: `google_ads_mcp_search` (read-only), CLI for writes
- Skill: `google-ads` (v4) in `~/.pi/agent/skills/google-ads/SKILL.md`
- Current plan: `plan-ruby-rewrite.md`
