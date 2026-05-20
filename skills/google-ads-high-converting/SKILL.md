---
name: google-ads-high-converting
description: "Build high-converting Google Ads Search campaigns. Covers campaign diagnosis, keyword research by intent tier, negative keyword categorization, RSA ad copy strategies, and live campaign restructure via the Google Ads API. Use when asked to create, optimize, or restructure a Google Ads campaign for conversion performance, research keywords, audit an underperforming campaign, or build ad copy that converts."
version: 1
created: 2026-05-19
updated: 2026-05-19
---

# High-Converting Google Ads Campaign Builder

## Overview

A methodology and pattern library for building Google Ads Search campaigns that actually convert — not just burn spend on broad-match waste. Based on a real campaign restructure that went from 205 clicks / $56 spend / 0 conversions → 6 intent-segmented ad groups / 77 exact+phrase keywords / 69 negatives / differentiated RSA copy.

This skill covers the full lifecycle: diagnose → research → structure → execute.

---

## Phase 1: Campaign Diagnosis

### Diagnostic Checklist

Before touching any keywords, run these queries:

```bash
# 1. List campaigns — check spend, clicks, conversions
node src/cli.js campaigns

# 2. Search terms report — see what's actually triggering
node src/cli.js search-terms --min-cost=0

# 3. Check negatives coverage
node src/cli.js negatives --campaign="Campaign Name"

# 4. Pull full ad group/keyword structure (see Phase 5 for API pattern)
```

### 5 Root Causes of Zero Conversions

| # | Symptom | Root Cause | Fix |
|---|---------|------------|-----|
| 1 | All keywords are BROAD match | Default setting traps the unaware | Replace with EXACT + PHRASE only |
| 2 | Keywords are too generic | No purchase intent filtering | Categorize by intent tier (below) |
| 3 | Ad copy is weak | No differentiator, no pricing hook, no urgency | Lead with unique differentiator + pricing pressure |
| 4 | Single ad group, single ad | No segmentation by intent level | 5-6 ad groups segmented by buyer stage |
| 5 | No conversion tracking verified | Conversion action not firing | Verify purchase event fires before spending |

### Red-Flag Search Terms (Immediate Negatives)

Any search term matching these patterns → add as negative:
- **Bare product name** (e.g., "qr code") — 0 intent, pure browse
- **Typos/misspellings** (e.g., "dr code generator")
- **Non-English queries** (e.g., "cod qr", "codigo qr")
- **Competitor brand names you don't want** (e.g., "me qr")
- **Free/DYI intent** (e.g., "create qr code", "text to qr")

---

## Phase 2: Keyword Research by Intent Tier

### The 4-Tier System

Classify every keyword into one of four tiers. Only Tier 1-3 should be in your initial campaign.

#### Tier 1: Purchase-Ready (BoFu) — EXACT match
Searchers who know what they want and are comparing/ready to buy.

**Characteristics:**
- Contains product-specific terms: "software", "platform", "tool", "generator"
- Contains feature qualifiers: "dynamic", "trackable", "editable", "branded"
- Contains business qualifiers: "for business", "marketing", "professional"

**Match type:** EXACT only — you can't afford to broaden here
**CPC ceiling:** $1.50–3.50 (highest, but also highest conversion rate)

#### Tier 2: Problem-Aware (MoFu) — PHRASE match
Searchers who know they have a problem but are still defining the solution.

**Characteristics:**
- Describes the problem: "track qr code scans", "change qr code destination"
- Describes the solution generically: "qr code with analytics"
- May include "how to" phrasing (exclude if it's "how to make a qr code" — that's free intent)

**Match type:** PHRASE — balances reach with control
**CPC ceiling:** $0.75–1.50

#### Tier 3: Competitor Alternatives — EXACT match
Searchers already in-market, evaluating tools. Highest conversion potential per click.

**Characteristics:**
- Contains competitor name + "alternative" or "vs"
- Contains "cheaper than [competitor]"
- Contains "best [category] for [use case]"

**Match type:** EXACT — tight targeting
**CPC ceiling:** $0.50–1.50
**Landing page:** Should acknowledge the comparison (pricing page or feature comparison)

#### Tier 4: Unique Differentiator — EXACT + PHRASE
Keywords around a feature or capability that ONLY your product offers. Low competition, high conversion potential.

**How to identify:**
- What does your product do that no major competitor does?
- What feature do your best customers cite as the reason they chose you?
- What capability would make a competitor user switch?

**Match type:** EXACT for highest-intent, PHRASE for discovery
**CPC ceiling:** $0.50–1.25 (low competition = lower CPC)
**Landing page:** Dedicated feature page with pain vs solution framing

### Market Context Template

Always research the competitive landscape before building keywords:

```
- Top competitor domains (for competitor keyword mining)
- Competitor pricing tiers (for pricing-pressure ad copy)
- Market search volume trends (Google Trends / SEMrush)
- Industry CPC benchmarks (cross-industry avg ~$4.22; SaaS $2.80-7.50)
```

### Pro Tip: The "Differentiator Audit"

Ask: "What search query would someone type if they specifically wanted what ONLY our product does?"

For QRPro: "qr code split testing" — QR Tiger doesn't do it. Bitly doesn't do it. Beaconstac doesn't do it. This keyword has near-zero competition and signals someone who specifically needs QRPro's unique capability.

Do this for your product before writing a single keyword.

---

## Phase 3: Negative Keywords — The 8 Categories

Negative keywords prevent your ad from showing on irrelevant searches. This is THE highest-ROI optimization you can make (every dollar saved on bad clicks is pure profit margin).

### Category System

| # | Category | Examples | Match Type |
|---|----------|----------|------------|
| 1 | **Free/DIY Intent** | free, gratis, template, tutorial, how to*, what is, definition, sample, create qr code | PHRASE |
| 2 | **Wrong Product** | scanner, reader, barcode, bar code, qr scanner app | PHRASE |
| 3 | **Platform Specific** | spotify qr, whatsapp qr, vcard qr, wifi qr code, instagram qr | PHRASE |
| 4 | **Format/Technical** | svg qr code, png qr code, qr code api, qr code javascript, qr code python, open source | PHRASE |
| 5 | **Non-English Leakage** | codigo, crear, creador, generador, gerador, criar, gerar, leer | PHRASE |
| 6 | **Personal/Irrelevant** | birthday, wedding, invitation, wechat, korean, arabic | PHRASE |
| 7 | **Tool/Platform Noise** | specific free tool names, test_keyword artifacts | PHRASE |
| 8 | **Overly Generic** | the bare product name with no qualifier (e.g., "qr code", "qr codes", "qr") | EXACT |

*Exception: "how to track qr code performance" is valid commercial intent. Distinguish by checking whether the "how to" phrase describes a problem your product solves vs a DIY alternative.

### Priority Order for New Campaigns

1. **Overly Generic** (Category 8) — kills the #1 waste source immediately
2. **Free/DIY Intent** (Category 1) — protects budget from non-buyers
3. **Wrong Product** (Category 2) — relevancy → Quality Score
4. **Non-English** (Category 5) — if targeting English-only
5. **Everything else** — as search term data reveals new waste

### Live Search Term Waste → Negatives Pipeline

```bash
# 1. Pull search terms sorted by cost
node src/cli.js search-terms --min-cost=0.20

# 2. For each term with cost > $0.50 and 0 conversions → assess category
# 3. Add as negative (skips duplicates automatically)
node src/cli.js add-negatives \
  --campaign="Campaign Name" \
  --keywords="kw1,kw2,kw3" \
  --match-type=PHRASE
```

---

## Phase 4: RSA Ad Copy Strategy

### Headline Rules (≤30 chars each)

1. **Lead with the differentiator** — first 2-3 headlines should sell what ONLY you do
2. **Include pricing pressure** — if you're cheaper than competitors, say so
3. **Mix benefits with features** — "Track Every Scan" (benefit) + "Dynamic QR Platform" (feature)
4. **Include a trust signal** — "Free for 5 QR Codes", "Cancel Anytime"
5. **Use 10-15 headlines** — Google combines them; more variety = more combinations

### Description Rules (≤90 chars each)

1. **Primary description** — the differentiator in sentence form
2. **Feature + pricing** — what you get + how much (with trust signal "Cancel anytime")
3. **Pain → Solution** — name the pain, then show how you solve it
4. **Competitive comparison** — if you're cheaper, show the math
5. **Use 3-5 descriptions** — 4-5 recommended for RSA pinning flexibility

### Differentiator-Led Copy Template

```
Headlines:
  - [Differentiator Hook]           (e.g., "Split Test QR Codes")
  - [Differentiator Hook #2]        (e.g., "A/B Test QR Destinations")
  - [Unique Outcome]                (e.g., "Print Once. Test Forever.")
  - [Primary Feature]               (e.g., "Edit QR After Printing")
  - [Pricing Pressure]              (e.g., "Save 72% vs [Competitor]")
  - [Trust Signal]                  (e.g., "Free for 5 QR Codes")
  - [Benefit]                       (e.g., "Track Every Scan")
  - [Benefit #2]                    (e.g., "Track Print ROI")
  - [Feature #2]                    (e.g., "Dynamic QR Platform")
  - [Feature #3]                    (e.g., "Bulk QR Code Generator")

Descriptions:
  - [Differentiator + outcome]. No [pain point]. 
  - [Features list], [pricing]. [Trust signal].
  - [Pain question]. [How you solve it].
  - [Pricing comparison]. [Same/different features]. [Savings %]. [Trust signal].
```

### Pricing-Pressure Pattern

If your product is significantly cheaper than a well-known competitor:

> "[Your Brand] Pro is $X/mo. [Competitor] starts at $Y/mo. Same [category] codes, [Y-X]% less. Cancel anytime."

Rules:
- Use specific dollar amounts, not vague "save money"
- Name the competitor (creates comparison frame)
- State the savings percentage (concrete > vague)
- End with trust signal ("Cancel anytime", "Free to start")

### Character Limit Enforcement

Always validate before deploying:
```javascript
for (const h of headlines) {
  if (h.length > 30) console.error(`Headline too long (${h.length}): ${h}`);
}
for (const d of descriptions) {
  if (d.length > 90) console.error(`Description too long (${d.length}): ${d}`);
}
```

---

## Phase 5: Campaign Structure Blueprint

### Ad Group Segmentation

**Rule:** One ad group = one purchase intent cluster. Do not mix intent levels within an ad group.

**Minimum viable structure (5-6 ad groups):**

| Ad Group | Intent Cluster | Match | Landing Page |
|----------|---------------|-------|--------------|
| Primary Feature A | Buyers wanting YOUR main feature | EXACT + PHRASE | Dedicated feature page |
| Primary Feature B | Buyers wanting YOUR secondary feature | EXACT + PHRASE | Dedicated feature page |
| **Differentiator** | Buyers wanting what ONLY YOU do | EXACT + PHRASE | Dedicated differentiator page |
| Business/Professional | Business buyers | EXACT + PHRASE | Business landing page |
| Competitor Alternatives | In-market comparison shoppers | EXACT + PHRASE | Pricing or comparison page |
| Bulk/Volume | Volume buyers (higher LTV) | EXACT + PHRASE | Pricing page |

**Why this works:**
- Each ad group gets ad copy RELEVANT to that searcher's intent
- Each ad group points to the EXACT landing page for that intent
- Quality Score improves (relevance → lower CPC)
- Conversion rates improve (matching landing page → confidence)
- You can see which intent cluster converts best and shift budget

### Google Ads API Mutation Pattern

When restructuring an existing campaign via the API (using `google-ads-api` npm package):

```javascript
const { enums, resources } = require('google-ads-api');
const { createCustomer, getCustomerId } = require('./client');

const customer = createCustomer();

// 1. Add negative keywords (step 1 — idempotent, safe to re-run)
const negOps = negatives.map(neg => ({
  entity: 'campaign_criterion',
  operation: 'create',
  resource: {
    campaign: `customers/${cid}/campaigns/${campaignId}`,
    negative: true,
    keyword: {
      text: neg.text,
      match_type: neg.type === 'EXACT'
        ? enums.KeywordMatchType.EXACT   // = 2
        : enums.KeywordMatchType.PHRASE, // = 3
    },
  },
}));
await customer.mutateResources(negOps);

// 2. Pause old ad group (step 2)
await customer.mutateResources([{
  entity: 'ad_group',
  operation: 'update',
  resource: {
    resource_name: `customers/${cid}/adGroups/${oldAdGroupId}`,
    status: enums.AdGroupStatus.PAUSED, // = 3
  },
}]);

// 3. Create new ad groups + keywords + RSA ads (step 3 — one batch)
const ops = [];
for (const ag of adGroups) {
  const tempId = -100 - adGroups.indexOf(ag); // temp negative ID for linking
  ops.push({
    entity: 'ad_group',
    operation: 'create',
    resource: {
      resource_name: `customers/${cid}/adGroups/${tempId}`,
      name: ag.name,
      campaign: campaignResource,
      status: enums.AdGroupStatus.PAUSED, // = 3
    },
  });

  for (const kw of ag.keywords) {
    ops.push({
      entity: 'ad_group_criterion',
      operation: 'create',
      resource: {
        ad_group: `customers/${cid}/adGroups/${tempId}`,
        keyword: { text: kw.text, match_type: kw.matchType },
        status: enums.AdGroupCriterionStatus.PAUSED,
      },
    });
  }

  const ad = new resources.Ad({
    responsive_search_ad: {
      headlines: ag.rsa.headlines.map(text => ({ text })),
      descriptions: ag.rsa.descriptions.map(text => ({ text })),
      path1: ag.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 15),
    },
    final_urls: [ag.finalUrl],
    type: enums.AdType.RESPONSIVE_SEARCH_AD,
  });

  ops.push({
    entity: 'ad_group_ad',
    operation: 'create',
    resource: {
      ad_group: `customers/${cid}/adGroups/${tempId}`,
      ad,
      status: enums.AdGroupAdStatus.PAUSED,
    },
  });
}
await customer.mutateResources(ops);
```

### Critical Google Ads API Enum Values

| Enum | Value | Mnemonic |
|------|-------|----------|
| `AdGroupStatus.ENABLED` | **2** | Two = True (on) |
| `AdGroupStatus.PAUSED` | **3** | Three = sTop (paused) |
| `KeywordMatchType.EXACT` | **2** | Ex = 2nd |
| `KeywordMatchType.PHRASE` | **3** | Ph = 3rd |
| `KeywordMatchType.BROAD` | **4** | Br = 4 (broadest = highest number) |

**Gotcha:** These are COUNTERINTUITIVE. ENABLED=2, PAUSED=3. Always use `enums.AdGroupStatus.PAUSED` instead of raw numbers.

### Common API Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Too long.` | RSA description > 90 chars or headline > 30 | Check char length before submitting |
| `padEnd is not a function` | `campaign.status` is enum number, not string | Wrap with `String(c.status \|\| '')` |
| `Error: undefined` | `campaign_criterion.campaign` given display name instead of resource name | Resolve campaign name → `customers/{cid}/campaigns/{id}` first |
| `Resource name is malformed` | Used wrong resource name format for ad_group_ad | Format is `customers/{cid}/adGroupAds/{ag_id}~{ad_id}` |
| `Error in WHERE clause: invalid value` | Used SQL-style subquery that google-ads-api doesn't support | Use separate queries or full resource names |

---

## Phase 6: Execution Order (The Safe Path)

### Step 1: Add Negatives First
Negatives are the safest mutation — they only PREVENT spend, never create it.
```bash
node src/cli.js add-negatives \
  --campaign="Campaign Name" \
  --keywords="waste,terms,here" \
  --match-type=PHRASE
```

### Step 2: Pause Bad Ad Groups
Before creating new ones, kill what's burning money.
```javascript
// Pause old ad group (idempotent — safe to re-run)
await customer.mutateResources([{
  entity: 'ad_group',
  operation: 'update',
  resource: {
    resource_name: `customers/${cid}/adGroups/${oldAgId}`,
    status: enums.AdGroupStatus.PAUSED,
  },
}]);
```

### Step 3: Create New Structure
All new ad groups, keywords, and ads — one batch, all PAUSED.
```javascript
await customer.mutateResources(allOperations);
```

### Step 4: Verify (Before Enabling)
```bash
node src/cli.js campaigns
# Confirm new ad groups exist
# Confirm old ad groups are PAUSED
# Confirm negatives count increased
```

### Step 5: Manual Enable (Human Gate)
Never automate campaign enablement. The human must:
1. Set budget in Google Ads UI
2. Verify conversion tracking fires correctly
3. Enable campaign manually

## Full Workflow: Underperforming Campaign → High-Converting

```
1. DIAGNOSE
   ├── Pull campaigns, search terms, negatives (CLI)
   ├── Pull full ad group/keyword/ad structure (API)
   └── Classify waste: broad match? generic keywords? weak copy? broken tracking?

2. RESEARCH
   ├── 4-tier keyword classification
   ├── Competitor landscape + pricing map
   ├── Differentiator audit ("what ONLY we do")
   └── Landing page audit (one dedicated page per intent cluster)

3. STRUCTURE
   ├── 5-6 ad groups segmented by intent
   ├── 70-85 keywords (all EXACT/PHRASE, zero broad)
   ├── 50-70 negatives (8 categories)
   └── RSA copy: differentiator-led headlines + pricing-pressure descriptions

4. EXECUTE (safe order)
   ├── Add negatives first
   ├── Pause bad ad groups
   ├── Create new structure (all PAUSED)
   └── Verify with CLI + API queries

5. HANDOFF
   ├── Document what changed + why
   ├── List manual steps: set budget, verify tracking, enable
   └── Schedule first search term audit (24-48h after enable)
```

---

## Quick Reference: Q&A

**Q: Why zero broad match?**
A: Broad match on "qr codes" matched to "qr code reader", "dr code generator", "cod qr generator". None of those searchers want to buy dynamic QR code software. Broad match wastes budget on queries with zero purchase intent. PHRASE is the widest you should go for a conversion campaign.

**Q: Why 5-6 ad groups instead of 1?**
A: Google rewards ad relevance. Someone searching "qr code analytics" should see an ad about analytics that lands on the analytics page. Someone searching "qr.io alternative" should see a pricing comparison ad that lands on pricing. One ad group = one ad = lowest common denominator copy.

**Q: Why are negatives so important?**
A: Negatives are negative costs. Every dollar you prevent from being spent on a bad click is pure profit margin that doesn't need to convert. A well-negatived campaign can have 2-3x better ROAS than an identical campaign without negatives.

**Q: What if I don't have a unique differentiator?**
A: Find one. What do your best customers say when asked why they chose you? Price? Service? Feature? If nothing else, "cheaper than [established player]" works — see Competitor Alternatives ad group pattern.

**Q: How do I handle the "too long" RSA error?**
A: Always pre-validate. Headlines ≤ 30 chars. Descriptions ≤ 90 chars. Count characters (not words). Cut filler words ("and", "that", "just") before cutting substance. Test with `node -e "console.log('text'.length)"`.
