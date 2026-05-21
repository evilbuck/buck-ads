# Tasks: Campaign Readiness Analysis (Ruby Rewrite)

**Created**: 2026-05-20
**Status**: in-progress

## Tasks

### Phase 1: Ruby project scaffold + client
- [x] Create `Gemfile` with `google-ads-googleads`, `minitest`, `dotenv`
- [x] Create `lib/buck_ads/client.rb` — API client setup, env validation
- [x] Create `exe/buck-ads` executable with basic CLI framework
- [x] Write `test/test_client.rb` — env validation, customer creation
- [x] Verify live: `bundle exec buck-ads campaigns`

### Phase 2: Core read commands
- [x] Port `campaigns` command (list campaigns with metrics)
- [x] Port `search-terms` command (search term report + waste detection)
- [x] Port `negatives` command (list negative keywords)

### Phase 3: Write commands
- [ ] Port `add-negatives` command (create negative keywords with dedup)
- [ ] Port `enable-keywords` into `lib/buck_ads/keyword_manager.rb`
- [ ] Port `add-sitelinks` into `lib/buck_ads/sitelink_manager.rb`

### Phase 4: Campaign builder
- [ ] Port `campaign-builder` to Ruby (spec validation, planning, creation)
- [ ] Port `verify-campaign` command

### Phase 5: Campaign readiness analysis (primary deliverable)
- [x] Port GAQL query builders for all 7 dimensions to `lib/buck_ads/campaign_analysis.rb`
- [x] Port normalizers (campaign, ad_groups, keywords, ads, sitelinks, assets, negatives, conversions)
- [x] Port all 13 deterministic checks (PASS/WARNING/FAIL)
- [x] Port text and JSON formatters
- [x] Port all Jest test fixtures to minitest `test/test_campaign_analysis.rb`
- [x] Wire `analyze-campaign` CLI command

### Phase 6: Skill update + cleanup
- [x] Update `skills/google-ads-high-converting/SKILL.md` — replace `node src/cli.js` references
- [x] Update `~/.pi/agent/skills/google-ads/SKILL.md` — update CLI references
- [x] Live verification against `business-purchase-us` (all commands)
- [x] Archive JS files (`src/`, `tests/`, `scripts/`)

## Notes
- Phase 3 partially done: `add-negatives` is wired in CLI but not extracted to a separate module
- `enable-keywords` and `add-sitelinks` still JS-only
- See: `.context/2026-05-20.campaign-readiness-analysis/plan-ruby-rewrite.md`
