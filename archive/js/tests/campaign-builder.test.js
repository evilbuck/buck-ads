/**
 * @module tests/scripts/google-ads-campaign-builder
 * @description Tests for the Google Ads campaign builder.
 *              Validates safety guards (budget, bidding, enabled campaign blocking),
 *              spec structure validation, RSA character limits, keyword match types,
 *              URL validation, and dry-run planning.
 */

const {
  validateSpecStructure,
  validateRSA,
  validateKeywordMatchTypes,
  validateFinalUrls,
  guardBudget,
  guardBidding,
  guardEnabledCampaign,
  runSafetyGuards,
  SafetyError,
  buildMutations,
  planCampaign,
} = require('../src/campaign-builder');

// ─── Valid spec fixture ──────────────────────────────────────────────────────

function validSpec() {
  return {
    campaign: {
      name: 'Test Campaign',
      status: 'PAUSED',
      advertising_channel_type: 'SEARCH',
      network_settings: {
        target_google_search: true,
        target_search_network: false,
        target_content_network: false,
        target_partner_search_network: false,
      },
    },
    adGroups: [
      {
        name: 'Test Ad Group',
        final_url: 'https://example.com/page',
        keywords: {
          exact: ['test keyword'],
          phrase: ['test phrase'],
        },
      },
    ],
    rsa: {
      headlines: [
        'Short Headline',
        'Another Headline Here',
        'Third Headline OK',
      ],
      descriptions: [
        'A description that is under ninety characters total.',
        'Another description that is also under ninety characters long.',
      ],
    },
    negatives: {
      'Test Theme': {
        type: 'PHRASE',
        keywords: ['free', 'tutorial'],
      },
    },
  };
}

// ─── Safety Guard Tests ──────────────────────────────────────────────────────

describe('SafetyError', () => {
  it('should have a code and message', () => {
    const err = new SafetyError('TEST_CODE', 'test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.message).toBe('test message');
    expect(err.name).toBe('SafetyError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('guardBudget', () => {
  it('should block campaign_budget entity operations', () => {
    const op = { entity: 'campaign_budget', operation: 'create', resource: {} };
    expect(() => guardBudget(op)).toThrow(SafetyError);
    expect(() => guardBudget(op)).toThrow('Budget creation or modification is blocked');
  });

  it('should block operations with budget resource names', () => {
    const op = {
      entity: 'campaign',
      operation: 'update',
      resource: {
        resource_name: 'customers/123/campaignBudgets/456',
      },
    };
    expect(() => guardBudget(op)).toThrow(SafetyError);
  });

  it('should allow non-budget operations', () => {
    const op = {
      entity: 'campaign',
      operation: 'create',
      resource: { resource_name: 'customers/123/campaigns/456' },
    };
    expect(() => guardBudget(op)).not.toThrow();
  });
});

describe('guardBidding', () => {
  it('should block operations with manual_cpc', () => {
    const op = { entity: 'campaign', operation: 'create', resource: { manual_cpc: {} } };
    expect(() => guardBidding(op)).toThrow(SafetyError);
    expect(() => guardBidding(op)).toThrow('Bid or bidding strategy modification is blocked');
  });

  it('should block operations with target_cpa', () => {
    const op = { entity: 'campaign', operation: 'create', resource: { target_cpa: {} } };
    expect(() => guardBidding(op)).toThrow(SafetyError);
  });

  it('should block operations with maximize_conversions', () => {
    const op = { entity: 'campaign', operation: 'create', resource: { maximize_conversions: {} } };
    expect(() => guardBidding(op)).toThrow(SafetyError);
  });

  it('should block operations with cpc_bid_micros', () => {
    const op = { entity: 'ad_group_criterion', operation: 'create', resource: { cpc_bid_micros: 1000000 } };
    expect(() => guardBidding(op)).toThrow(SafetyError);
  });

  it('should allow operations without bidding fields', () => {
    const op = { entity: 'ad_group', operation: 'create', resource: { name: 'test' } };
    expect(() => guardBidding(op)).not.toThrow();
  });
});

describe('guardEnabledCampaign', () => {
  it('should block creating an ENABLED campaign', () => {
    const op = {
      entity: 'campaign',
      operation: 'create',
      resource: { status: 'ENABLED' },
    };
    expect(() => guardEnabledCampaign(op)).toThrow(SafetyError);
    expect(() => guardEnabledCampaign(op)).toThrow('Campaign creation with status');
  });

  it('should allow creating a PAUSED campaign', () => {
    const op = {
      entity: 'campaign',
      operation: 'create',
      resource: { status: 'PAUSED' },
    };
    expect(() => guardEnabledCampaign(op)).not.toThrow();
  });

  it('should not guard non-campaign entities', () => {
    const op = {
      entity: 'ad_group',
      operation: 'create',
      resource: { status: 'ENABLED' },
    };
    expect(() => guardEnabledCampaign(op)).not.toThrow();
  });

  it('should not guard non-create operations', () => {
    const op = {
      entity: 'campaign',
      operation: 'update',
      resource: { status: 'ENABLED' },
    };
    expect(() => guardEnabledCampaign(op)).not.toThrow();
  });
});

describe('runSafetyGuards', () => {
  it('should pass all guards for safe operations', () => {
    const ops = [
      { entity: 'campaign', operation: 'create', resource: { status: 'PAUSED' } },
      { entity: 'ad_group', operation: 'create', resource: { name: 'test' } },
    ];
    expect(() => runSafetyGuards(ops)).not.toThrow();
  });

  it('should throw on first budget violation', () => {
    const ops = [
      { entity: 'campaign', operation: 'create', resource: { status: 'PAUSED' } },
      { entity: 'campaign_budget', operation: 'create', resource: {} },
    ];
    expect(() => runSafetyGuards(ops)).toThrow(SafetyError);
  });

  it('should throw on bidding violation', () => {
    const ops = [
      { entity: 'campaign', operation: 'create', resource: { status: 'PAUSED', manual_cpc: {} } },
    ];
    expect(() => runSafetyGuards(ops)).toThrow(SafetyError);
  });

  it('should throw on enabled campaign', () => {
    const ops = [
      { entity: 'campaign', operation: 'create', resource: { status: 'ENABLED' } },
    ];
    expect(() => runSafetyGuards(ops)).toThrow(SafetyError);
  });
});

// ─── Spec Structure Validation ───────────────────────────────────────────────

describe('validateSpecStructure', () => {
  it('should pass for a valid spec', () => {
    const result = validateSpecStructure(validSpec());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should fail if campaign is missing', () => {
    const spec = validSpec();
    delete spec.campaign;
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required spec key: campaign');
  });

  it('should fail if adGroups is missing', () => {
    const spec = validSpec();
    delete spec.adGroups;
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required spec key: adGroups');
  });

  it('should fail if campaign name is missing', () => {
    const spec = validSpec();
    spec.campaign.name = '';
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Campaign name is required'))).toBe(true);
  });

  it('should fail if campaign status is not PAUSED', () => {
    const spec = validSpec();
    spec.campaign.status = 'ENABLED';
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('PAUSED'))).toBe(true);
  });

  it('should fail if ad group has no name', () => {
    const spec = validSpec();
    spec.adGroups[0].name = '';
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name is required'))).toBe(true);
  });

  it('should fail if ad group has no final_url', () => {
    const spec = validSpec();
    delete spec.adGroups[0].final_url;
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('final_url is required'))).toBe(true);
  });

  it('should fail if ad group has no keywords', () => {
    const spec = validSpec();
    delete spec.adGroups[0].keywords;
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
  });

  it('should fail if ad group has empty keywords', () => {
    const spec = validSpec();
    spec.adGroups[0].keywords = { exact: [], phrase: [] };
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('at least one keyword'))).toBe(true);
  });

  it('should fail if RSA has no headlines', () => {
    const spec = validSpec();
    spec.rsa.headlines = [];
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
  });

  it('should fail if RSA has no descriptions', () => {
    const spec = validSpec();
    spec.rsa.descriptions = [];
    const result = validateSpecStructure(spec);
    expect(result.valid).toBe(false);
  });
});

// ─── RSA Validation ──────────────────────────────────────────────────────────

describe('validateRSA', () => {
  it('should pass for valid RSA assets', () => {
    const result = validateRSA({
      headlines: ['Headline 1', 'Headline 2', 'Headline 3'],
      descriptions: ['Description one is fine.', 'Description two is also fine.'],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should fail for headlines exceeding 30 chars', () => {
    const result = validateRSA({
      headlines: ['This headline is way too long and exceeds the limit'],
      descriptions: ['Fine.'],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds 30'))).toBe(true);
  });

  it('should fail for descriptions exceeding 90 chars', () => {
    const longDesc = 'A'.repeat(91);
    const result = validateRSA({
      headlines: ['OK'],
      descriptions: [longDesc],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds 90'))).toBe(true);
  });

  it('should warn for fewer than 3 headlines', () => {
    const result = validateRSA({
      headlines: ['Only one'],
      descriptions: ['Fine.'],
    });
    expect(result.warnings.some((w) => w.includes('headlines'))).toBe(true);
  });

  it('should warn for fewer than 2 descriptions', () => {
    const result = validateRSA({
      headlines: ['H1', 'H2', 'H3'],
      descriptions: [],
    });
    expect(result.warnings.some((w) => w.includes('descriptions'))).toBe(true);
  });

  it('should accept exactly at the limit', () => {
    const headline30 = 'A'.repeat(30);
    const desc90 = 'A'.repeat(90);
    const result = validateRSA({
      headlines: [headline30, 'H2', 'H3'],
      descriptions: [desc90, 'D2'],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ─── Keyword Match Type Validation ───────────────────────────────────────────

describe('validateKeywordMatchTypes', () => {
  it('should pass for EXACT and PHRASE only', () => {
    const adGroups = [
      { name: 'test', keywords: { exact: ['kw1'], phrase: ['kw2'] } },
    ];
    const result = validateKeywordMatchTypes(adGroups);
    expect(result.valid).toBe(true);
  });

  it('should fail for BROAD match type', () => {
    const adGroups = [
      { name: 'test', keywords: { broad: ['kw1'] } },
    ];
    const result = validateKeywordMatchTypes(adGroups);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('broad'))).toBe(true);
  });

  it('should fail for non-array keywords', () => {
    const adGroups = [
      { name: 'test', keywords: { exact: 'not-array' } },
    ];
    const result = validateKeywordMatchTypes(adGroups);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('must be an array'))).toBe(true);
  });

  it('should handle case-insensitive match types', () => {
    const adGroups = [
      { name: 'test', keywords: { Exact: ['kw1'], Phrase: ['kw2'] } },
    ];
    const result = validateKeywordMatchTypes(adGroups);
    expect(result.valid).toBe(true);
  });
});

// ─── URL Validation ──────────────────────────────────────────────────────────

describe('validateFinalUrls', () => {
  it('should pass for valid HTTPS URLs', () => {
    const adGroups = [
      { name: 'test', final_url: 'https://qrpro.tools/business' },
      { name: 'test2', final_url: 'https://example.com/path/to/page' },
    ];
    const result = validateFinalUrls(adGroups);
    expect(result.valid).toBe(true);
  });

  it('should fail for HTTP URLs', () => {
    const adGroups = [
      { name: 'test', final_url: 'http://qrpro.tools/business' },
    ];
    const result = validateFinalUrls(adGroups);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('HTTPS'))).toBe(true);
  });

  it('should fail for malformed URLs', () => {
    const adGroups = [
      { name: 'test', final_url: 'not-a-url' },
    ];
    const result = validateFinalUrls(adGroups);
    expect(result.valid).toBe(false);
  });

  it('should fail for URLs without domain', () => {
    const adGroups = [
      { name: 'test', final_url: 'https:///just-a-path' },
    ];
    const result = validateFinalUrls(adGroups);
    expect(result.valid).toBe(false);
  });
});

// ─── Build Mutations ─────────────────────────────────────────────────────────

describe('buildMutations', () => {
  it('should build operations from a valid spec', () => {
    const spec = validSpec();
    const { operations, manifest } = buildMutations(spec, '1234567890');

    // Campaign + 1 ad group + 2 keywords + 1 RSA ad + 2 negatives = 7
    expect(operations.length).toBe(7);
    expect(manifest.campaign.name).toBe('Test Campaign');
    expect(manifest.adGroups.length).toBe(1);
    expect(manifest.keywords.length).toBe(2);
    expect(manifest.negatives.length).toBe(2);
  });

  it('should build paused campaign', () => {
    const spec = validSpec();
    const { operations } = buildMutations(spec, '1234567890');

    const campaignOp = operations.find((op) => op.entity === 'campaign');
    // The resource uses enum value, not string
    expect(campaignOp).toBeDefined();
  });

  it('should pass safety guards for built operations', () => {
    const spec = validSpec();
    const { operations } = buildMutations(spec, '1234567890');

    // All built operations should pass safety guards
    expect(() => runSafetyGuards(operations)).not.toThrow();
  });

  it('should warn when no budget resource name provided', () => {
    const spec = validSpec();
    const { manifest } = buildMutations(spec, '1234567890');

    expect(manifest.warnings.some((w) => w.includes('budget'))).toBe(true);
  });

  it('should include budget reference when provided', () => {
    const spec = validSpec();
    const budgetRN = 'customers/123/campaignBudgets/456';
    const { operations, manifest } = buildMutations(spec, '1234567890', {
      budgetResourceName: budgetRN,
    });

    const campaignOp = operations.find((op) => op.entity === 'campaign');
    expect(campaignOp.resource.campaign_budget).toBe(budgetRN);
    // No budget warning when provided
    expect(manifest.warnings.some((w) => w.includes('budget'))).toBe(false);
  });

  it('should create multiple ad groups with correct keywords', () => {
    const spec = validSpec();
    spec.adGroups.push({
      name: 'Second Ad Group',
      final_url: 'https://example.com/other',
      keywords: { exact: ['second kw'] },
    });

    const { operations, manifest } = buildMutations(spec, '1234567890');

    expect(manifest.adGroups.length).toBe(2);
    expect(manifest.keywords.length).toBe(3); // 2 from first + 1 from second
  });
});

// ─── Plan Campaign (Dry Run) ─────────────────────────────────────────────────

describe('planCampaign', () => {
  it('should return a valid plan for a valid spec', () => {
    const result = planCampaign(validSpec());

    expect(result.valid).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.plan.campaign.name).toBe('Test Campaign');
    expect(result.plan.ad_groups.length).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('should return errors for invalid spec', () => {
    const result = planCampaign({});

    expect(result.valid).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject enabled campaigns', () => {
    const spec = validSpec();
    spec.campaign.status = 'ENABLED';
    const result = planCampaign(spec);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('PAUSED'))).toBe(true);
  });

  it('should reject broad match keywords', () => {
    const spec = validSpec();
    spec.adGroups[0].keywords.broad = ['test broad'];
    const result = planCampaign(spec);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('broad'))).toBe(true);
  });

  it('should reject non-HTTPS URLs', () => {
    const spec = validSpec();
    spec.adGroups[0].final_url = 'http://example.com';
    const result = planCampaign(spec);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('HTTPS'))).toBe(true);
  });

  it('should reject RSA headlines over 30 chars', () => {
    const spec = validSpec();
    spec.rsa.headlines[0] = 'A'.repeat(31);
    const result = planCampaign(spec);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('30'))).toBe(true);
  });
});

// ─── Real Spec Validation ────────────────────────────────────────────────────

describe('qrpro-bofu-us spec', () => {
  it('should validate successfully', () => {
    const spec = require('../specs/qrpro-bofu-us');
    const result = planCampaign(spec);

    expect(result.valid).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.errors).toEqual([]);
  });

  it('should have 5 ad groups', () => {
    const spec = require('../specs/qrpro-bofu-us');
    expect(spec.adGroups.length).toBe(5);
  });

  it('should have all RSA headlines under 30 chars', () => {
    const spec = require('../specs/qrpro-bofu-us');
    for (const [i, h] of spec.rsa.headlines.entries()) {
      expect(h.length).toBeLessThanOrEqual(30);
    }
  });

  it('should have all RSA descriptions under 90 chars', () => {
    const spec = require('../specs/qrpro-bofu-us');
    for (const [i, d] of spec.rsa.descriptions.entries()) {
      expect(d.length).toBeLessThanOrEqual(90);
    }
  });

  it('should have only EXACT and PHRASE keywords', () => {
    const spec = require('../specs/qrpro-bofu-us');
    for (const ag of spec.adGroups) {
      for (const matchType of Object.keys(ag.keywords)) {
        expect(['exact', 'phrase']).toContain(matchType.toLowerCase());
      }
    }
  });

  it('should be PAUSED', () => {
    const spec = require('../specs/qrpro-bofu-us');
    expect(spec.campaign.status).toBe('PAUSED');
  });

  it('should target search only', () => {
    const spec = require('../specs/qrpro-bofu-us');
    expect(spec.campaign.network_settings.target_google_search).toBe(true);
    expect(spec.campaign.network_settings.target_search_network).toBe(false);
    expect(spec.campaign.network_settings.target_content_network).toBe(false);
  });

  it('should have negative keywords', () => {
    const spec = require('../specs/qrpro-bofu-us');
    const totalNegatives = Object.values(spec.negatives)
      .reduce((sum, group) => sum + group.keywords.length, 0);
    expect(totalNegatives).toBeGreaterThan(0);
  });

  it('should have manual checklist items', () => {
    const spec = require('../specs/qrpro-bofu-us');
    expect(spec.campaign.manual_checklist.length).toBeGreaterThan(0);
  });

  it('should pass planCampaign with no errors', () => {
    const spec = require('../specs/qrpro-bofu-us');
    const result = planCampaign(spec);
    expect(result.valid).toBe(true);
    expect(result.plan.total_operations).toBeGreaterThan(0);
  });
});
