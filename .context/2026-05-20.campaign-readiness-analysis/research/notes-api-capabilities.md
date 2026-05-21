# API Capabilities for Campaign Readiness Analysis

## Data Model: What We Can Query

### 1. Sitelinks & Assets

**Resources**: `campaign_asset`, `asset`, `customer_asset`

| What to check | GAQL Resource | Key Fields |
|---|---|---|
| Sitelinks attached | `campaign_asset` | `campaign_asset.asset`, `campaign_asset.field_type`, `campaign_asset.status` |
| Sitelink content | `asset` | `asset.sitelink_asset.link_text`, `asset.sitelink_asset.description1`, `asset.sitelink_asset.description2`, `asset.final_urls` |
| Other assets | `campaign_asset` | `campaign_asset.field_type` ∈ {SITELINK, CALL, CALLOUT, STRUCTURED_SNIPPET, MOBILE_APP, MOBILE_APP_INSTALL, CALLOUT, PROMOTION, SNIPPET, LOGO, MARKETING_IMAGE, YOUTUBE_VIDEO} |
| Asset performance | `campaign_asset` + metrics | `metrics.clicks`, `metrics.impressions`, `metrics.cost_micros`, `metrics.conversions` |

**MCP query pattern:**
```json
{
  "customer_id": "2081039078",
  "resource": "campaign_asset",
  "fields": ["campaign_asset.asset", "campaign_asset.field_type", "campaign_asset.status", "asset.sitelink_asset.link_text", "asset.final_urls"],
  "conditions": ["campaign_asset.field_type = 'SITELINK'"]
}
```

### 2. Ad Groups

**Resource**: `ad_group`

| What to check | Key Fields |
|---|---|
| Status (ENABLED/PAUSED) | `ad_group.status` |
| Campaign association | `ad_group.campaign` |
| Name | `ad_group.name` |
| Type | `ad_group.type` |
| CTR & performance | `metrics.ctr`, `metrics.clicks`, `metrics.impressions`, `metrics.cost_micros`, `metrics.conversions` |
| Quality signals | `metrics.historical_quality_score`, `metrics.historical_creative_quality_score`, `metrics.historical_landing_page_quality_score`, `metrics.historical_search_predicted_ctr` |

**Dead ad group detection**: Query all ad groups for a campaign, filter where `status != ENABLED` or where all keywords are PAUSED/REMOVED.

### 3. Ads (RSA)

**Resource**: `ad_group_ad`

| What to check | Key Fields |
|---|---|
| Ad exists & active | `ad_group_ad.status` |
| Ad type | `ad_group_ad.ad.type` (RESPONSIVE_SEARCH_AD) |
| RSA headlines | `ad_group_ad.ad.responsive_search_ad.headlines` |
| RSA descriptions | `ad_group_ad.ad.responsive_search_ad.descriptions` |
| RSA paths | `ad_group_ad.ad.responsive_search_ad.path1`, `path2` |
| Final URLs | `ad_group_ad.ad.final_urls` |
| Ad strength | `ad_group_ad.ad_strength` (PENDING, POOR, FAIR, GOOD, EXCELLENT) |
| Policy status | `ad_group_ad.policy_summary.approval_status`, `ad_group_ad.policy_summary.review_status` |
| Performance | `metrics.ctr`, `metrics.impressions`, `metrics.cost_micros`, `metrics.conversions` |

**RSA completeness check:**
- Minimum 3 headlines, recommended 10-15
- Minimum 2 descriptions, recommended 3-4
- All headlines ≤ 30 chars
- All descriptions ≤ 90 chars
- At least one headline pinned to position 1 (optional but recommended)

### 4. Keywords

**Resource**: `ad_group_criterion`

| What to check | Key Fields |
|---|---|
| Keyword status | `ad_group_criterion.status` (ENABLED=1, PAUSED=3, REMOVED=2) |
| Keyword text | `ad_group_criterion.keyword.text` |
| Match type | `ad_group_criterion.keyword.match_type` |
| Quality score | `ad_group_criterion.quality_info.quality_score` |
| Performance | `metrics.clicks`, `metrics.impressions`, `metrics.cost_micros`, `metrics.conversions`, `metrics.ctr` |
| Ad group | `ad_group_criterion.ad_group` (via JOIN) |
| First page CPC | `ad_group_criterion.estimator.first_page_cpc_micros` (if available) |

**Dead keyword detection**: All keywords in an ad group are PAUSED or REMOVED → ad group is effectively dead.

### 5. Campaign-Level Settings

**Resource**: `campaign`

| What to check | Key Fields |
|---|---|
| Status | `campaign.status` |
| Channel type | `campaign.advertising_channel_type` |
| Network settings | `campaign.network_settings.target_google_search`, etc. |
| Bidding strategy | `campaign.bidding_strategy_type`, `campaign.target_cpa.target_cpa_micros` |
| Budget | `campaign.campaign_budget` (reference only — no mutation) |
| Optimization score | `campaign.optimization_score` |
| Serving status | `campaign.serving_status` |
| Business name | Not directly available — derived from sitelinks/ads/asset URLs |

### 6. Negative Keywords

**Resource**: `campaign_criterion`

| What to check | Key Fields |
|---|---|
| Campaign negatives | `campaign_criterion.keyword.text`, `campaign_criterion.keyword.match_type`, `campaign_criterion.negative` |
| Negative scope | Campaign-level vs ad-group-level |

### 7. Business Name / Brand

**No direct field.** Business name is inferred from:
- RSA headlines (often contain brand name)
- Sitelink URLs (domain)
- `asset` resources with `type = 'BRAND'` (if using brand guidelines)
- `campaign.brand_guidelines` fields (newer feature)

### 8. Conversion Tracking

**Resource**: `conversion_action`

| What to check | Key Fields |
|---|---|
| Actions configured | `conversion_action.name`, `conversion_action.status`, `conversion_action.category` |
| Counting method | `conversion_action.counting_type` |
| Value tracking | `conversion_action.value_settings` |

---

## Query Strategy for Full Campaign Analysis

A complete readiness audit needs **6-8 API queries**:

1. **Campaign basics** — `campaign` with status, channel, network, optimization_score, serving_status
2. **Ad groups** — `ad_group` with status, name, metrics
3. **Keywords per ad group** — `ad_group_criterion` with keyword text, match type, status, quality score
4. **Ads per ad group** — `ad_group_ad` with RSA content, status, ad_strength, policy status
5. **Sitelinks** — `campaign_asset` WHERE field_type = SITELINK, with asset content
6. **Other assets** — `campaign_asset` for CALLOUT, SNIPPET, etc.
7. **Negative keywords** — `campaign_criterion` WHERE negative = TRUE
8. **Conversion tracking** — `conversion_action` with status, category
