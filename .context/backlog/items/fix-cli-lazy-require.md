---
title: Fix CLI lazy require — auto-load campaign_analysis at boot
status: active
priority: low
created: 2026-05-21
updated: 2026-05-21
completed: null
related:
  - .context/2026-05-20.campaign-readiness-analysis/plan-ruby-rewrite.md
---

# Fix CLI Lazy Require — Auto-load at Boot

## Description
Move the `require_relative '../lib/buck_ads/campaign_analysis'` from `cmd_analyze_campaign` runtime to a proper autoload/boot-time require.

## Context
- **File**: `exe/buck-ads:306` — `cmd_analyze_campaign` does a runtime `require_relative` for `campaign_analysis.rb`
- **Problem**: If `campaign_analysis.rb` has a load error, it only surfaces when `analyze-campaign` is run, not at CLI startup. Inconsistent with other modules.
- **Fix**: Either add `require 'buck_ads/campaign_analysis'` to `lib/buck_ads.rb`, or add it as a top-level require in `exe/buck-ads`.
- **Risk**: Low — straightforward change. May marginally increase boot time (loading JSON dep) but negligible.

## Notes
- Identified during b-review of the Ruby rewrite (W3)
- Part of the Phase 6 cleanup refinement
