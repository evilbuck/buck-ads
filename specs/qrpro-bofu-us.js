/**
 * @module google-ads/specs/qrpro-bofu-us
 * @description Declarative campaign specification for the QRPro BoFu US campaign.
 *              This spec is consumed by plan-campaign and create-campaign-from-spec commands.
 *              It defines campaign settings, ad groups, keywords, negative keywords,
 *              RSA assets, final URLs, and location/language settings.
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
  name: 'Search | BoFu | Dynamic QR + Analytics | US',
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
    // Presence only — don't target people "interested in" the US
    presence_only: true,
  },
  language_targets: {
    // English (language criterion ID 1000)
    languages: [1000],
  },
  conversion_action_name: 'manual_event_PURCHASE',
  manual_checklist: [
    'Set campaign budget in Google Ads UI before enabling',
    'Verify conversion action fires correctly before enabling',
    'Confirm conversion value is not stuck at $1',
    'Add micro-conversions (pricing view, begin checkout) if not present',
    'Do not broaden match types until conversion data exists',
    'Expand to CA/UK/AU/NZ only after US shows conversion signal',
  ],
};

/**
 * Ad groups with keywords and landing pages.
 * Keywords use exact ([kw]) and phrase ("kw") match only.
 */
const adGroups = [
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
      ],
      phrase: [
        'qr codes you can edit',
        'change qr code destination',
        'update qr code after printing',
      ],
    },
  },
  {
    name: 'QR Tracking / Analytics',
    final_url: `${BASE_URL}/qr-code-analytics`,
    keywords: {
      exact: [
        'qr code analytics',
        'qr code tracking',
        'qr code scan tracking',
        'qr code tracking software',
        'qr code analytics software',
      ],
      phrase: [
        'track qr code scans',
        'qr code campaign tracking',
        'qr code with analytics',
        'qr scan analytics',
      ],
    },
  },
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
      ],
      phrase: [
        'qr code marketing',
        'qr code campaign',
        'qr code for marketing campaign',
        'qr code with logo generator',
      ],
    },
  },
  {
    name: 'Bulk / Batch QR Codes',
    final_url: `${BASE_URL}/business/pricing`,
    keywords: {
      exact: [
        'bulk qr code generator',
        'batch qr code generator',
        'csv qr code generator',
      ],
      phrase: [
        'generate qr codes in bulk',
        'bulk dynamic qr codes',
        'multiple qr code generator',
      ],
    },
  },
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
      ],
      phrase: [],
    },
  },
];

/**
 * RSA (Responsive Search Ad) assets.
 * Headlines max 30 chars, descriptions max 90 chars.
 * Validated by campaign-builder before use.
 */
const rsa = {
  headlines: [
    'Dynamic QR Codes',           // 17
    'Edit After Printing',         // 19
    'QR Code Analytics',           // 17
    'Track Every Scan',            // 16
    'Business QR Platform',        // 20
    'Bulk QR Code Generator',      // 23
    'Branded QR Codes',            // 17
    'Marketing QR Software',       // 22
    'No Reprint Needed',           // 17
    'Track Print ROI',             // 15
    'QRPro for Businesses',        // 21
    'Create Trackable QRs',        // 20
    'Editable QR Codes',           // 17
    'QR Codes With Analytics',     // 24
    'Update QR Links Anytime',     // 23
  ],
  descriptions: [
    'Create dynamic QR codes you can edit after printing. Track scans and campaign results.',
    'Built for businesses needing QR analytics, branded codes, bulk tools, and editable links.',
    'Stop guessing which flyer worked. Use QRPro to track offline-to-online traffic.',
    'Generate branded QR codes with analytics, SVG/PNG exports, and dynamic links.',
  ],
  final_url: `${BASE_URL}/business`,
};

/**
 * Negative keywords to apply at campaign level.
 * Grouped by theme for approval visibility.
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
    ],
  },
  'Non-English Leakage (US English Campaign)': {
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
    ],
  },
};

/**
 * Bidding guardrails — suggestions only.
 * The automation layer must NEVER set or modify bids.
 */
const biddingSuggestions = {
  note: 'These are planning suggestions only. The automation layer must never set or modify bids.',
  purchase_cpa_test_target: '$25–35',
  purchase_cpa_mature_target: '$15–25',
  pricing_checkout_micro_conversion_cpa: '$3–8',
  exact_high_intent_cpc_ceiling: '$1.25–1.75',
  phrase_high_intent_cpc_ceiling: '$0.75–1.25',
  competitor_exact_cpc_ceiling: '$0.75–1.50',
};

module.exports = {
  campaign,
  adGroups,
  rsa,
  negatives,
  biddingSuggestions,
};
