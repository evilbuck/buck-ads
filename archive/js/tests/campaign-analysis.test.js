/**
 * @module campaign-analysis.test
 * @description Unit tests for campaign readiness analysis.
 *              Tests cover normalization, deterministic checks,
 *              report shaping, and text formatting.
 */

const {
  normalizeCampaign,
  normalizeAdGroups,
  normalizeKeywords,
  normalizeAds,
  normalizeSitelinks,
  normalizeAssets,
  normalizeNegatives,
  normalizeConversionActions,
  runDeterministicChecks,
  formatTextReport,
  buildReport,
} = require('../src/campaign-analysis');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FIXTURE_CAMPAIGN_ROW = {
  campaign: {
    id: '12345',
    name: 'business-purchase-us',
    status: 'ENABLED',
    advertising_channel_type: 'SEARCH',
    serving_status: 'SERVING',
    bidding_strategy_type: 'TARGET_CPA',
    start_date: '2025-01-01',
    end_date: '2030-12-30',
  },
  metrics: {
    cost_micros: '50000000',
    clicks: '1200',
    impressions: '35000',
    all_conversions: '45',
  },
};

const FIXTURE_AD_GROUP_ROWS = [
  {
    ad_group: { id: '100', name: 'General Purchase Intent', status: 'ENABLED' },
    metrics: { cost_micros: '30000000', clicks: '800', impressions: '20000', all_conversions: '30' },
  },
  {
    ad_group: { id: '101', name: 'Brand Terms', status: 'PAUSED' },
    metrics: { cost_micros: '10000000', clicks: '200', impressions: '8000', all_conversions: '10' },
  },
  {
    ad_group: { id: '102', name: 'Competitor Terms', status: 'ENABLED' },
    metrics: { cost_micros: '10000000', clicks: '200', impressions: '7000', all_conversions: '5' },
  },
];

const FIXTURE_KEYWORD_ROWS = [
  {
    ad_group: { id: '100', name: 'General Purchase Intent' },
    ad_group_criterion: {
      keyword: { text: 'buy a business', match_type: 'BROAD' },
      quality_info: { quality_score: 7 },
      status: 'ENABLED',
    },
  },
  {
    ad_group: { id: '100', name: 'General Purchase Intent' },
    ad_group_criterion: {
      keyword: { text: 'business for sale', match_type: 'PHRASE' },
      quality_info: { quality_score: 5 },
      status: 'ENABLED',
    },
  },
  {
    ad_group: { id: '101', name: 'Brand Terms' },
    ad_group_criterion: {
      keyword: { text: 'my brand', match_type: 'EXACT' },
      quality_info: { quality_score: 8 },
      status: 'PAUSED',
    },
  },
  {
    ad_group: { id: '102', name: 'Competitor Terms' },
    ad_group_criterion: {
      keyword: { text: 'competitor name', match_type: 'EXACT' },
      quality_info: { quality_score: 3 },
      status: 'ENABLED',
    },
  },
];

const FIXTURE_AD_ROWS = [
  {
    ad_group: { id: '100', name: 'General Purchase Intent' },
    ad_group_ad: {
      ad: {
        type: 'RESPONSIVE_SEARCH_AD',
        responsive_search_ad: {
          headlines: [
            { text: 'Buy a Business Today' },
            { text: 'Business for Sale' },
            { text: 'Find Your Business' },
          ],
          descriptions: [
            { text: 'Browse listings of businesses for sale across the US.' },
            { text: 'Start your entrepreneurial journey today.' },
          ],
        },
      },
      status: 'ENABLED',
      ad_strength: 'GOOD',
      policy_summary: { policy_topic_entries: [] },
    },
  },
  {
    ad_group: { id: '101', name: 'Brand Terms' },
    ad_group_ad: {
      ad: {
        type: 'RESPONSIVE_SEARCH_AD',
        responsive_search_ad: {
          headlines: [{ text: 'Only One Headline' }],
          descriptions: [{ text: 'Only one description.' }],
        },
      },
      status: 'PAUSED',
      ad_strength: 'POOR',
      policy_summary: { policy_topic_entries: [{ topic: 'ALCOHOL' }] },
    },
  },
];

const FIXTURE_SITELINK_ROWS = [
  {
    asset: {
      id: '500',
      name: 'Sitelink 1',
      sitelink_asset: {
        link_text: 'Our Process',
        description1: 'How we work',
        description2: 'Step by step',
        final_urls: ['https://example.com/process'],
      },
    },
    campaign_asset: {
      status: 'ENABLED',
    },
  },
  {
    asset: {
      id: '501',
      name: 'Sitelink 2',
      sitelink_asset: {
        link_text: 'Testimonials',
        description1: 'What clients say',
        description2: '',
        final_urls: ['https://example.com/testimonials'],
      },
    },
    campaign_asset: {
      status: 'ENABLED',
    },
  },
];

const FIXTURE_ASSET_ROWS = [
  {
    asset: {
      id: '600',
      name: 'Callout 1',
      callout_asset: {
        callout_text: '20+ Years Experience',
      },
    },
    campaign_asset: {
      status: 'ENABLED',
      field_type: 'CALLOUT',
    },
  },
  {
    asset: {
      id: '601',
      name: 'Snippet 1',
      structured_snippet_asset: {
        header: 'Types',
        values: ['Retail', 'Service', 'Online'],
      },
    },
    campaign_asset: {
      status: 'ENABLED',
      field_type: 'STRUCTURED_SNIPPET',
    },
  },
];

const FIXTURE_NEGATIVE_ROWS = [
  {
    campaign_criterion: {
      keyword: { text: 'free', match_type: 'BROAD' },
      negative: true,
    },
  },
  {
    campaign_criterion: {
      keyword: { text: 'jobs', match_type: 'BROAD' },
      negative: true,
    },
  },
];

const FIXTURE_CONVERSION_ROWS = [
  {
    conversion_action: {
      id: '700',
      name: 'Purchase/Signup',
      status: 'ENABLED',
      category: 'PURCHASE',
      type: 'WEBPAGE',
      counting_type: 'MANY_PER_CLICK',
    },
  },
  {
    conversion_action: {
      id: '701',
      name: 'Old Lead Form',
      status: 'PAUSED',
      category: 'LEAD',
      type: 'WEBPAGE',
      counting_type: 'ONE_PER_CLICK',
    },
  },
];

// ─── Normalization Tests ────────────────────────────────────────────────────

describe('normalizeCampaign', () => {
  test('normalizes a raw campaign row', () => {
    const result = normalizeCampaign(FIXTURE_CAMPAIGN_ROW);
    expect(result).toMatchObject({
      id: '12345',
      name: 'business-purchase-us',
      status: 'ENABLED',
      channelType: 'SEARCH',
      servingStatus: 'SERVING',
      biddingStrategy: 'TARGET_CPA',
    });
    expect(result.metrics.cost).toBeCloseTo(50.0);
    expect(result.metrics.clicks).toBe(1200);
    expect(result.metrics.impressions).toBe(35000);
    expect(result.metrics.conversions).toBe(45);
  });

  test('handles null metrics gracefully', () => {
    const row = { campaign: FIXTURE_CAMPAIGN_ROW.campaign, metrics: null };
    const result = normalizeCampaign(row);
    expect(result.metrics.cost).toBe(0);
    expect(result.metrics.clicks).toBe(0);
  });

  test('handles missing campaign fields gracefully', () => {
    const row = { campaign: { id: '1', name: 'Test' }, metrics: {} };
    const result = normalizeCampaign(row);
    expect(result.status).toBe('UNKNOWN');
    expect(result.channelType).toBe('UNKNOWN');
  });
});

describe('normalizeAdGroups', () => {
  test('normalizes ad group rows with metrics', () => {
    const result = normalizeAdGroups(FIXTURE_AD_GROUP_ROWS);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      id: '100',
      name: 'General Purchase Intent',
      status: 'ENABLED',
    });
    expect(result[0].metrics.cost).toBeCloseTo(30.0);
    expect(result[1].status).toBe('PAUSED');
  });

  test('handles empty rows', () => {
    expect(normalizeAdGroups([])).toEqual([]);
  });
});

describe('normalizeKeywords', () => {
  test('normalizes keyword rows grouped by ad group', () => {
    const result = normalizeKeywords(FIXTURE_KEYWORD_ROWS);
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      text: 'buy a business',
      matchType: 'BROAD',
      status: 'ENABLED',
      qualityScore: 7,
      adGroupId: '100',
      adGroupName: 'General Purchase Intent',
    });
  });

  test('handles missing quality score', () => {
    const row = {
      ad_group: { id: '100', name: 'Test' },
      ad_group_criterion: {
        keyword: { text: 'test kw', match_type: 'BROAD' },
        quality_info: {},
        status: 'ENABLED',
      },
    };
    const result = normalizeKeywords([row]);
    expect(result[0].qualityScore).toBeNull();
  });
});

describe('normalizeAds', () => {
  test('normalizes RSA ad rows', () => {
    const result = normalizeAds(FIXTURE_AD_ROWS);
    expect(result).toHaveLength(2);

    const ad = result[0];
    expect(ad.status).toBe('ENABLED');
    expect(ad.adStrength).toBe('GOOD');
    expect(ad.type).toBe('RESPONSIVE_SEARCH_AD');
    expect(ad.headlines).toHaveLength(3);
    expect(ad.descriptions).toHaveLength(2);
    expect(ad.policyIssues).toEqual([]);
  });

  test('extracts policy issues', () => {
    const result = normalizeAds(FIXTURE_AD_ROWS);
    expect(result[1].policyIssues).toEqual(['ALCOHOL']);
  });

  test('handles non-RSA ad type', () => {
    const row = {
      ad_group: { id: '100', name: 'Test' },
      ad_group_ad: {
        ad: { type: 'EXPANDED_TEXT_AD' },
        status: 'ENABLED',
        ad_strength: 'AVERAGE',
        policy_summary: { policy_topic_entries: [] },
      },
    };
    const result = normalizeAds([row]);
    expect(result[0].headlines).toEqual([]);
    expect(result[0].descriptions).toEqual([]);
  });
});

describe('normalizeSitelinks', () => {
  test('normalizes sitelink asset rows', () => {
    const result = normalizeSitelinks(FIXTURE_SITELINK_ROWS);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: '500',
      linkText: 'Our Process',
      description1: 'How we work',
      description2: 'Step by step',
      finalUrl: 'https://example.com/process',
      status: 'ENABLED',
    });
  });
});

describe('normalizeAssets', () => {
  test('normalizes callout and snippet assets', () => {
    const result = normalizeAssets(FIXTURE_ASSET_ROWS);
    expect(result).toHaveLength(2);
    expect(result[0].fieldType).toBe('CALLOUT');
    expect(result[0].text).toBe('20+ Years Experience');
    expect(result[1].fieldType).toBe('STRUCTURED_SNIPPET');
  });
});

describe('normalizeNegatives', () => {
  test('normalizes negative keyword rows', () => {
    const result = normalizeNegatives(FIXTURE_NEGATIVE_ROWS);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      text: 'free',
      matchType: 'BROAD',
    });
  });

  test('filters out non-negative criteria', () => {
    const rows = [
      ...FIXTURE_NEGATIVE_ROWS,
      { campaign_criterion: { keyword: { text: 'positive kw', match_type: 'BROAD' }, negative: false } },
    ];
    const result = normalizeNegatives(rows);
    expect(result).toHaveLength(2);
  });
});

describe('normalizeConversionActions', () => {
  test('normalizes conversion action rows', () => {
    const result = normalizeConversionActions(FIXTURE_CONVERSION_ROWS);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: '700',
      name: 'Purchase/Signup',
      status: 'ENABLED',
      category: 'PURCHASE',
    });
    expect(result[1].status).toBe('PAUSED');
  });

  test('handles empty rows', () => {
    expect(normalizeConversionActions([])).toEqual([]);
  });
});

// ─── Deterministic Check Tests ───────────────────────────────────────────────

describe('runDeterministicChecks', () => {
  function makeReport(overrides = {}) {
    return {
      campaign: overrides.campaign === null ? null : {
        id: '12345',
        name: 'business-purchase-us',
        status: 'ENABLED',
        channelType: 'SEARCH',
        servingStatus: 'SERVING',
        biddingStrategy: 'TARGET_CPA',
        metrics: { cost: 50, clicks: 1200, impressions: 35000, conversions: 45 },
        ...(overrides.campaign || {}),
      },
      adGroups: overrides.adGroups || [
        { id: '100', name: 'AG1', status: 'ENABLED', metrics: { cost: 30, clicks: 800, impressions: 20000, conversions: 30 } },
      ],
      keywords: overrides.keywords || [
        { text: 'buy a business', matchType: 'BROAD', status: 'ENABLED', qualityScore: 7, adGroupId: '100', adGroupName: 'AG1' },
      ],
      ads: overrides.ads || [
        {
          type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', adStrength: 'GOOD',
          headlines: ['H1', 'H2', 'H3'], descriptions: ['D1', 'D2'],
          policyIssues: [], adGroupId: '100', adGroupName: 'AG1',
        },
      ],
      sitelinks: overrides.sitelinks || [
        { id: '500', linkText: 'Process', description1: 'How', description2: 'Step', finalUrl: 'https://example.com', status: 'ENABLED' },
        { id: '501', linkText: 'About', description1: '', description2: '', finalUrl: 'https://example.com/about', status: 'ENABLED' },
      ],
      assets: overrides.assets || [
        { id: '600', fieldType: 'CALLOUT', text: '20+ Years', status: 'ENABLED' },
      ],
      negatives: overrides.negatives || [
        { text: 'free', matchType: 'BROAD' },
      ],
      conversionActions: overrides.conversionActions || [
        { id: '700', name: 'Purchase', status: 'ENABLED', category: 'PURCHASE' },
      ],
    };
  }

  test('all checks pass for a healthy campaign', () => {
    const report = makeReport();
    const checks = runDeterministicChecks(report);
    const failures = checks.filter((c) => c.result === 'FAIL');
    expect(failures).toHaveLength(0);
  });

  test('FAIL: campaign not found', () => {
    const report = makeReport({ campaign: null });
    const checks = runDeterministicChecks(report);
    const found = checks.find((c) => c.check === 'campaign_found');
    expect(found.result).toBe('FAIL');
  });

  test('FAIL: campaign is paused', () => {
    const report = makeReport({ campaign: { status: 'PAUSED' } });
    const checks = runDeterministicChecks(report);
    const paused = checks.find((c) => c.check === 'campaign_status_enabled');
    expect(paused.result).toBe('FAIL');
  });

  test('WARNING: campaign not search channel', () => {
    const report = makeReport({ campaign: { channelType: 'DISPLAY' } });
    const checks = runDeterministicChecks(report);
    const channel = checks.find((c) => c.check === 'campaign_search_channel');
    expect(channel.result).toBe('WARNING');
  });

  test('FAIL: no enabled ad groups', () => {
    const report = makeReport({
      adGroups: [{ id: '100', name: 'AG1', status: 'PAUSED', metrics: { cost: 0, clicks: 0, impressions: 0, conversions: 0 } }],
    });
    const checks = runDeterministicChecks(report);
    const agCheck = checks.find((c) => c.check === 'has_enabled_ad_groups');
    expect(agCheck.result).toBe('FAIL');
  });

  test('FAIL: no enabled keywords', () => {
    const report = makeReport({
      keywords: [{ text: 'test', matchType: 'BROAD', status: 'PAUSED', qualityScore: 5, adGroupId: '100', adGroupName: 'AG1' }],
    });
    const checks = runDeterministicChecks(report);
    const kwCheck = checks.find((c) => c.check === 'has_enabled_keywords');
    expect(kwCheck.result).toBe('FAIL');
  });

  test('FAIL: no enabled RSA ads', () => {
    const report = makeReport({
      ads: [{ type: 'RESPONSIVE_SEARCH_AD', status: 'PAUSED', adStrength: 'POOR', headlines: ['H1'], descriptions: ['D1'], policyIssues: [], adGroupId: '100', adGroupName: 'AG1' }],
    });
    const checks = runDeterministicChecks(report);
    const adCheck = checks.find((c) => c.check === 'has_enabled_rsa_ads');
    expect(adCheck.result).toBe('FAIL');
  });

  test('WARNING: RSA has fewer than 3 headlines', () => {
    const report = makeReport({
      ads: [{ type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', adStrength: 'GOOD', headlines: ['H1', 'H2'], descriptions: ['D1', 'D2'], policyIssues: [], adGroupId: '100', adGroupName: 'AG1' }],
    });
    const checks = runDeterministicChecks(report);
    const rsaCheck = checks.find((c) => c.check === 'rsa_minimum_assets');
    expect(rsaCheck.result).toBe('WARNING');
  });

  test('WARNING: RSA has fewer than 2 descriptions', () => {
    const report = makeReport({
      ads: [{ type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', adStrength: 'GOOD', headlines: ['H1', 'H2', 'H3'], descriptions: ['D1'], policyIssues: [], adGroupId: '100', adGroupName: 'AG1' }],
    });
    const checks = runDeterministicChecks(report);
    const rsaCheck = checks.find((c) => c.check === 'rsa_minimum_assets');
    expect(rsaCheck.result).toBe('WARNING');
  });

  test('WARNING: fewer than 2 sitelinks', () => {
    const report = makeReport({
      sitelinks: [{ id: '500', linkText: 'Only One', description1: '', description2: '', finalUrl: 'https://example.com', status: 'ENABLED' }],
    });
    const checks = runDeterministicChecks(report);
    const sitelinkCheck = checks.find((c) => c.check === 'has_sitelinks');
    expect(sitelinkCheck.result).toBe('WARNING');
  });

  test('FAIL: no sitelinks', () => {
    const report = makeReport({ sitelinks: [] });
    const checks = runDeterministicChecks(report);
    const sitelinkCheck = checks.find((c) => c.check === 'has_sitelinks');
    expect(sitelinkCheck.result).toBe('FAIL');
  });

  test('WARNING: no other assets (callouts, snippets)', () => {
    const report = makeReport({ assets: [] });
    const checks = runDeterministicChecks(report);
    const assetCheck = checks.find((c) => c.check === 'has_other_assets');
    expect(assetCheck.result).toBe('WARNING');
  });

  test('WARNING: no negative keywords', () => {
    const report = makeReport({ negatives: [] });
    const checks = runDeterministicChecks(report);
    const negCheck = checks.find((c) => c.check === 'has_negative_keywords');
    expect(negCheck.result).toBe('WARNING');
  });

  test('WARNING: no enabled conversion actions', () => {
    const report = makeReport({
      conversionActions: [{ id: '700', name: 'Old', status: 'PAUSED', category: 'LEAD' }],
    });
    const checks = runDeterministicChecks(report);
    const convCheck = checks.find((c) => c.check === 'has_conversion_tracking');
    expect(convCheck.result).toBe('WARNING');
  });

  test('summary counts are correct', () => {
    const report = makeReport();
    const checks = runDeterministicChecks(report);
    const summary = checks.find((c) => c.check === '_summary');
    expect(summary.passCount).toBeGreaterThan(0);
    expect(summary.warnCount).toBe(0);
    expect(summary.failCount).toBe(0);
  });
});

// ─── Text Report Format Tests ────────────────────────────────────────────────

describe('formatTextReport', () => {
  test('formats a complete report as readable text', () => {
    const report = {
      campaign: {
        id: '12345', name: 'business-purchase-us', status: 'ENABLED',
        channelType: 'SEARCH', servingStatus: 'SERVING', biddingStrategy: 'TARGET_CPA',
        metrics: { cost: 50, clicks: 1200, impressions: 35000, conversions: 45 },
      },
      adGroups: [],
      keywords: [],
      ads: [],
      sitelinks: [],
      assets: [],
      negatives: [],
      conversionActions: [],
      findings: [
        { check: 'campaign_found', result: 'PASS', detail: 'Campaign found' },
        { check: 'has_enabled_keywords', result: 'FAIL', detail: 'No enabled keywords' },
      ],
    };
    const text = formatTextReport(report);
    expect(text).toContain('business-purchase-us');
    expect(text).toContain('PASS');
    expect(text).toContain('FAIL');
    expect(text).toContain('Campaign Readiness Report');
  });
});

// ─── buildReport Integration Test ───────────────────────────────────────────

describe('buildReport', () => {
  test('assembles a full report from raw query results', () => {
    const raw = {
      campaign: FIXTURE_CAMPAIGN_ROW,
      adGroups: FIXTURE_AD_GROUP_ROWS,
      keywords: FIXTURE_KEYWORD_ROWS,
      ads: FIXTURE_AD_ROWS,
      sitelinks: FIXTURE_SITELINK_ROWS,
      assets: FIXTURE_ASSET_ROWS,
      negatives: FIXTURE_NEGATIVE_ROWS,
      conversionActions: FIXTURE_CONVERSION_ROWS,
    };
    const report = buildReport(raw);
    expect(report.campaign.name).toBe('business-purchase-us');
    expect(report.adGroups).toHaveLength(3);
    expect(report.keywords).toHaveLength(4);
    expect(report.ads).toHaveLength(2);
    expect(report.sitelinks).toHaveLength(2);
    expect(report.assets).toHaveLength(2);
    expect(report.negatives).toHaveLength(2);
    expect(report.conversionActions).toHaveLength(2);
    expect(report.findings).toBeDefined();
    expect(report.findings.length).toBeGreaterThan(0);
  });

  test('handles null campaign (not found)', () => {
    const raw = {
      campaign: null,
      adGroups: [],
      keywords: [],
      ads: [],
      sitelinks: [],
      assets: [],
      negatives: [],
      conversionActions: [],
    };
    const report = buildReport(raw);
    expect(report.campaign).toBeNull();
    const found = report.findings.find((f) => f.check === 'campaign_found');
    expect(found.result).toBe('FAIL');
  });
});
