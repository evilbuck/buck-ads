/**
 * @module google-ads/specs/qrpro-bofu-us-v2
 * @description High-converting BoFu US campaign spec v2.
 *              Adds split testing ad group (unique differentiator),
 *              expanded negative keywords from search term data,
 *              pricing-competitive ad copy, and tighter keyword targeting.
 *
 *              Based on research in:
 *              .context/2026-05-19.google-ads-high-converting-campaign/research-keywords-campaign.md
 *
 *              Budget and bids are EXCLUDED by design — the automation layer
 *              must never infer, create, or modify budgets or bidding strategies.
 */

const BASE_URL = 'https://qrpro.tools';

/**
 * Campaign-level settings.
 * Status is always PAUSED — human must enable manually.
 */
const campaign = {
  name: 'Search | BoFu | Dynamic QR + Split Testing | US v2',
  status: 'PAUSED',
  advertising_channel_type: 'SEARCH',
  network_settings: {
    target_google_search: true,
    target_search_network: false,
    target_content_network: false,
    target_partner_search_network: false,
  },
  geo_targets: {
    // United States (geo target ID 2840)
    locations: [2840],
    presence_only: true,
  },
  language_targets: {
    // English (language criterion ID 1000)
    languages: [1000],
  },
  conversion_action_name: 'manual_event_PURCHASE',
  manual_checklist: [
    'Set campaign budget in Google Ads UI before enabling',
    'Verify conversion action fires correctly — test a complete purchase flow',
    'Confirm conversion value is not stuck at $1',
    'Add micro-conversions (pricing view, begin checkout, checkout session created) if not present',
    'Consider enhanced conversions for improved signal quality',
    'Do not broaden match types until 30+ conversions accumulated',
    'Expand to CA/UK/AU/NZ only after US shows consistent conversion signal',
    'Pause Campaign #1 and business-purchase-us to avoid keyword overlap',
    'Add shared negative keyword list from this spec before enabling',
  ],
};

/**
 * Ad groups with keywords and landing pages.
 * Keywords use exact ([kw]) and phrase ("kw") match only.
 * No broad match — prevents waste seen in Campaign #1.
 */
const adGroups = [
  // ─── Group 1: Dynamic / Editable QR ─────────────────────────────────────
  {
    name: 'Dynamic / Editable QR Codes',
    final_url: `${BASE_URL}/dynamic-qr-codes`,
    keywords: {
      exact: [
        'dynamic qr code',
        'dynamic qr codes',
        'dynamic qr code generator',
        'editable qr code',
        'editable qr codes',
        'trackable qr code generator',
        'trackable qr codes',
        'qr code you can edit',
        'changeable qr code',
        'modifiable qr code',
      ],
      phrase: [
        'qr codes you can edit',
        'change qr code destination',
        'update qr code after printing',
        'edit qr code without reprinting',
        'qr code that can be changed',
        'redirect qr code to new url',
      ],
    },
  },

  // ─── Group 2: QR Analytics / Tracking ────────────────────────────────────
  {
    name: 'QR Analytics / Tracking',
    final_url: `${BASE_URL}/qr-code-analytics`,
    keywords: {
      exact: [
        'qr code analytics',
        'qr code tracking',
        'qr code scan tracking',
        'qr code tracking software',
        'qr code analytics software',
        'qr code conversion tracking',
        'qr scan analytics',
      ],
      phrase: [
        'track qr code scans',
        'qr code campaign tracking',
        'qr code with analytics',
        'qr scan analytics',
        'how to track qr code performance',
        'measure qr code conversions',
        'qr code roi tracking',
      ],
    },
  },

  // ─── Group 3: Split Testing / A/B Testing — DIFFERENTIATOR ──────────────
  // This is QRPro's unique feature. Low competition keywords, high business intent.
  {
    name: 'Split Testing / A/B Testing QR',
    final_url: `${BASE_URL}/split-testing`,
    keywords: {
      exact: [
        'qr code split testing',
        'qr code ab testing',
        'ab test qr code',
        'split test qr code',
        'qr code a/b test tool',
        'qr code conversion rate',
        'test qr code landing page',
      ],
      phrase: [
        'ab test qr code destination',
        'split test qr code campaign',
        'qr code a/b testing',
        'qr code split test tool',
        'test multiple qr code destinations',
        'optimize qr code conversions',
        'compare qr code landing pages',
      ],
    },
  },

  // ─── Group 4: Business / Marketing QR ───────────────────────────────────
  {
    name: 'Business / Marketing QR Codes',
    final_url: `${BASE_URL}/business`,
    keywords: {
      exact: [
        'business qr code generator',
        'qr codes for business',
        'professional qr code generator',
        'qr code marketing software',
        'branded qr code generator',
        'qr code management platform',
        'qr code for marketing',
      ],
      phrase: [
        'qr code marketing',
        'qr code campaign',
        'qr code for marketing campaign',
        'qr code with logo generator',
        'qr code for print marketing',
        'branded qr codes for business',
        'trackable qr codes for marketing',
      ],
    },
  },

  // ─── Group 5: Bulk / Batch QR ───────────────────────────────────────────
  {
    name: 'Bulk / Batch QR Codes',
    final_url: `${BASE_URL}/business/pricing`,
    keywords: {
      exact: [
        'bulk qr code generator',
        'batch qr code generator',
        'csv qr code generator',
        'bulk dynamic qr codes',
        'multiple qr code generator',
      ],
      phrase: [
        'generate qr codes in bulk',
        'bulk qr code creation',
        'qr code generator from csv',
        'mass qr code generator',
        'create multiple qr codes at once',
      ],
    },
  },

  // ─── Group 6: Competitor Alternatives ───────────────────────────────────
  {
    name: 'Competitor Alternatives',
    final_url: `${BASE_URL}/business`,
    keywords: {
      exact: [
        'qr.io alternative',
        'qr io alternative',
        'bitly qr code alternative',
        'qr tiger alternative',
        'qr code monkey alternative',
        'beaconstac alternative',
        'uniqode alternative',
        'flowcode alternative',
        'qr code generator with analytics',
        'cheaper than bitly qr',
      ],
      phrase: [
        'best qr code generator for business',
        'qr.io vs alternatives',
        'bitly qr code competitor',
        'affordable qr code platform',
        'cheapest dynamic qr code generator',
      ],
    },
  },
];

/**
 * RSA (Responsive Search Ad) assets.
 * Headlines max 30 chars, descriptions max 90 chars.
 *
 * Strategy: Lead with split testing differentiator,
 *           include pricing pressure vs competitors,
 *           emphasize dynamic/editable + analytics value.
 */
const rsa = {
  headlines: [
    // Differentiator (split testing — unique to QRPro)
    'Split Test QR Codes',          // 19
    'A/B Test QR Destinations',     // 24
    'Print Once. Test Forever.',    // 24
    'Edit QR After Printing',       // 22
    // Value props
    'Track QR Conversions',         // 20
    'Dynamic QR Platform',          // 19
    'QR Code Analytics',            // 17
    'Track Every Scan',             // 16
    // Pricing pressure
    'From $8/mo. Cancel Anytime',   // 28
    'Save 72% vs Bitly',            // 18
    'Free for 5 QR Codes',          // 19
    // Trust + brand
    'QRPro for Business',           // 18
    'Bulk QR Code Generator',       // 23
    'Branded QR Codes',             // 17
    'No Reprint Needed',            // 17
  ],
  descriptions: [
    'Split test destinations from one QR. Track conversions per variant. No reprinting.',
    'Dynamic QR codes with analytics, split testing, branded design. $8/mo. Cancel anytime.',
    'Stop guessing which flyer worked. Track scans and conversions. Send traffic to the winner.',
    'Edit QR destinations after printing. Track device, location, conversions in real time.',
    'QRPro Pro is $8/mo. Bitly starts at $29/mo. Same dynamic codes, 72% less. Cancel anytime.',
  ],
  final_url: `${BASE_URL}/business`,
};

/**
 * Negative keywords to apply at campaign level.
 * Grouped by theme for approval visibility.
 *
 * Expanded from v1 spec based on search term waste data from
 * Campaign #1 and business-purchase-us.
 */
const negatives = {
  'Free / DIY Intent': {
    type: 'PHRASE',
    keywords: [
      'free',
      'gratis',
      'template',
      'tutorial',
      'how to',
      'what is',
      'definition',
      'sample',
      'create qr code',
      'qr code create',
      'text to qr',
      'how to make a qr code',
      'qr code generator free',
      'qr code free',
    ],
  },
  'Wrong Product': {
    type: 'PHRASE',
    keywords: [
      'scanner',
      'reader',
      'scan qr',
      'qr scanner',
      'barcode',
      'bar code',
      'me qr',
      'qr code reader',
      'qr scanner app',
    ],
  },
  'Platform-Specific Noise': {
    type: 'PHRASE',
    keywords: [
      'spotify qr',
      'whatsapp qr',
      'vcard qr',
      'qr code wifi',
      'wifi qr code',
      'instagram qr',
      'facebook qr',
    ],
  },
  'Format / Technical Noise': {
    type: 'PHRASE',
    keywords: [
      'svg qr code',
      'png qr code',
      'qr code api',
      'qr code library',
      'qr code javascript',
      'qr code python',
      'qr code open source',
    ],
  },
  'Non-English Leakage': {
    type: 'PHRASE',
    keywords: [
      'codigo',
      'crear',
      'creador',
      'generador',
      'gerador',
      'criar',
      'gerar',
      'leer',
      'cod qr',
      'dr code',
    ],
  },
  'Personal / Irrelevant Use Cases': {
    type: 'PHRASE',
    keywords: [
      'birthday',
      'wedding',
      'invitation',
      'wechat',
      'korean',
      'arabic',
    ],
  },
  'Tool / Platform Noise': {
    type: 'PHRASE',
    keywords: [
      'ok qr',
      'qr studio',
      'tec it',
      'test_negative_keyword',
    ],
  },
  'Overly Generic (Zero Conversion Intent)': {
    type: 'EXACT',
    keywords: [
      'qr code',
      'qr codes',
      'qr',
    ],
  },
};

/**
 * Bidding guardrails — suggestions only.
 * The automation layer must NEVER set or modify bids.
 */
const biddingSuggestions = {
  note: 'These are planning suggestions only. The automation layer must never set or modify bids.',
  recommended_strategy: 'Maximize conversions with target CPA',
  purchase_cpa_test_target: '$25–35',
  purchase_cpa_mature_target: '$15–25',
  pricing_checkout_micro_conversion_cpa: '$3–8',
  exact_high_intent_cpc_ceiling: '$1.25–1.75',
  phrase_high_intent_cpc_ceiling: '$0.75–1.25',
  competitor_exact_cpc_ceiling: '$0.75–1.50',
  split_testing_cpc_ceiling: '$0.50–1.25',
  recommended_daily_budget: '$15–20 (start conservative)',
  recommended_daily_budget_mature: '$30–50 (after 30+ conversions)',
};

module.exports = {
  campaign,
  adGroups,
  rsa,
  negatives,
  biddingSuggestions,
};
