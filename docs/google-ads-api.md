---
library: google-ads-api
library_version: "23"
api_version: v18
last_verified: 2026-05-20
---

# Google Ads API — Node.js Reference

Reference for the `google-ads-api` library (by Opteo) used in this project.

> **Why this library**: Of the three Node.js Google Ads libraries, `google-ads-api` is the easy-to-use TypeScript wrapper with full API coverage. The alternatives (`google-ads-node` — low-level proto output, `google-ads-nodejs` — legacy/unmaintained) are not used here.

**Package**: `npm install google-ads-api`
**Repository**: [github.com/opteo/google-ads-api](https://github.com/opteo/google-ads-api)
**Official docs**: [developers.google.com/google-ads/api](https://developers.google.com/google-ads/api/docs)

---

## Table of Contents

- [Environment Variables](#environment-variables)
- [Client Setup](#client-setup)
- [Reporting](#reporting)
- [GAQL Queries](#gaql-queries)
- [Streaming](#streaming-large-results)
- [Mutations](#mutations-createupdatedelete)
- [Resource Names Helper](#resource-names-helper)
- [Hooks](#hooks-system)
- [Error Handling](#error-handling)
- [Utilities](#utilities)
- [Enums Reference](#enums-reference)
- [Resources, Metrics & Segments](#resources-metrics--segments)
- [Gotchas](#gotchas)
- [Rate Limits & Quotas](#rate-limits--quotas)
- [MCP Integration](#mcp-integration)
- [Complete Examples](#complete-examples)
- [Exports Summary](#exports-summary)
- [Legacy Libraries](#legacy-libraries)

---

## Environment Variables

This project uses the `GOOGLE_ADS_` prefix for all credentials. Configure via `.env` in the project root:

```bash
# .env
GOOGLE_ADS_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=xxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxx
GOOGLE_ADS_REFRESH_TOKEN=xxx
GOOGLE_ADS_CUSTOMER_ID=XXX-XXX-XXXX    # Hyphens OK — stripped automatically
```

| Variable | Required | Source |
|----------|----------|--------|
| `GOOGLE_ADS_CLIENT_ID` | Yes | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_ADS_CLIENT_SECRET` | Yes | Google Cloud Console → APIs & Services → Credentials |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Yes | Google Ads UI → Tools & Settings → API Center |
| `GOOGLE_ADS_REFRESH_TOKEN` | Yes | OAuth2 flow for the Google Ads manager/user account |
| `GOOGLE_ADS_CUSTOMER_ID` | Yes | Your Google Ads customer ID (hyphens OK) |

### OAuth2 Setup

1. Create OAuth2 credentials in Google Cloud Console
2. Enable the Google Ads API in your Google Cloud project
3. Generate a refresh token using the OAuth2 flow
4. Add all values to `.env`

---

## Client Setup

### Initialize the Client

```typescript
import { GoogleAdsApi } from "google-ads-api";

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  disable_parsing: false,            // Optional: Disable camelCase→snake_case
  max_reporting_rows: 1000000,      // Optional: Max rows in reports
});
```

### Customer Instance

```typescript
// Basic customer access
const customer = client.Customer({
  customer_id: "1234567890",          // No hyphens
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
});

// Manager account access (login_customer_id for MCC)
const customer = client.Customer({
  customer_id: "1234567890",
  login_customer_id: "<LOGIN-CUSTOMER-ID>",    // For manager accounts
  linked_customer_id: "<LINKED-CUSTOMER-ID>",  // For linked accounts
  refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
});
```

### List Accessible Customers

```typescript
const customers = await client.listAccessibleCustomers(refreshToken);
// Returns resource names of available customer accounts
```

---

## Reporting

### Report Options Reference

| Option | Type | Description |
|--------|------|-------------|
| `entity` | `string` | Primary resource (e.g., `campaign`, `ad_group`) |
| `attributes` | `string[]` | Resource attributes to retrieve |
| `metrics` | `string[]` | Metrics to retrieve |
| `constraints` | `object \| array` | Filter conditions (see [Constraints](#constraints)) |
| `segments` | `string[]` | Dimensions to group by |
| `date_range` | `string \| object` | Predefined range or custom `{start, end}` |
| `limit` | `number` | Max results |
| `order` | `array` | Sort specification (preferred over deprecated `order_by`) |
| `search_settings` | `object` | `{ return_summary_row: true }` for totals |

### Date Ranges

```typescript
// Predefined constants
date_range: "LAST_7_DAYS"
date_range: "TODAY"
date_range: "LAST_30_DAYS"

// Custom range (preferred over from_date/to_date)
date_range: { start: "2023-01-01", end: "2023-01-31" }
```

| Constant | Description |
|----------|-------------|
| `TODAY` | Current day |
| `YESTERDAY` | Previous day |
| `LAST_7_DAYS` | Last 7 days |
| `LAST_14_DAYS` | Last 14 days |
| `LAST_30_DAYS` | Last 30 days |
| `LAST_BUSINESS_WEEK` | Previous business week |
| `THIS_MONTH` | Current month |
| `LAST_MONTH` | Previous month |
| `THIS_WEEK_SUN_TODAY` | Sunday to today |
| `THIS_WEEK_MON_TODAY` | Monday to today |
| `LAST_WEEK_SUN_SAT` | Previous week (Sun-Sat) |
| `LAST_WEEK_MON_SUN` | Previous week (Mon-Sun) |

### Constraints

```typescript
// Simple equality
constraints: { "campaign.status": "ENABLED" }

// Comparison operators (prefix notation)
constraints: { "metrics.clicks": "> 100" }
constraints: { "metrics.cost_micros": ">= 1000000" }

// IN operator (array)
constraints: { "campaign.id": [123, 456] }

// Multiple constraints (array form)
constraints: [
  { "campaign.status": "ENABLED" },
  { "metrics.cost_micros": "> 0" },
]
```

| Operation | Example |
|-----------|--------|
| `=` | `{ "campaign.status": "ENABLED" }` |
| `!=` | `{ "campaign.status": "!= PAUSED" }` |
| `>` / `>=` / `<` / `<=` | `{ "metrics.clicks": "> 100" }` |
| `IN` | `{ "campaign.id": [123, 456] }` |
| `NOT IN` | `{ "campaign.status": ["REMOVED", "SUSPENDED"] }` |
| `LIKE` | `{ "campaign.name": "LIKE %sale%" }` |
| `DURING` | `{ "segments.date": "DURING LAST_30_DAYS" }` |
| `BETWEEN` | `{ "metrics.cost_micros": "BETWEEN 1000000 5000000" }` |
| `REGEXP_MATCH` | `{ "campaign.name": "REGEXP_MATCH '^Test.*'" }` |

### Retrieve Campaigns with Metrics

```typescript
import { enums } from "google-ads-api";

const campaigns = await customer.report({
  entity: "campaign",
  attributes: [
    "campaign.id",
    "campaign.name",
    "campaign.bidding_strategy_type",
    "campaign_budget.amount_micros",
  ],
  metrics: [
    "metrics.cost_micros",
    "metrics.clicks",
    "metrics.impressions",
    "metrics.all_conversions",
  ],
  constraints: {
    "campaign.status": enums.CampaignStatus.ENABLED,
  },
  limit: 20,
});
```

### Sorting Results

```typescript
// Preferred: order array
const response = await customer.report({
  entity: "campaign",
  attributes: ["campaign.id"],
  metrics: ["metrics.clicks"],
  segments: ["segments.date"],
  order: [
    { field: "metrics.clicks", sort_order: "DESC" },
    { field: "segments.date", sort_order: "ASC" },
    { field: "campaign.id" }, // default sort_order is descending
  ],
});
```

### Summary Row

```typescript
const [summaryRow, ...response] = await customer.report({
  entity: "campaign",
  metrics: ["metrics.clicks", "metrics.all_conversions"],
  search_settings: {
    return_summary_row: true,
  },
});
// summaryRow is the FIRST row of results
```

### Total Results Count

```typescript
const totalRows = await customer.reportCount({
  entity: "search_term_view",
  attributes: ["search_term_view.resource_name"],
});
```

---

## GAQL Queries

Use `customer.query()` for raw GAQL (Google Ads Query Language) strings:

```typescript
const campaigns = await customer.query(`
  SELECT
    campaign.id,
    campaign.name,
    campaign.bidding_strategy_type,
    campaign_budget.amount_micros,
    metrics.cost_micros,
    metrics.clicks,
    metrics.impressions,
    metrics.all_conversions
  FROM
    campaign
  WHERE
    campaign.status = "ENABLED"
  ORDER BY metrics.clicks DESC
  LIMIT 20
`);
```

> **GAQL syntax note**: WHERE clauses use string enum names (`"ENABLED"`, `"PAUSED"`), but query results return numeric enum values (`1`, `3`). See [Gotchas](#gotchas).

---

## Streaming Large Results

### Async Iterator (Preferred)

```typescript
const stream = customer.reportStream({
  entity: "ad_group_criterion",
  attributes: [
    "ad_group_criterion.keyword.text",
    "ad_group_criterion.status",
  ],
  constraints: {
    "ad_group_criterion.type": "KEYWORD",
  },
});

for await (const row of stream) {
  if (someLogic) {
    break; // Break the loop to stop streaming
  }
  // Process row
}
```

Or with GAQL:

```typescript
const stream = customer.queryStream(`
  SELECT
    ad_group_criterion.keyword.text,
    ad_group_criterion.status
  FROM
    ad_group_criterion
  WHERE
    ad_group_criterion.type = "KEYWORD"
`);

for await (const row of stream) {
  // Process row
}
```

### Raw Stream (Event-based)

For manual event handling. Rows arrive in 10,000-row chunks:

```typescript
import { parse } from "google-ads-api";

const stream = customer.reportStreamRaw({
  entity: "ad_group_criterion",
  attributes: [
    "ad_group_criterion.keyword.text",
    "ad_group_criterion.status",
  ],
  constraints: {
    "ad_group_criterion.type": "KEYWORD",
  },
});

stream.on("data", (chunk) => {
  const parsedResults = parse({
    results: chunk.results,
    reportOptions, // Must match the report options used for the query
  });
});

stream.on("error", (error) => {
  throw new Error(error);
});

stream.on("end", () => {
  console.log("stream has finished");
});
```

---

## Mutations (Create/Update/Delete)

### Create a Responsive Search Ad (RSA)

> **Note**: Expanded Text Ads (ETA) were deprecated in June 2022. Always use Responsive Search Ads for new text ad creation.

```typescript
import { resources, enums, ResourceNames } from "google-ads-api";

const ad = new resources.Ad({
  responsive_search_ad: {
    headlines: [
      { text: "Cruise to Mars" },
      { text: "Best Space Cruise Line" },
      { text: "Book Your Tickets Now" },
    ],
    descriptions: [
      { text: "Affordable space travel for everyone" },
      { text: "Departures weekly from Cape Canaveral" },
    ],
  },
  final_urls: ["https://example.com"],
  type: enums.AdType.RESPONSIVE_SEARCH_AD,
});

const adGroup = ResourceNames.adGroup(customerId, "123");

const adGroupAd = new resources.AdGroupAd({
  status: enums.AdGroupAdStatus.PAUSED,
  ad_group: adGroup,
  ad: ad,
});

const { results } = await customer.adGroupAds.create([adGroupAd]);
// Returns array of newly created resource names
```

### Create Campaign & Budget Atomically

```typescript
import { resources, enums, toMicros, ResourceNames } from "google-ads-api";

// Use temporary resource id (-1) for atomic creation
const budgetResourceName = ResourceNames.campaignBudget(
  customer.credentials.customer_id,
  "-1"
);

const operations = [
  {
    entity: "campaign_budget",
    operation: "create",
    resource: {
      resource_name: budgetResourceName,
      name: "Planet Express Budget",
      delivery_method: enums.BudgetDeliveryMethod.STANDARD,
      amount_micros: toMicros(500), // $500/day in micros
    },
  },
  {
    entity: "campaign",
    operation: "create",
    resource: {
      name: "Planet Express",
      advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
      status: enums.CampaignStatus.PAUSED,
      manual_cpc: {
        enhanced_cpc_enabled: false,
      },
      campaign_budget: budgetResourceName,
      network_settings: {
        target_google_search: true,
        target_search_network: true,
      },
    },
  },
];

const result = await customer.mutateResources(operations);
```

### Add Policy Exemption Keywords

```typescript
const adGroupResourceName = "customers/123/adGroups/456";
const keyword = "24 hour locksmith harlem";

const operations = [
  {
    entity: "ad_group_criterion",
    operation: "create",
    resource: {
      ad_group: adGroupResourceName,
      keyword: {
        text: keyword,
        match_type: enums.KeywordMatchType.PHRASE,
      },
      status: enums.AdGroupStatus.ENABLED,
    },
    exempt_policy_violation_keys: [
      {
        policy_name: "LOCAL_SERVICES",
        violating_text: keyword,
      },
    ],
  },
];

const result = await customer.mutateResources(operations);
```

### Upload Click Conversions

```typescript
const clickConversion = {
  gclid: "<GOOGLE-CLICK-ID>",
  conversion_action: "customers/1234567890/conversionActions/111222333",
  conversion_date_time: "2022-01-11 00:00:00",
  conversion_value: 123,
  currency_code: "GBP",
};

await customer.conversionUploads.uploadClickConversions({
  customer_id: customerId,
  conversions: [clickConversion],
});
```

---

## Resource Names Helper

Use `ResourceNames` to construct well-formed resource names instead of string concatenation:

```typescript
import { ResourceNames } from "google-ads-api";

ResourceNames.campaign("1234567890", "3218318373");
// "customers/1234567890/campaigns/3218318373"

ResourceNames.adGroup(123, 123);
// "customers/123/adGroups/123"

ResourceNames.adGroupAd("1", "2", "3");
// "customers/1/adGroupAds/2~3"

ResourceNames.campaignBudget("1234567890", "-1");
// "customers/1234567890/campaignBudgets/-1" (temporary ID)

ResourceNames.geoTargetConstant(1010543);
// "geoTargetConstants/1010543"
```

---

## Hooks System

Hooks intercept queries, streams, and mutations for logging, cancellation, or request modification.

| Hook | Trigger | Use Case |
|------|---------|----------|
| `onQueryStart` | Before query/report | Cancel request, modify options |
| `onQueryEnd` | After query/report | Log results, transform response |
| `onQueryError` | On query error | Log errors, send alerts |
| `onStreamStart` | Before stream | Cancel stream, modify options |
| `onStreamError` | On stream error | Log errors |
| `onMutationStart` | Before mutation | Cancel mutation, modify options |
| `onMutationEnd` | After mutation | Log changes |
| `onMutationError` | On mutation error | Log errors, rollback |
| `onServiceStart` | Before service call | Cancel call, modify options |
| `onServiceEnd` | After service call | Log results |
| `onServiceError` | On service error | Log errors |

### Example: Pre-request Hook

```typescript
const onQueryStart = async ({ cancel, editOptions }) => {
  if (env.mode === "test") {
    cancel([]); // Cancel with alternative return value
  }
  if (env.mode === "dev") {
    editOptions({ validate_only: true }); // Dry-run mode
  }
};

const customer = client.Customer(
  { clientOptions, customerOptions },
  { onQueryStart }
);
```

### Example: Error Hook

```typescript
const onQueryError = async ({ error }) => {
  console.error("Query failed:", error.message);
};

const customer = client.Customer(
  { clientOptions, customerOptions },
  { onQueryError }
);
```

---

## Error Handling

All errors (except GRPC-specific) are instances of `GoogleAdsFailure`:

```typescript
import { errors } from "google-ads-api";

try {
  await customer.query(`
    SELECT campaign.bad_field FROM campaign
  `);
} catch (err) {
  if (err instanceof errors.GoogleAdsFailure) {
    console.log(err.errors); // Array of GoogleAdsError instances

    const [firstError] = err.errors;
    if (
      firstError.error_code.query_error ===
      errors.QueryErrorEnum.QueryError.UNRECOGNIZED_FIELD
    ) {
      console.log(
        `Error: using invalid field "${firstError.trigger}" in query`
      );
    }
  }
}
```

### GRPC Errors

GRPC errors (connection, timeouts) are regular `Error` instances:

```typescript
try {
  await customer.query(gaql);
} catch (err) {
  if (err.code === "DEADLINE_EXCEEDED") {
    console.log("Request timed out");
  }
}
```

---

## Utilities

### Micros Conversion

Google Ads uses **micros** for monetary values (1 dollar = 1,000,000 micros).

```typescript
import { toMicros, fromMicros } from "google-ads-api";

toMicros(500);        // 500000000
fromMicros(500000000); // 500
```

### Parse Stream Results

Use `parse()` to manually process raw stream chunks:

```typescript
import { parse } from "google-ads-api";

const parsedResults = parse({
  results: chunk.results,
  reportOptions, // Must match the report options used for the stream query
});
```

---

## Enums Reference

```typescript
import { enums } from "google-ads-api";

enums.CampaignStatus.ENABLED;
enums.AdGroupStatus.PAUSED;
enums.AdGroupCriterionStatus.ENABLED;
enums.KeywordMatchType.PHRASE;
enums.CriterionType.KEYWORD;
enums.AdType.RESPONSIVE_SEARCH_AD;
enums.AdvertisingChannelType.SEARCH;
enums.BudgetDeliveryMethod.STANDARD;
```

| Enum | Values |
|------|--------|
| `CampaignStatus` | ENABLED, PAUSED, REMOVED, SUSPENDED |
| `AdGroupStatus` | ENABLED, PAUSED, REMOVED |
| `AdGroupCriterionStatus` | ENABLED, PAUSED, REMOVED |
| `AdGroupAdStatus` | ENABLED, PAUSED, REMOVED |
| `KeywordMatchType` | BROAD, EXACT, PHRASE |
| `CriterionType` | KEYWORD, PLACEMENT, AGE_RANGE, DEVICE, etc. |
| `AdType` | RESPONSIVE_SEARCH_AD, RESPONSIVE_DISPLAY_AD, etc. |
| `AdvertisingChannelType` | SEARCH, DISPLAY, SHOPPING, VIDEO, etc. |
| `BudgetDeliveryMethod` | STANDARD, ACCELERATED |

---

## Resources, Metrics & Segments

### Common Resources

| Resource | Key Fields |
|----------|------------|
| **Campaign** | `campaign.id`, `campaign.name`, `campaign.status`, `campaign.advertising_channel_type`, `campaign.start_date`, `campaign.end_date` |
| **Campaign Budget** | `campaign_budget.amount_micros`, `campaign_budget.delivery_method` |
| **Ad Group** | `ad_group.id`, `ad_group.name`, `ad_group.status`, `ad_group.campaign` |
| **Keyword** | `ad_group_criterion.keyword.text`, `ad_group_criterion.keyword.match_type`, `ad_group_criterion.status` |
| **Search Term** | `search_term_view.search_term`, `search_term_view.status` |
| **Ad** | `ad_group_ad.ad.type`, `ad_group_ad.status` |

### Full Resource Categories

**Campaigns**: `campaign`, `campaign_budget`, `campaign_criterion`, `campaign_label`
**Ad Groups**: `ad_group`, `ad_group_criterion`, `ad_group_ad`, `ad_group_label`
**Search Terms**: `search_term_view`
**Assets**: `asset`, `asset_group`, `campaign_asset`
**Customer**: `customer`, `customer_user_access`
**Bidding**: `bidding_strategy`, `campaign_bid_modifier`
**Conversion**: `conversion_action`, `conversion_custom_variable`, `conversion_goal_campaign_config`
**Labels**: `campaign_label`, `ad_group_label`, `ad_group_criterion_label`

### Available Metrics

| Metric | Description |
|--------|-------------|
| `metrics.impressions` | Number of ad impressions |
| `metrics.clicks` | Number of clicks |
| `metrics.cost_micros` | Cost in micros (divide by 1M for dollars) |
| `metrics.ctr` | Click-through rate |
| `metrics.average_cpc` | Average cost per click |
| `metrics.average_cpm` | Average cost per thousand impressions |
| `metrics.conversions` | Number of conversions |
| `metrics.all_conversions` | All conversions (including cross-device) |
| `metrics.conversions_value` | Value of conversions |
| `metrics.all_conversions_value` | Value of all conversions |
| `metrics.conversion_rate` | Conversion rate |
| `metrics.interaction_rate` | Interaction rate |
| `metrics.interactions` | Number of interactions |
| `metrics.view_through_conversions` | View-through conversions |

### Common Segments

| Segment | Description |
|---------|-------------|
| `segments.date` | Daily breakdown |
| `segments.month` | Monthly breakdown |
| `segments.quarter` | Quarterly breakdown |
| `segments.year` | Yearly breakdown |
| `segments.device` | Device breakdown (DESKTOP, MOBILE, TABLET) |
| `segments.ad_network_type` | Ad network breakdown |
| `segments.click_type` | Click type breakdown |
| `segments.keyword` | Keyword breakdown |
| `segments.conversion_action` | By conversion action |
| `segments.country` | Country breakdown |

---

## Gotchas

### Status Enums: Numeric vs String

**Query results return numeric enums**, but GAQL WHERE clauses use string names:

| Numeric | String |
|---------|--------|
| 1 | ENABLED |
| 2 | REMOVED |
| 3 | PAUSED |
| 4 | SUSPENDED |

```typescript
// Query returns numeric status:
{ ad_group_criterion: { status: 3 } } // means PAUSED

// GAQL WHERE uses string:
// WHERE ad_group_criterion.status = PAUSED
```

### Resource Names

Always use the `resource_name` field from query results for mutations. Don't construct manually:

```typescript
// ✅ Correct — use resource_name from query results
const { resource_name } = campaign;

// ✅ Also correct — use ResourceNames helper
const name = ResourceNames.campaign(customerId, campaignId);

// ❌ Don't string-concatenate
const name = `customers/${customerId}/campaigns/${campaignId}`;
```

### Customer IDs

- Customer IDs in API calls must be **numeric only** (no hyphens)
- This project's CLI strips hyphens automatically from `GOOGLE_ADS_CUSTOMER_ID`
- MCP tools also require numeric-only customer IDs

### Expanded Text Ads Deprecated

Expanded Text Ads (ETA) were **deprecated June 2022**. Use **Responsive Search Ads** for all new text ad creation. ETAs cannot be created or modified — only paused/removed.

---

## Rate Limits & Quotas

Google Ads API enforces strict rate limits. Exceeding them returns `RESOURCE_EXHAUSTED` errors.

| Limit | Threshold |
|-------|-----------|
| Requests per minute | ~1,000 per developer token |
| Reports per day | ~5,000 per customer |
| Concurrent requests | ~10 per customer |
| Mutate operations per batch | ~5,000 per request |

### Best Practices

- **Batch operations**: Group mutations into batches (up to 5,000 operations per request)
- **Streaming for large reads**: Use `reportStream` / `queryStream` instead of loading all results into memory
- **Exponential backoff**: Retry on `RESOURCE_EXHAUSTED` with increasing delay
- **Summary row**: Use `return_summary_row: true` instead of fetching all rows for totals
- **Report count**: Use `reportCount()` to check row count before fetching

### Recommended Retry Pattern

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (err.code === "RESOURCE_EXHAUSTED" && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## MCP Integration

The `google-ads-mcp` server provides read-only access via the Model Context Protocol.

### MCP Search Tool

```javascript
{
  customer_id: "2081039078",        // Required: Numeric only (no hyphens)
  resource: "campaign",              // Required: resource name
  fields: [                          // Required: field names to SELECT
    "campaign.name",
    "campaign.status",
    "metrics.impressions",
    "metrics.clicks",
    "metrics.cost_micros"
  ],
  conditions: [                      // Optional: WHERE clause strings
    "campaign.status = 'ENABLED'",
    "metrics.cost_micros > 0"
  ],
  orderings: ["metrics.cost_micros DESC"],  // Optional: ORDER BY strings
  limit: 100                         // Optional: LIMIT
}
```

### MCP Usage Notes

1. **Read-only**: MCP search is read-only. Use the CLI or direct library calls for mutations.

2. **String conditions** (not objects):
   ```javascript
   // ✅ Correct
   conditions: ["campaign.status = 'ENABLED'"]

   // ❌ Wrong — will cause errors
   conditions: [{ field: "campaign.status", operator: "=", value: "ENABLED" }]
   ```

3. **String orderings** (not objects):
   ```javascript
   // ✅ Correct
   orderings: ["metrics.cost_micros DESC"]

   // ❌ Wrong
   orderings: [{ field: "metrics.cost_micros", sort_order: "DESC" }]
   ```

4. **Complex conditions**: Combine with explicit `AND`:
   ```javascript
   conditions: ["campaign.name = 'business-purchase-us' AND metrics.cost_micros > 0"]
   ```

5. **Known invalid fields** (causes `UNRECOGNIZED_FIELD`):
   - `campaign.extension_setting_feed_items`
   - `campaign_extension_setting` resource
   - `extension_feed_item.id`, `extension_feed_item.resource_name`
   - `*` in SELECT clause

---

## Complete Examples

### Full Campaign Management

```typescript
import {
  GoogleAdsApi,
  ResourceNames,
  enums,
  resources,
  toMicros,
} from "google-ads-api";

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
});

async function main() {
  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, ""),
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });

  // Create a budget with temporary resource ID
  const budgetName = ResourceNames.campaignBudget(
    customer.credentials.customer_id,
    "-1"
  );

  await customer.mutateResources([
    {
      entity: "campaign_budget",
      operation: "create",
      resource: {
        resource_name: budgetName,
        name: "My Budget",
        delivery_method: enums.BudgetDeliveryMethod.STANDARD,
        amount_micros: toMicros(50), // $50/day
      },
    },
  ]);

  // Create a campaign
  const campaign = new resources.Campaign({
    name: "My Campaign",
    campaign_budget: budgetName,
    advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
    status: enums.CampaignStatus.PAUSED,
    network_settings: {
      target_google_search: true,
      target_search_network: true,
    },
  });

  const campaignResult = await customer.campaigns.create([campaign]);
  const campaignResourceName = campaignResult.results[0].resource_name;

  // Enable the campaign
  await customer.campaigns.update([
    {
      resource_name: campaignResourceName,
      status: enums.CampaignStatus.ENABLED,
    },
  ]);

  // Get campaign performance
  const report = await customer.report({
    entity: "campaign",
    attributes: ["campaign.id", "campaign.name", "campaign.status"],
    metrics: ["metrics.impressions", "metrics.clicks", "metrics.cost_micros"],
    constraints: {
      "campaign.id": parseInt(campaignResourceName.split("/")[3]),
    },
  });

  console.log(report);
}

main();
```

### Keyword Research

> **Note**: Requires the Keyword Planning API to be enabled. May not be available on all account types.

```typescript
import { GoogleAdsApi, services } from "google-ads-api";

async function getKeywordIdeas(keywords: string[]) {
  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, ""),
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });

  const keywordSeed = new services.KeywordSeed({ keywords });

  const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
    customer_id: customer.credentials.customer_id,
    page_size: 50,
    keyword_seed: keywordSeed,
  });

  return response.results
    .map((idea: any) => {
      if (idea.keyword_idea) {
        return {
          text: idea.keyword_idea.text,
          competition: idea.keyword_idea.keyword_idea_metrics?.competition,
          avg_monthly_searches:
            idea.keyword_idea.keyword_idea_metrics?.avg_monthly_searches,
        };
      }
      return null;
    })
    .filter(Boolean);
}

getKeywordIdeas(["web hosting", "cloud server"]).then(console.log);
```

### Search Terms Report

```typescript
async function getSearchTerms(customerId: string, minCost: number = 0) {
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });

  const searchTerms = await customer.report({
    entity: "search_term_view",
    attributes: [
      "search_term_view.search_term",
      "search_term_view.status",
    ],
    metrics: [
      "metrics.impressions",
      "metrics.clicks",
      "metrics.cost_micros",
      "metrics.conversions",
    ],
    segments: ["segments.date"],
    constraints: {
      "metrics.cost_micros": `>= ${minCost * 1000000}`,
    },
    order: [{ field: "metrics.cost_micros", sort_order: "DESC" }],
    limit: 1000,
  });

  return searchTerms;
}
```

### Batch Keyword Updates

```typescript
import { GoogleAdsApi, enums } from "google-ads-api";

async function enablePausedKeywords(customerId: string, campaignName: string) {
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
  });

  // Find the campaign
  const campaigns = await customer.report({
    entity: "campaign",
    attributes: ["campaign.id", "campaign.name"],
    constraints: {
      "campaign.name": campaignName,
    },
  });

  if (!campaigns.length) {
    console.log("Campaign not found");
    return;
  }

  const campaignId = campaigns[0].campaign.id;

  // Get paused keywords
  const pausedKeywords = await customer.report({
    entity: "ad_group_criterion",
    attributes: [
      "ad_group_criterion.resource_name",
      "ad_group_criterion.keyword.text",
    ],
    constraints: [
      { "campaign.id": campaignId },
      { "ad_group_criterion.status": enums.AdGroupCriterionStatus.PAUSED },
      { "ad_group_criterion.type": enums.CriterionType.KEYWORD },
    ],
  });

  if (!pausedKeywords.length) {
    console.log("No paused keywords found");
    return;
  }

  // Enable them in a single batch
  const operations = pausedKeywords.map((kw: any) => ({
    entity: "ad_group_criterion",
    operation: "update",
    resource: {
      resource_name: kw.ad_group_criterion.resource_name,
      status: enums.AdGroupCriterionStatus.ENABLED,
    },
  }));

  const result = await customer.mutateResources(operations);
  console.log(`Enabled ${result.results.length} keywords`);
}
```

---

## Exports Summary

```typescript
import {
  // Main client
  GoogleAdsApi,

  // Resources & services
  resources,
  services,
  common,
  fields,

  // Enums
  enums,

  // Errors
  errors,

  // Utilities
  fromMicros,
  toMicros,
  parse,
  ResourceNames,

  // Hooks
  Hooks,
  OnQueryStart,
  OnQueryError,
  OnQueryEnd,
  OnStreamStart,
  OnStreamError,
  OnMutationStart,
  OnMutationError,
  OnMutationEnd,
  OnServiceStart,
  OnServiceError,
  OnServiceEnd,
} from "google-ads-api";
```

---

## Legacy Libraries

These libraries are **not used in this project**. Listed for reference only.

| Library | Package | Notes |
|---------|---------|-------|
| `google-ads-node` | [`google-ads-node`](https://www.npmjs.com/package/google-ads-node) | Low-level proto output from Google's Bazel build. Use only if you need direct proto access. |
| `google-ads-nodejs` | [`google-ads-nodejs`](https://www.npmjs.com/package/google-ads-nodejs) | Legacy, less maintained. Nearly identical API surface to `google-ads-api` but without TypeScript definitions. |

---

## Official Resources

- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs)
- [Google Ads API Reference](https://developers.google.com/google-ads/api/reference/rpc)
- [GAQL Query Builder](https://developers.google.com/google-ads/api/docs/query/overview)
- [Google Ads API Node.js Library](https://developers.google.com/google-ads/api/support/libraries#nodejs)
- [google-ads-api GitHub (Opteo)](https://github.com/opteo/google-ads-api)
