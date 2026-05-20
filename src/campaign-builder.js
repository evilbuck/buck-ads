/**
 * @module campaign-builder
 * @description Campaign builder with safety-first guards.
 *              Validates campaign specs, enforces PAUSED status, refuses budget/bid mutations,
 *              and provides dry-run planning and guarded live creation.
 *
 *              Safety invariants (all must be true for any mutation):
 *              1. Campaign status is PAUSED
 *              2. No budget creation or modification
 *              3. No bid or bidding strategy changes
 *              4. Keywords are EXACT or PHRASE match only
 *              5. RSA headlines ≤ 30 chars, descriptions ≤ 90 chars
 *              6. All final URLs are valid HTTPS
 */

const {
  resources,
  enums,
  toMicros,
  ResourceNames,
} = require('google-ads-api');
const { createCustomer, getCustomerId } = require('./client');

// ─── Constants ───────────────────────────────────────────────────────────────

const RSA_HEADLINE_MAX = 30;
const RSA_DESCRIPTION_MAX = 90;
const ALLOWED_MATCH_TYPES = new Set(['EXACT', 'PHRASE']);
const REQUIRED_SPEC_KEYS = ['campaign', 'adGroups', 'rsa', 'negatives'];

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a campaign spec has all required fields.
 * @param {object} spec - Campaign spec to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSpecStructure(spec) {
  const errors = [];

  for (const key of REQUIRED_SPEC_KEYS) {
    if (!spec[key]) {
      errors.push(`Missing required spec key: ${key}`);
    }
  }

  if (spec.campaign) {
    if (!spec.campaign.name) {
      errors.push('Campaign name is required');
    }
    if (spec.campaign.status !== 'PAUSED') {
      errors.push(
        `Campaign status must be PAUSED, got: ${spec.campaign.status}. ` +
          'Automation must never create enabled campaigns.'
      );
    }
  }

  if (spec.adGroups) {
    for (const [i, ag] of spec.adGroups.entries()) {
      if (!ag.name) errors.push(`Ad group ${i}: name is required`);
      if (!ag.final_url) errors.push(`Ad group ${i}: final_url is required`);
      if (!ag.keywords) {
        errors.push(`Ad group ${i}: keywords are required`);
      } else {
        if (!ag.keywords.exact?.length && !ag.keywords.phrase?.length) {
          errors.push(`Ad group ${i}: must have at least one keyword`);
        }
      }
    }
  }

  if (spec.rsa) {
    if (!spec.rsa.headlines?.length) {
      errors.push('RSA must have at least one headline');
    }
    if (!spec.rsa.descriptions?.length) {
      errors.push('RSA must have at least one description');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate RSA character limits.
 * @param {object} rsa - RSA spec with headlines and descriptions arrays
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateRSA(rsa) {
  const errors = [];
  const warnings = [];

  // Headlines: need at least 3, max 15
  if (rsa.headlines) {
    if (rsa.headlines.length < 3) {
      warnings.push(
        `RSA has ${rsa.headlines.length} headlines; Google recommends 10-15 for best performance`
      );
    }
    for (const [i, h] of rsa.headlines.entries()) {
      if (h.length > RSA_HEADLINE_MAX) {
        errors.push(
          `Headline ${i + 1} (${h.length} chars) exceeds ${RSA_HEADLINE_MAX}: "${h}"`
        );
      }
    }
  }

  // Descriptions: need at least 2, max 4
  if (rsa.descriptions) {
    if (rsa.descriptions.length < 2) {
      warnings.push(
        `RSA has ${rsa.descriptions.length} descriptions; minimum is 2`
      );
    }
    for (const [i, d] of rsa.descriptions.entries()) {
      if (d.length > RSA_DESCRIPTION_MAX) {
        errors.push(
          `Description ${i + 1} (${d.length} chars) exceeds ${RSA_DESCRIPTION_MAX}: "${d}"`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate keyword match types are EXACT or PHRASE only.
 * @param {object} adGroups - Array of ad group specs
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateKeywordMatchTypes(adGroups) {
  const errors = [];

  for (const ag of adGroups) {
    for (const [matchType, keywords] of Object.entries(ag.keywords || {})) {
      const normalizedType = matchType.toUpperCase();
      if (!ALLOWED_MATCH_TYPES.has(normalizedType)) {
        errors.push(
          `Ad group "${ag.name}": match type "${matchType}" is not allowed. ` +
            `Only EXACT and PHRASE are permitted.`
        );
      }
      if (!Array.isArray(keywords)) {
        errors.push(`Ad group "${ag.name}": ${matchType} keywords must be an array`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate final URLs are HTTPS and well-formed.
 * @param {object} adGroups - Array of ad group specs
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFinalUrls(adGroups) {
  const errors = [];
  const urlPattern = /^https:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}(\/[^\s]*)?$/;

  for (const ag of adGroups) {
    if (!urlPattern.test(ag.final_url)) {
      errors.push(
        `Ad group "${ag.name}": invalid final_url "${ag.final_url}". Must be HTTPS.`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Safety Guards ───────────────────────────────────────────────────────────

/**
 * Block any operation that would modify budget.
 * @param {object} operation - Mutation operation to check
 * @throws {Error} If operation targets budget
 */
function guardBudget(operation) {
  if (
    operation.entity === 'campaign_budget' ||
    (operation.resource?.resource_name && operation.resource.resource_name.includes('campaignBudgets'))
  ) {
    throw new SafetyError(
      'BUDGET_BLOCKED',
      'Budget creation or modification is blocked by safety policy. ' +
        'Set the budget manually in the Google Ads UI before enabling the campaign.'
    );
  }
}

/**
 * Block any operation that would modify bids or bidding strategy.
 * @param {object} operation - Mutation operation to check
 * @throws {Error} If operation targets bids/bidding
 */
function guardBidding(operation) {
  const resource = operation.resource || {};
  if (
    resource.bidding_strategy ||
    resource.bidding_strategy_config ||
    resource.manual_cpc ||
    resource.manual_cpm ||
    resource.manual_cpv ||
    resource.target_cpa ||
    resource.target_roas ||
    resource.maximize_conversions ||
    resource.maximize_conversion_value ||
    resource.cpc_bid_micros ||
    resource.cpm_bid_micros ||
    resource.cpv_bid_micros ||
    resource.effective_cpc_bid_micros
  ) {
    throw new SafetyError(
      'BIDDING_BLOCKED',
      'Bid or bidding strategy modification is blocked by safety policy. ' +
        'Bidding suggestions are documented in the spec for human reference only.'
    );
  }
}

/**
 * Block any operation that would create an ENABLED campaign.
 * @param {object} operation - Mutation operation to check
 * @throws {Error} If operation creates an enabled campaign
 */
function guardEnabledCampaign(operation) {
  if (operation.entity === 'campaign' && operation.operation === 'create') {
    const status = operation.resource?.status;
    // Google Ads API enum values are numbers (PAUSED = 3, ENABLED = 2)
    // We accept both the string 'PAUSED' and the enum value 3
    const isPausedString = status === 'PAUSED';
    const isPausedEnum = status === 3; // enums.CampaignStatus.PAUSED
    if (status !== undefined && !isPausedString && !isPausedEnum) {
      throw new SafetyError(
        'ENABLED_CAMPAIGN_BLOCKED',
        `Campaign creation with status "${status}" is blocked. ` +
          'All campaigns must be created as PAUSED. Enable manually in Google Ads UI.'
      );
    }
  }
}

/**
 * Run all safety guards against an array of operations.
 * @param {Array} operations - Mutation operations to check
 * @throws {SafetyError} On first guard violation
 */
function runSafetyGuards(operations) {
  for (const op of operations) {
    guardBudget(op);
    guardBidding(op);
    guardEnabledCampaign(op);
  }
}

/**
 * Custom error class for safety guard violations.
 */
class SafetyError extends Error {
  /**
   * @param {string} code - Error code (BUDGET_BLOCKED, BIDDING_BLOCKED, ENABLED_CAMPAIGN_BLOCKED)
   * @param {string} message - Human-readable description
   */
  constructor(code, message) {
    super(message);
    this.name = 'SafetyError';
    this.code = code;
  }
}

// ─── Mutation Builder ────────────────────────────────────────────────────────

/**
 * Build mutation operations from a validated spec.
 * Campaign budget is NOT included — it must be created manually in the UI.
 * All resources reference a temporary budget resource name that must be replaced
 * before live creation.
 *
 * @param {object} spec - Validated campaign spec
 * @param {string} customerId - Google Ads customer ID (numeric)
 * @param {object} [options] - Build options
 * @param {string} [options.budgetResourceName] - Existing budget resource name
 * @returns {{ operations: Array, manifest: object }}
 */
function buildMutations(spec, customerId, options = {}) {
  const operations = [];
  const manifest = {
    campaign: null,
    adGroups: [],
    keywords: [],
    negatives: [],
    rsa: null,
    warnings: [],
  };

  // Campaign
  const campaignResourceName = ResourceNames.campaign(customerId, '-1');
  const campaignOp = {
    entity: 'campaign',
    operation: 'create',
    resource: {
      resource_name: campaignResourceName,
      name: spec.campaign.name,
      advertising_channel_type:
        enums.AdvertisingChannelType[spec.campaign.advertising_channel_type] ??
        enums.AdvertisingChannelType.SEARCH,
      status: enums.CampaignStatus.PAUSED,
      campaign_budget: options.budgetResourceName || null,
      network_settings: {
        target_google_search: spec.campaign.network_settings.target_google_search,
        target_search_network: spec.campaign.network_settings.target_search_network ?? false,
        target_content_network: spec.campaign.network_settings.target_content_network ?? false,
        target_partner_search_network:
          spec.campaign.network_settings.target_partner_search_network ?? false,
      },
    },
  };
  operations.push(campaignOp);
  manifest.campaign = {
    name: spec.campaign.name,
    status: 'PAUSED',
    resource_name: '(temporary: -1)',
  };

  if (!options.budgetResourceName) {
    manifest.warnings.push(
      'No budget resource name provided. Campaign will be created without a budget. ' +
        'Set budget in Google Ads UI before enabling.'
    );
  }

  // Ad groups
  for (const [agIndex, ag] of spec.adGroups.entries()) {
    const tempId = `-${agIndex + 2}`;
    const adGroupResourceName = ResourceNames.adGroup(customerId, tempId);

    operations.push({
      entity: 'ad_group',
      operation: 'create',
      resource: {
        resource_name: adGroupResourceName,
        name: ag.name,
        campaign: campaignResourceName,
        status: enums.AdGroupStatus.PAUSED,
      },
    });

    manifest.adGroups.push({
      name: ag.name,
      resource_name: `(temporary: ${tempId})`,
      final_url: ag.final_url,
    });

    // Keywords
    for (const [matchType, keywords] of Object.entries(ag.keywords)) {
      const enumKey = matchType.toUpperCase() === 'EXACT' ? 'EXACT' : 'PHRASE';
      for (const kwText of keywords) {
        operations.push({
          entity: 'ad_group_criterion',
          operation: 'create',
          resource: {
            ad_group: adGroupResourceName,
            keyword: {
              text: kwText,
              match_type: enums.KeywordMatchType[enumKey],
            },
            status: enums.AdGroupCriterionStatus.PAUSED,
          },
        });

        manifest.keywords.push({
          ad_group: ag.name,
          text: kwText,
          match_type: enumKey,
        });
      }
    }

    // RSA per ad group
    const adResource = new resources.Ad({
      responsive_search_ad: {
        headlines: spec.rsa.headlines.map((text) => ({ text })),
        descriptions: spec.rsa.descriptions.map((text) => ({ text })),
        path1: ag.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 15),
      },
      final_urls: [ag.final_url],
      type: enums.AdType.RESPONSIVE_SEARCH_AD,
    });

    operations.push({
      entity: 'ad_group_ad',
      operation: 'create',
      resource: {
        ad_group: adGroupResourceName,
        ad: adResource,
        status: enums.AdGroupAdStatus.PAUSED,
      },
    });

    manifest.rsa = {
      headlines_count: spec.rsa.headlines.length,
      descriptions_count: spec.rsa.descriptions.length,
      final_url: ag.final_url,
    };
  }

  // Campaign-level negative keywords
  for (const [theme, group] of Object.entries(spec.negatives)) {
    const enumKey = group.type?.toUpperCase() === 'EXACT' ? 'EXACT' : 'PHRASE';
    for (const negKw of group.keywords) {
      operations.push({
        entity: 'campaign_criterion',
        operation: 'create',
        resource: {
          campaign: campaignResourceName,
          negative: true,
          keyword: {
            text: negKw,
            match_type: enums.KeywordMatchType[enumKey],
          },
        },
      });

      manifest.negatives.push({
        theme,
        text: negKw,
        match_type: enumKey,
      });
    }
  }

  return { operations, manifest };
}

// ─── Plan Command ────────────────────────────────────────────────────────────

/**
 * Generate a dry-run plan from a campaign spec.
 * Performs validation, builds mutations, runs safety guards, and returns a plan.
 * No live API calls are made.
 *
 * @param {object} spec - Campaign spec
 * @returns {{ valid: boolean, plan: object, errors: string[], warnings: string[] }}
 */
function planCampaign(spec) {
  const allErrors = [];
  const allWarnings = [];

  // 1. Validate structure
  const structResult = validateSpecStructure(spec);
  allErrors.push(...structResult.errors);

  // 2. Validate RSA
  const rsaResult = validateRSA(spec.rsa || {});
  allErrors.push(...rsaResult.errors);
  allWarnings.push(...rsaResult.warnings);

  // 3. Validate keyword match types
  const kwResult = validateKeywordMatchTypes(spec.adGroups || []);
  allErrors.push(...kwResult.errors);

  // 4. Validate final URLs
  const urlResult = validateFinalUrls(spec.adGroups || []);
  allErrors.push(...urlResult.errors);

  if (allErrors.length > 0) {
    return {
      valid: false,
      plan: null,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  // 5. Build mutations (with a placeholder customer ID for dry-run)
  const customerId = '0000000000';
  const { operations, manifest } = buildMutations(spec, customerId);

  // 6. Run safety guards (non-throwing version)
  const safetyErrors = [];
  for (const op of operations) {
    try {
      guardBudget(op);
      guardBidding(op);
      guardEnabledCampaign(op);
    } catch (err) {
      if (err instanceof SafetyError) {
        safetyErrors.push(`[${err.code}] ${err.message}`);
      }
    }
  }

  if (safetyErrors.length > 0) {
    return {
      valid: false,
      plan: null,
      errors: [...allErrors, ...safetyErrors],
      warnings: allWarnings,
    };
  }

  return {
    valid: true,
    plan: {
      campaign: manifest.campaign,
      ad_groups: manifest.adGroups,
      keywords: manifest.keywords,
      negatives: manifest.negatives,
      rsa: manifest.rsa,
      total_operations: operations.length,
      warnings: manifest.warnings,
    },
    errors: [],
    warnings: allWarnings,
  };
}

// ─── Create Command ──────────────────────────────────────────────────────────

/**
 * Create a campaign from a spec (guarded, dry-run by default).
 *
 * @param {object} spec - Campaign spec
 * @param {object} [options] - Creation options
 * @param {boolean} [options.dryRun=true] - If true, validate only without live mutation
 * @param {string} [options.budgetResourceName] - Required for live creation: existing budget resource
 * @returns {Promise<{ success: boolean, dry_run: boolean, results: object, errors: string[] }>}
 */
async function createCampaign(spec, options = {}) {
  const dryRun = options.dryRun !== false; // default true
  const errors = [];

  // 1. Plan first (validates everything)
  const planResult = planCampaign(spec);
  if (!planResult.valid) {
    return {
      success: false,
      dry_run: dryRun,
      results: null,
      errors: planResult.errors,
    };
  }

  // 2. Build real mutations
  const customerId = getCustomerId();
  if (!customerId) {
    return {
      success: false,
      dry_run: dryRun,
      results: null,
      errors: ['GOOGLE_ADS_CUSTOMER_ID not set'],
    };
  }

  const { operations, manifest } = buildMutations(spec, customerId, {
    budgetResourceName: options.budgetResourceName || null,
  });

  // 3. Run safety guards on real operations
  try {
    runSafetyGuards(operations);
  } catch (err) {
    if (err instanceof SafetyError) {
      return {
        success: false,
        dry_run: dryRun,
        results: null,
        errors: [`SAFETY GUARD: [${err.code}] ${err.message}`],
      };
    }
    throw err;
  }

  // 4. If dry-run, stop here
  if (dryRun) {
    return {
      success: true,
      dry_run: true,
      results: {
        message: 'Dry run completed. No live mutations were made.',
        manifest,
        total_operations: operations.length,
      },
      errors: [],
    };
  }

  // 5. Live creation — verify we have a budget reference
  if (!options.budgetResourceName) {
    return {
      success: false,
      dry_run: false,
      results: null,
      errors: [
        'Live creation requires a budgetResourceName. ' +
          'Create a campaign budget in Google Ads UI and provide its resource name.',
      ],
    };
  }

  // 6. Execute mutations
  const customer = createCustomer();
  const result = await customer.mutateResources(operations);

  return {
    success: true,
    dry_run: false,
    results: {
      message: 'Campaign created successfully (PAUSED).',
      resource_names: result.results || [],
      manifest,
    },
    errors: [],
  };
}

// ─── Verify Command ──────────────────────────────────────────────────────────

/**
 * Verify a campaign matches its spec.
 * Checks campaign exists, is paused, has correct settings.
 * Does NOT modify anything.
 *
 * @param {string} campaignName - Campaign name to verify
 * @param {object} [spec] - Optional spec to verify against
 * @returns {Promise<{ found: boolean, checks: object[], errors: string[] }>}
 */
async function verifyCampaign(campaignName, spec) {
  const customer = createCustomer();
  const checks = [];
  const errors = [];

  // 1. Find campaign
  let campaign;
  try {
    const campaigns = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.campaign_budget,
        campaign.network_settings
      FROM campaign
      WHERE campaign.name = '${campaignName.replace(/'/g, "\\'")}'
    `);

    if (!campaigns.length) {
      return {
        found: false,
        checks: [{ check: 'campaign_exists', passed: false, detail: 'Campaign not found' }],
        errors: [`Campaign "${campaignName}" not found`],
      };
    }

    campaign = campaigns[0].campaign;
  } catch (err) {
    return {
      found: false,
      checks: [],
      errors: [`API error: ${err.message}`],
    };
  }

  checks.push({ check: 'campaign_exists', passed: true, detail: `ID: ${campaign.id}` });

  // 2. Check paused
  const isPaused = campaign.status === 'PAUSED';
  checks.push({
    check: 'campaign_paused',
    passed: isPaused,
    detail: `Status: ${campaign.status}`,
  });

  // 3. Check search-only
  const isSearch = campaign.advertising_channel_type === 'SEARCH';
  checks.push({
    check: 'search_channel',
    passed: isSearch,
    detail: `Channel: ${campaign.advertising_channel_type}`,
  });

  // 4. Check network settings (no display/content)
  if (campaign.network_settings) {
    const ns = campaign.network_settings;
    const searchOnly = ns.target_google_search && !ns.target_content_network;
    checks.push({
      check: 'search_only_network',
      passed: searchOnly,
      detail: `Google Search: ${ns.target_google_search}, Content: ${ns.target_content_network}`,
    });
  }

  // 5. Print budget/bidding (read-only, never mutate)
  checks.push({
    check: 'budget_reference',
    passed: true,
    detail: `Budget: ${campaign.campaign_budget} (read-only, no mutation)`,
  });

  return {
    found: true,
    checks,
    errors,
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Validation
  validateSpecStructure,
  validateRSA,
  validateKeywordMatchTypes,
  validateFinalUrls,

  // Safety
  guardBudget,
  guardBidding,
  guardEnabledCampaign,
  runSafetyGuards,
  SafetyError,

  // Building
  buildMutations,

  // Commands
  planCampaign,
  createCampaign,
  verifyCampaign,
};
