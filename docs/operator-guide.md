# Google Ads Campaign Automation — Operator Guide

Operator's guide for the Google Ads campaign automation tooling. Covers CLI usage, safety invariants, manual pre-flight checklist, and how to extend with new campaign specs.

## Overview

The automation system provides a safe, dry-run-first path to create and verify Google Ads Search campaigns. All live mutations are guarded by safety invariants that block budget changes, bid modifications, and enabled-campaign creation.

**Key principle:** The automation creates paused resources with a provided budget reference. It never infers, creates, or modifies budget or bidding strategy. All campaign creation is dry-run by default.

## CLI Commands

```bash
node src/cli.js <command> [options]
```

### List Campaigns

```bash
node src/cli.js campaigns
```

Outputs a table of all campaigns with cost, clicks, and conversions. Useful for account audit before creating new campaigns.

### Search Terms Report

```bash
node src/cli.js search-terms [--min-cost=X] [--campaign="Name"]
```

Shows search terms that triggered ads, sorted by cost. Flags terms with zero conversions and cost over $0.50 as waste candidates.

```bash
# All terms over $1
node src/cli.js search-terms --min-cost=1

# Terms for a specific campaign
node src/cli.js search-terms --campaign="business-purchase-us"
```

### List Negative Keywords

```bash
node src/cli.js negatives --campaign="Campaign Name"
```

Shows all negative keywords on a campaign.

### Add Negative Keywords

```bash
node src/cli.js add-negatives \
  --campaign="Campaign Name" \
  --keywords="free,gratis,tutorial" \
  --match-type=PHRASE
```

- Commits live to Google Ads immediately (not dry-run).
- Checks for duplicates before adding — skips existing negatives silently.
- `--match-type` defaults to `BROAD`. Use `PHRASE` or `EXACT` for tighter control.

### Plan a Campaign (Dry-Run)

```bash
node src/cli.js plan-campaign --template=qrpro-bofu-us
```

Validates the campaign spec and prints a full change manifest without any live mutations.

**Validates:**
- Spec structure (required keys present)
- RSA headlines ≤ 30 chars, descriptions ≤ 90 chars
- Keywords are EXACT or PHRASE match only
- Final URLs are valid HTTPS

**Outputs:**
- Campaign name and status
- All ad groups with final URLs
- All keywords grouped by match type
- All negative keywords grouped by theme
- RSA asset counts
- Warnings (e.g., RSA underrecommended count)

### Create a Campaign

```bash
# Dry-run (default — safe, no live mutations)
node src/cli.js create-campaign-from-spec --template=qrpro-bofu-us

# Use specs from a custom directory
node src/cli.js create-campaign-from-spec --template=qrpro-bofu-us --specs-dir=/path/to/my/specs

# Live creation (requires budget resource name)
node src/cli.js create-campaign-from-spec \
  --template=qrpro-bofu-us \
  --dry-run=false \
  --budget-resource=customers/123/campaignBudgets/456
```

**Safety gates on live creation:**
1. Campaign status is always PAUSED — ENABLED is blocked
2. Budget creation/modification is blocked
3. Bid or bidding strategy changes are blocked
4. Requires explicit `--budget-resource` for live creation

If `--dry-run=false` without `--budget-resource`, the command refuses with an error.

### Verify an Existing Campaign

```bash
node src/cli.js verify-campaign --campaign="Search | BoFu | Dynamic QR + Analytics | US"
```

Checks an existing campaign against expected settings:

- Campaign exists
- Status is PAUSED
- Channel is SEARCH
- Network is search-only (no Display/content)
- Budget reference is present (read-only check)

Does not modify anything.

## Spec System

Campaign specs are JavaScript modules that define campaign settings, ad groups, keywords, negative keywords, and RSA assets. They live in the `specs/` directory (or a custom directory via `--specs-dir`).

See `specs/README.md` for the spec format, and `specs/qrpro-bofu-us.js` for a complete example.

## Safety Invariants

These are enforced by `runSafetyGuards()` in `src/campaign-builder.js` and cannot be overridden:

| Invariant | What is blocked |
|-----------|-----------------|
| **PAUSED only** | Campaign creation with any status other than PAUSED |
| **No budget** | Any mutation targeting `campaign_budget` entity or `campaignBudgets` resource name |
| **No bidding** | Any mutation with `manual_cpc`, `target_cpa`, `maximize_conversions`, `cpc_bid_micros`, or other bidding fields |
| **EXACT/PHRASE only** | Keyword match types other than EXACT and PHRASE are rejected at validation time |

## Manual Pre-Flight Checklist

Before enabling any campaign, verify the following in Google Ads UI:

- [ ] **Set campaign budget** in Google Ads UI. The automation creates the campaign without a budget — set it manually before enabling.
- [ ] **Verify conversion action** — confirm your purchase conversion action fires correctly. Test a complete purchase.
- [ ] **Check conversion value** — confirm the value is not stuck at `$1` if revenue-based optimization matters for your bidding strategy.
- [ ] **Add micro-conversions** if not present: pricing view, begin checkout, checkout session created. These give Smart Bidding more signal before a purchase happens.
- [ ] **Consider enhanced conversions** for improved signal quality.
- [ ] **Do not broaden match types** until you have 30+ conversions. Broad match without conversion history wastes budget.
- [ ] **Expand geo** only after the initial market shows consistent conversion signal.

## Adding a New Campaign Spec

Create a new spec file in `specs/`:

```javascript
const BASE_URL = 'https://your-site.com';

const campaign = {
  name: 'Campaign Name',
  status: 'PAUSED',
  advertising_channel_type: 'SEARCH',
  network_settings: {
    target_google_search: true,
    target_search_network: false,
    target_content_network: false,
    target_partner_search_network: false,
  },
};

const adGroups = [
  {
    name: 'Ad Group Name',
    final_url: `${BASE_URL}/landing-page`,
    keywords: {
      exact: ['exact keyword'],
      phrase: ['phrase keyword'],
    },
  },
];

const rsa = {
  headlines: ['Headline 1', 'Headline 2', 'Headline 3'],
  descriptions: [
    'Description one (≤ 90 chars).',
    'Description two (≤ 90 chars).',
  ],
};

const negatives = {
  'Theme Name': {
    type: 'PHRASE',
    keywords: ['keyword1', 'keyword2'],
  },
};

module.exports = { campaign, adGroups, rsa, negatives };
```

**Rules for specs:**
- `campaign.status` must be `'PAUSED'`
- All keywords must use `exact:` or `phrase:` keys (no `broad:`)
- All `final_url` values must be HTTPS
- RSA `headlines` must be ≤ 30 chars each
- RSA `descriptions` must be ≤ 90 chars each
- Budget and bidding strategy fields are excluded by design

## Architecture

```
src/
  client.js           Google Ads API client setup, env validation
  campaign-builder.js Validation, safety guards, mutation building, plan/create/verify
  cli.js              CLI entry point, specs directory loader
specs/
  *.js                Campaign spec modules
scripts/
  restructure-*.js    Example restructure scripts
tests/
  campaign-builder.test.js  Jest tests for all guards and validators
```

## Environment Variables

Required in `.env`:

```bash
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_CUSTOMER_ID=XXX-XXX-XXXX
```

Validate with:
```bash
node src/cli.js campaigns
# If you see campaign data, the env is configured correctly
```

## Common Workflows

### 1. Clean up existing campaign waste

```bash
# Get waste candidates
node src/cli.js search-terms --min-cost=0.5 --campaign="Campaign #1"

# Add negatives (after approval)
node src/cli.js add-negatives \
  --campaign="Campaign #1" \
  --keywords="qr code generator,qr,qr code,free,gratis" \
  --match-type=PHRASE
```

### 2. Plan and verify a new campaign spec

```bash
# Validate spec and print manifest
node src/cli.js plan-campaign --template=my-campaign

# Dry-run creation
node src/cli.js create-campaign-from-spec --template=my-campaign

# Check if an existing campaign matches expectations
node src/cli.js verify-campaign \
  --campaign="Search | BoFu | Dynamic QR + Analytics | US"
```

### 3. Create campaign for real

```bash
# 1. Plan first
node src/cli.js plan-campaign --template=my-campaign

# 2. Get budget resource name from Google Ads UI (Settings → Budget)
#    Format: customers/XXX/campaignBudgets/YYY

# 3. Create paused
node src/cli.js create-campaign-from-spec \
  --template=my-campaign \
  --dry-run=false \
  --budget-resource=customers/123/campaignBudgets/456

# 4. Set budget amount in Google Ads UI

# 5. Run pre-flight checklist (above)

# 6. Enable campaign manually in Google Ads UI
```
