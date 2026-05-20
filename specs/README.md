# Campaign Spec Format

A campaign spec is a JavaScript module that exports four objects: `campaign`, `adGroups`, `rsa`, and `negatives`.

See `qrpro-bofu-us.js` as a canonical example.

## Required Exports

```javascript
module.exports = { campaign, adGroups, rsa, negatives };
```

## campaign

```javascript
const campaign = {
  name: 'Campaign Name',           // Required — Google Ads campaign name
  status: 'PAUSED',               // Always PAUSED — automation never enables
  advertising_channel_type: 'SEARCH',
  network_settings: {
    target_google_search: true,
    target_search_network: false,
    target_content_network: false,
    target_partner_search_network: false,
  },
};
```

## adGroups

```javascript
const adGroups = [
  {
    name: 'Ad Group Name',         // Required — Google Ads ad group name
    final_url: 'https://example.com/landing-page', // Required — must be HTTPS
    keywords: {
      exact: ['exact keyword'],   // Required — at least one of exact/phrase
      phrase: ['phrase keyword'],
    },
  },
];
```

**Rules:**
- `final_url` must be HTTPS
- At least one keyword in `exact` or `phrase` (no `broad`)
- All keywords must be EXACT or PHRASE match type

## rsa

```javascript
const rsa = {
  headlines: ['Headline 1', 'Headline 2', 'Headline 3'],
  descriptions: ['Description one.', 'Description two.'],
  final_url: 'https://example.com/landing-page',
};
```

**Rules:**
- Headlines: max 30 characters each
- Descriptions: max 90 characters each
- At least 3 headlines and 2 descriptions

## negatives

```javascript
const negatives = {
  'Theme Name': {
    type: 'PHRASE',               // PHRASE or EXACT
    keywords: ['keyword1', 'keyword2'],
  },
};
```

## Bidding

Budget and bidding are **excluded by design**. The automation never creates or modifies budgets or bids. Document your bidding strategy as a comment in the spec for human reference:

```javascript
const biddingSuggestions = {
  recommended_strategy: 'Maximize conversions with target CPA',
  purchase_cpa_test_target: '$25–35',
};
```
