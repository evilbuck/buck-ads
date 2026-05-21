# Analysis Guidelines & Model Prompting Strategy

## What to Analyze (from CURRENT-TASK.md)

1. **Sitelinks** — Should be real and high converting
2. **Ad Groups** — Active, ads active
3. **Ads** — Exist and are active
4. **Keywords** — Status, quality, coverage
5. **Assets** — Beyond sitelinks: callouts, snippets, etc.
6. **Business Name** — Consistent branding
7. **Overall readiness** — Campaign ready for deployment?

## Analysis Dimensions

### A. Sitelink Quality Assessment
**Data needed**: Sitelink text, descriptions, URLs, performance metrics

**What the model should evaluate**:
- Are there at least 2-4 sitelinks? (Google shows up to 6)
- Do sitelinks point to real, distinct landing pages?
- Are descriptions present and compelling?
- Do URLs use HTTPS?
- Do they point to high-converting pages (pricing, features, comparison, etc.)?
- Performance: Do sitelinks get clicks? Which ones have 0 clicks?

**Red flags to flag**:
- Only 1 sitelink (minimum 2 for display)
- Sitelinks pointing to homepage only
- Missing descriptions
- 404 or redirect URLs
- Low CTR sitelinks that drag down overall performance

### B. Ad Group Health
**Data needed**: Ad group name, status, keyword count, keyword status, ad status, performance

**What the model should evaluate**:
- Are all ad groups ENABLED?
- Does each ad group have at least one ENABLED keyword?
- Does each ad group have at least one ENABLED ad?
- Are ad groups logically themed? (Single tight theme = better QS)
- Is spend distributed across ad groups or concentrated in one?

**Red flags**:
- Ad group with 0 active keywords
- Ad group with 0 active ads
- Ad group with all keywords PAUSED (dead ad group)
- Ad group spending money but 0 conversions

### C. Ad Quality (RSA)
**Data needed**: RSA headlines, descriptions, paths, final URLs, ad_strength, policy status

**What the model should evaluate**:
- Is `ad_strength` at least GOOD? (POOR/FAIR = needs improvement)
- Are there 10-15 headlines? (minimum 3, but Google rewards more)
- Are there 3-4 descriptions? (minimum 2)
- Do headlines use varied messaging (feature, benefit, CTA, social proof)?
- Are character limits respected?
- Is policy status APPROVED?
- Are final URLs HTTPS and valid?

**Red flags**:
- ad_strength = POOR
- Under 3 headlines
- Policy status = DISAPPROVED or UNDER_REVIEW
- All headlines are similar (poor variety for RSA testing)
- Missing display path

### D. Keyword Coverage & Quality
**Data needed**: Keyword text, match type, status, quality score, performance by keyword

**What the model should evaluate**:
- Are all keywords ENABLED?
- Is there a mix of EXACT and PHRASE? (BROAD should be limited)
- Are quality scores above average (6+)?
- Do keywords cover the main intent themes?
- Are negative keywords in place to prevent waste?

**Red flags**:
- High % of PAUSED keywords
- Quality score < 4 (wasteful)
- No negative keywords
- All BROAD match (expensive, unfocused)
- Keywords with high cost and 0 conversions

### E. Asset Completeness (Beyond Sitelinks)
**Data needed**: All campaign_asset entries with field_type

**What the model should evaluate**:
- Callout extensions present? (At least 4 recommended)
- Structured snippets present?
- Are there at least 2-3 asset types beyond sitelinks?
- Are all assets ENABLED?

### F. Campaign Settings
**Data needed**: Campaign status, channel, network, bidding, optimization score

**What the model should evaluate**:
- Campaign is ENABLED (or intentionally PAUSED)
- Channel is SEARCH (or correct type)
- Network: Google Search on, Search Partner/Content off (or intentionally on)
- Bidding strategy appropriate for goals
- Optimization score above 80%?

### G. Conversion Tracking
**Data needed**: conversion_action list with status and category

**What the model should evaluate**:
- At least one conversion action is ENABLED
- Conversion action category matches business goal (PURCHASE, LEAD, etc.)
- Value tracking configured if ROAS is a goal

---

## Model Prompting Strategy

### Approach: Gather → Structure → Analyze

**Step 1: Data Gathering (CLI/MCP)**
Build a CLI command `analyze-campaign` that:
1. Takes `--campaign="name"` as input
2. Runs 6-8 MCP queries
3. Collects all raw data into a structured JSON object
4. Outputs the JSON (or passes to analysis)

**Step 2: Structured Analysis (Model)**
Feed the structured data to the model with a system prompt that:
- Defines each analysis dimension with clear criteria
- Asks for a pass/fail/warning per dimension
- Requests specific, actionable recommendations
- Requests an overall readiness score

**System prompt outline:**
```
You are a Google Ads campaign readiness analyst. Given structured campaign data,
evaluate the campaign across these dimensions:

1. Sitelinks (weight: 15%)
2. Ad Groups Health (weight: 20%)
3. Ad Quality/RSA (weight: 20%)
4. Keywords (weight: 20%)
5. Assets (weight: 10%)
6. Campaign Settings (weight: 10%)
7. Conversion Tracking (weight: 5%)

For each dimension, output:
- Status: PASS / WARNING / FAIL
- Score: 0-100
- Findings: list of specific observations
- Recommendations: list of specific actions

Output a final readiness score (0-100) and deployment readiness: READY / NEEDS WORK / NOT READY
```

**Step 3: Output Format**
The analysis should produce:
- A structured JSON report (machine-readable)
- A formatted text report (human-readable)
- A readiness score
- Prioritized action items

### Skill vs CLI vs New Script Decision

**Option A: New CLI command** (`analyze-campaign`)
- Pros: Integrates with existing tooling, reusable
- Cons: Needs model API integration for analysis

**Option B: New skill** (`google-ads-analyzer` or extend `google-ads`)
- Pros: Uses the model naturally, can be invoked as a skill
- Cons: Can't do the analysis without the data

**Option C: Hybrid — CLI for data, skill for analysis**
- CLI `analyze-campaign` gathers structured data and prints JSON
- Skill provides the prompting template and analysis guidelines
- User runs CLI, pipes output to model, or skill orchestrates both

**Recommended: Option C (Hybrid)**
- Add `analyze-campaign` command to `src/cli.js` that gathers all data
- Create/update skill with analysis guidelines and prompting strategy
- The skill instructs the agent to run the CLI command, then analyze the output using the guidelines

### Data Schema for Analysis Output

```json
{
  "campaign": {
    "name": "...",
    "status": "...",
    "channel_type": "...",
    "network_settings": {...},
    "optimization_score": 85,
    "serving_status": "...",
    "bidding_strategy_type": "..."
  },
  "ad_groups": [
    {
      "name": "...",
      "status": "ENABLED",
      "keywords": {
        "total": 15,
        "enabled": 15,
        "paused": 0,
        "quality_scores": [7, 8, 6]
      },
      "ads": {
        "total": 1,
        "enabled": 1,
        "ad_strength": "GOOD",
        "rsa": {
          "headline_count": 12,
          "description_count": 3
        }
      },
      "performance": {
        "clicks": 100,
        "impressions": 1000,
        "cost_micros": 5000000,
        "conversions": 3,
        "ctr": 0.1
      }
    }
  ],
  "sitelinks": [
    {
      "title": "Pricing",
      "url": "https://...",
      "descriptions": ["View plans", "Start free"],
      "status": "ENABLED",
      "performance": {...}
    }
  ],
  "other_assets": [...],
  "negative_keywords": [...],
  "conversion_actions": [...]
}
```
