---
title: Implement analyze-campaign readiness audit (Ruby rewrite)
status: active
priority: high
created: 2026-05-20
updated: 2026-05-20
completed: null
related:
  - .context/2026-05-20.campaign-readiness-analysis/plan-ruby-rewrite.md
  - .context/2026-05-20.campaign-readiness-analysis/research-campaign-readiness-analysis.md
  - .context/memory/campaign-readiness-plan-2026-05-20.md
---

# Implement analyze-campaign readiness audit (Ruby rewrite)

## Description
Rewrite the entire buck-ads project in Ruby using the officially supported `google-ads-googleads` gem. Port all existing JS commands (campaigns, search-terms, negatives, add-negatives, plan-campaign, create-campaign-from-spec, verify-campaign, analyze-campaign) to Ruby with minitest coverage. Update the skill to reference Ruby commands.

## Context
- Relevant files: `src/cli.js`, `src/client.js`, `src/campaign-analysis.js`, `src/campaign-builder.js`, `enable-keywords.js`, `scripts/add-sitelinks.js`
- Requirements: Feature parity with JS implementation, TDD with minitest, official Ruby SDK
- Technical notes: Ruby gem API surface differs from JS `google-ads-api` — study examples first
- Related work: See `.context/2026-05-20.campaign-readiness-analysis/plan-ruby-rewrite.md`
