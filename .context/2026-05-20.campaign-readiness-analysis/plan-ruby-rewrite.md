---
status: active
date: 2026-05-20
subject: 2026-05-20.campaign-readiness-analysis
topics: [google-ads, campaign-analysis, readiness-audit, ruby, rewrite, google-ads-ruby]
research: [research-campaign-readiness-analysis.md]
spec:
memory:
  - campaign-readiness-plan-2026-05-20.md
  - campaign-readiness-analysis-2026-05-20.md
  - ruby-rewrite-phases-1-2-5-2026-05-20.md
  - phase6-skill-update-cleanup-2026-05-21.md
  - review-iterate-session-2026-05-21.md
---

# Plan: Ruby Rewrite — Campaign Readiness Analysis

## Goal

Rewrite the entire buck-ads project in Ruby using the officially supported [`google-ads-ruby`](https://github.com/googleads/google-ads-ruby) gem. The existing Node.js implementation (`src/cli.js`, `src/client.js`, `src/campaign-analysis.js`, `src/campaign-builder.js`, `enable-keywords.js`, `scripts/add-sitelinks.js`) is complete but will be replaced. All future work targets Ruby.

## Context used / assumptions

- User direction: move to officially supported Ruby SDK; replace all custom JS code.
- AGENTS.md states: "Prefer Ruby and the officially supported ruby sdk from google… All future work should be written in ruby."
- Existing JS implementation is **feature-complete** (campaigns, search-terms, negatives, add-negatives, plan-campaign, create-campaign-from-spec, verify-campaign, analyze-campaign) — it serves as the **behavioral spec** for the Ruby rewrite.
- The `google-ads-ruby` gem: `gem install google-ads-googleads` — see [examples](https://github.com/googleads/google-ads-ruby/tree/HEAD/examples).
- Research artifacts from this subject folder are still valid — the seven analysis dimensions, GAQL queries, and deterministic check logic carry over.
- TDD with minitest is required (per AGENTS.md).
- The existing skill (`skills/google-ads-high-converting/SKILL.md`) must be updated to reference Ruby commands instead of `node src/cli.js`.

## Scope

### What's being rewritten

Every JS file in the project:

| JS file (current) | Ruby replacement (new) | Purpose |
|---|---|---|
| `src/client.js` | `lib/buck_ads/client.rb` | API client setup, env validation |
| `src/cli.js` | `exe/buck-ads` or `lib/buck_ads/cli.rb` | CLI entry point and command dispatch |
| `src/campaign-analysis.js` | `lib/buck_ads/campaign_analysis.rb` | GAQL query builders, normalizers, deterministic checks, report formatting |
| `src/campaign-builder.js` | `lib/buck_ads/campaign_builder.rb` | Campaign planning, validation, creation from specs |
| `enable-keywords.js` | `lib/buck_ads/keyword_manager.rb` | Keyword enabling and management |
| `scripts/add-sitelinks.js` | `lib/buck_ads/sitelink_manager.rb` | Sitelink creation |
| `tests/campaign-analysis.test.js` | `test/test_campaign_analysis.rb` | Minitest tests |
| `tests/campaign-builder.test.js` | `test/test_campaign_builder.rb` | Minitest tests |

### Commands to port

1. `campaigns` — List campaigns with metrics
2. `search-terms` — Search term report with waste detection
3. `negatives` — List negative keywords for a campaign
4. `add-negatives` — Add negative keywords to a campaign
5. `plan-campaign` — Validate and plan from a campaign spec
6. `create-campaign-from-spec` — Create campaign (dry-run by default)
7. `verify-campaign` — Verify campaign settings
8. `analyze-campaign` — **Primary focus** — full readiness analysis with deterministic checks

### Skill update

- Update `skills/google-ads-high-converting/SKILL.md` to reference Ruby CLI commands
- Update `~/.pi/agent/skills/google-ads/SKILL.md` if it references `node src/cli.js`

## Out of scope

- New features beyond what exists in JS (feature parity only)
- Removing JS files (keep them until Ruby rewrite is verified live, then archive)
- Changing the report schema — carry the same JSON/text output format
- Model/LLM integration in the CLI — keep CLI data-only
- UI/dashboard work

## Affected files

### New Ruby project structure

```
buck-ads/
├── Gemfile                              # NEW — ruby dependency management
├── lib/
│   └── buck_ads/
│       ├── client.rb                    # API client (replaces src/client.js)
│       ├── cli.rb                       # CLI parser and dispatch (replaces src/cli.js)
│       ├── campaign_analysis.rb         # Readiness analysis (replaces src/campaign-analysis.js)
│       ├── campaign_builder.rb          # Campaign planning/creation (replaces src/campaign-builder.js)
│       ├── keyword_manager.rb           # Keyword operations (replaces enable-keywords.js)
│       └── sitelink_manager.rb          # Sitelink operations (replaces scripts/add-sitelinks.js)
├── exe/
│   └── buck-ads                         # CLI executable
├── test/
│   ├── test_helper.rb                   # Shared minitest setup
│   ├── test_client.rb
│   ├── test_campaign_analysis.rb        # (replaces tests/campaign-analysis.test.js)
│   ├── test_campaign_builder.rb         # (replaces tests/campaign-builder.test.js)
│   ├── test_keyword_manager.rb
│   └── test_sitelink_manager.rb
├── specs/                               # Campaign spec definitions (ported to Ruby)
└── skills/
    └── google-ads-high-converting/
        └── SKILL.md                     # UPDATED — Ruby command references
```

### Existing JS files (kept for reference, removed after verification)

- `src/cli.js`, `src/client.js`, `src/campaign-analysis.js`, `src/campaign-builder.js`
- `enable-keywords.js`, `scripts/add-sitelinks.js`
- `tests/campaign-analysis.test.js`, `tests/campaign-builder.test.js`
- `package.json` — kept until Ruby rewrite is verified

## Implementation steps

### Phase 1: Ruby project scaffold + client

1. **Create `Gemfile`**
   - Add `google-ads-googleads` gem
   - Add `minitest` for testing
   - Add `dotenv` for `.env` loading
   - Reference: https://github.com/googleads/google-ads-ruby

2. **Create `lib/buck_ads/client.rb`**
   - Port `src/client.js` behavior: validate env vars, configure `Google::Ads::GoogleAds::GoogleAdsClient`
   - Read credentials from `.env` (same env var names: `GOOGLE_ADS_CLIENT_ID`, etc.)
   - Provide `#customer` method that returns a configured service client
   - **Test first**: `test/test_client.rb` — env validation, customer creation

3. **Create `exe/buck-ads` executable**
   - Basic CLI framework with argument parsing
   - Wire `buck-ads campaigns` as the first working command

4. **Verify live**: Run `bundle exec buck-ads campaigns` against real account

### Phase 2: Core read commands

5. **Port `campaigns` command**
   - Use `Google::Ads::GoogleAds::Service.lookup(:campaign_service)` or GAQL via `GoogleAdsClient.service.google_ads.search`
   - **Test first**: fixture-based tests for formatting

6. **Port `search-terms` command**
   - GAQL query + waste detection logic
   - **Test first**: normalization and waste detection tests

7. **Port `negatives` command**
   - Campaign-level negative keyword listing
   - **Test first**: query building, filtering

### Phase 3: Write commands

8. **Port `add-negatives` command**
   - Use `CampaignCriterionService.mutate_campaign_criteria` for creation
   - Duplicate detection (same as JS)
   - **Test first**: operation building, duplicate filtering

9. **Port `enable-keywords` functionality** into `lib/buck_ads/keyword_manager.rb`
   - Replace the `enable-keywords.js` standalone script
   - Use `AdGroupCriterionService.mutate_ad_group_criteria` for updates
   - Key learning from JS: must use the typed service, not generic mutate
   - **Test first**: operation building

10. **Port `scripts/add-sitelinks.js`** into `lib/buck_ads/sitelink_manager.rb`
    - Asset creation + campaign asset linking
    - **Test first**: operation building

### Phase 4: Campaign builder

11. **Port `src/campaign-builder.js`** to `lib/buck_ads/campaign_builder.rb`
    - Spec validation, campaign planning, dry-run creation
    - Port `specs/` from JS to Ruby format
    - **Test first**: spec validation, plan generation

12. **Port `verify-campaign` command**
    - Simplified readiness check (subset of analyze-campaign)

### Phase 5: Campaign readiness analysis (primary deliverable)

13. **Port `src/campaign-analysis.js`** to `lib/buck_ads/campaign_analysis.rb`
    - GAQL query builders for all 7 dimensions
    - Normalizers (campaign, ad_groups, keywords, ads, sitelinks, assets, negatives, conversion_actions)
    - Deterministic checks (PASS/WARNING/FAIL)
    - Text and JSON formatters
    - **Test first**: port all existing Jest test fixtures to minitest
    - This is the most complete module in JS — port all 13 deterministic checks + report building

14. **Wire `analyze-campaign` command**
    - `buck-ads analyze-campaign --campaign="Name" [--format=json|text] [--date-range=LAST_30_DAYS]`

### Phase 6: Skill update + cleanup

15. **Update `skills/google-ads-high-converting/SKILL.md`**
    - Replace all `node src/cli.js` references with `buck-ads` or `bundle exec buck-ads`
    - Update workflow examples to use Ruby commands
    - Keep the methodology content (intent tiers, RSA strategy, etc.) unchanged

16. **Update `~/.pi/agent/skills/google-ads/SKILL.md`**
    - Update CLI command references if they mention `node src/cli.js`

17. **Live verification against `business-purchase-us`**
    - Run every command against the real campaign
    - Compare output with JS version for correctness
    - Capture any API differences between `google-ads-api` (Node) and `google-ads-googleads` (Ruby)

18. **Archive JS files**
    - Move `src/`, `tests/`, `scripts/`, `enable-keywords.js` to `archive/js/`
    - Remove `node_modules/`, `package.json` dependencies
    - Keep `package.json` for pi-package metadata only if needed

## Verification

### Per-command verification
```bash
# All commands must work identically to the JS version:
bundle exec buck-ads campaigns
bundle exec buck-ads search-terms --min-cost=0
bundle exec buck-ads negatives --campaign="business-purchase-us"
bundle exec buck-ads add-negatives --campaign="business-purchase-us" --keywords="test" --dry-run
bundle exec buck-ads verify-campaign --campaign="business-purchase-us"
bundle exec buck-ads analyze-campaign --campaign="business-purchase-us" --format=text
bundle exec buck-ads analyze-campaign --campaign="business-purchase-us" --format=json
```

### Test suite
```bash
bundle exec rake test          # All minitest tests pass
```

### Cross-check
- Compare Ruby `analyze-campaign --format=json` output with JS `analyze-campaign --format=json` output
- Same campaign, same date range — should produce equivalent normalized data and findings

## Risks

- **google-ads-ruby gem API surface** — the Ruby gem uses protobuf-based service objects, not the fluent JS API. Query patterns will differ significantly. Study examples at https://github.com/googleads/google-ads-ruby/tree/HEAD/examples first.
- **GAQL support** — GAQL queries should work identically via `service.search`, but field names in returned objects may differ (protobuf vs JS convenience wrappers).
- **Numeric enum mapping** — JS returned numeric enums (3=PAUSED); Ruby may return symbols or strings. Normalizers must handle both.
- **Environment variable naming** — the Ruby gem uses `GOOGLE_ADS_CONFIG` or individual env vars. Must confirm the mapping matches our `.env` convention.
- **Campaign spec format** — JS specs are `.js` files returning objects; Ruby specs can be `.rb` files or `.yaml`/`.json`. Need to decide format.
- **Ruby gem installation** — may require native extensions. Bundler should handle this, but Arch Linux may need additional dev packages.

## Recommended next step

Use `/b-build-hard` with this plan, starting at Phase 1. The Ruby gem API surface is unfamiliar enough to justify iterative development with live verification at each phase boundary.
