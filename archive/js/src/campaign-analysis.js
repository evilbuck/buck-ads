/**
 * @module campaign-analysis
 * @description Campaign readiness analysis for Google Ads.
 *              Gathers campaign data, normalizes raw API rows,
 *              runs deterministic health checks, and produces
 *              JSON/text reports for model or operator review.
 *
 *              This module is data-only — no live API calls.
 *              The caller (cli.js) is responsible for running
 *              GAQL queries and passing raw results to buildReport().
 */

// ─── GAQL Query Builders ────────────────────────────────────────────────────

/**
 * Build GAQL query for campaign basics.
 * @param {string} campaignName - Exact campaign name to match
 * @param {string} dateRange - GAQL date range (e.g. LAST_30_DAYS)
 * @returns {string}
 */
function queryCampaign(campaignName, dateRange = 'LAST_30_DAYS') {
  return `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.serving_status,
      campaign.bidding_strategy_type,
      campaign.start_date,
      campaign.end_date,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.all_conversions
    FROM campaign
    WHERE campaign.name = '${campaignName.replace(/'/g, "\\'")}'
      AND segments.date DURING ${dateRange}
  `;
}

/**
 * Build GAQL query for ad groups with metrics.
 * @param {string} campaignResource - Full campaign resource name
 * @param {string} dateRange - GAQL date range
 * @returns {string}
 */
function queryAdGroups(campaignResource, dateRange = 'LAST_30_DAYS') {
  return `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.all_conversions
    FROM ad_group
    WHERE ad_group.campaign = '${campaignResource}'
      AND segments.date DURING ${dateRange}
  `;
}

/**
 * Build GAQL query for keywords.
 * @param {string} campaignResource - Full campaign resource name
 * @returns {string}
 */
function queryKeywords(campaignResource) {
  return `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.status
    FROM ad_group_criterion
    WHERE ad_group_criterion.campaign = '${campaignResource}'
      AND ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.negative = FALSE
  `;
}

/**
 * Build GAQL query for ads (RSA).
 * @param {string} campaignResource - Full campaign resource name
 * @returns {string}
 */
function queryAds(campaignResource) {
  return `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group_ad.ad.type,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.status,
      ad_group_ad.ad_strength,
      ad_group_ad.policy_summary.policy_topic_entries
    FROM ad_group_ad
    WHERE ad_group_ad.campaign = '${campaignResource}'
  `;
}

/**
 * Build GAQL query for sitelink assets.
 * @param {string} campaignResource - Full campaign resource name
 * @returns {string}
 */
function querySitelinks(campaignResource) {
  return `
    SELECT
      asset.id,
      asset.name,
      asset.sitelink_asset.link_text,
      asset.sitelink_asset.description1,
      asset.sitelink_asset.description2,
      asset.sitelink_asset.final_urls,
      campaign_asset.status
    FROM campaign_asset
    WHERE campaign_asset.campaign = '${campaignResource}'
      AND campaign_asset.field_type = 'SITELINK'
  `;
}

/**
 * Build GAQL query for other assets (callouts, snippets, etc.).
 * @param {string} campaignResource - Full campaign resource name
 * @returns {string}
 */
function queryAssets(campaignResource) {
  return `
    SELECT
      asset.id,
      asset.name,
      asset.callout_asset.callout_text,
      asset.structured_snippet_asset.header,
      asset.structured_snippet_asset.values,
      campaign_asset.status,
      campaign_asset.field_type
    FROM campaign_asset
    WHERE campaign_asset.campaign = '${campaignResource}'
      AND campaign_asset.field_type != 'SITELINK'
  `;
}

/**
 * Build GAQL query for campaign-level negative keywords.
 * @param {string} campaignResource - Full campaign resource name
 * @returns {string}
 */
function queryNegatives(campaignResource) {
  return `
    SELECT
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign_criterion.negative
    FROM campaign_criterion
    WHERE campaign_criterion.campaign = '${campaignResource}'
      AND campaign_criterion.type = 'KEYWORD'
      AND campaign_criterion.negative = TRUE
  `;
}

/**
 * Build GAQL query for conversion actions (account-level).
 * @returns {string}
 */
function queryConversionActions() {
  return `
    SELECT
      conversion_action.id,
      conversion_action.name,
      conversion_action.status,
      conversion_action.category,
      conversion_action.type,
      conversion_action.counting_type
    FROM conversion_action
  `;
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

function microsToDollars(micros) {
  return Number(micros || 0) / 1_000_000;
}

/**
 * Normalize a raw campaign row.
 * @param {object|null} row - Raw GAQL campaign row
 * @returns {object|null}
 */
function normalizeCampaign(row) {
  if (!row) return null;
  const c = row.campaign || {};
  const m = row.metrics || {};
  return {
    id: c.id || '',
    name: c.name || '',
    status: c.status || 'UNKNOWN',
    channelType: c.advertising_channel_type || 'UNKNOWN',
    servingStatus: c.serving_status || 'UNKNOWN',
    biddingStrategy: c.bidding_strategy_type || 'UNKNOWN',
    startDate: c.start_date || '',
    endDate: c.end_date || '',
    metrics: {
      cost: microsToDollars(m.cost_micros),
      clicks: Number(m.clicks || 0),
      impressions: Number(m.impressions || 0),
      conversions: Number(m.all_conversions || 0),
    },
  };
}

/**
 * Normalize raw ad group rows.
 * @param {Array} rows - Raw GAQL ad group rows
 * @returns {Array}
 */
function normalizeAdGroups(rows) {
  if (!rows) return [];
  return rows.map((row) => {
    const ag = row.ad_group || {};
    const m = row.metrics || {};
    return {
      id: ag.id || '',
      name: ag.name || '',
      status: ag.status || 'UNKNOWN',
      metrics: {
        cost: microsToDollars(m.cost_micros),
        clicks: Number(m.clicks || 0),
        impressions: Number(m.impressions || 0),
        conversions: Number(m.all_conversions || 0),
      },
    };
  });
}

/**
 * Normalize raw keyword rows.
 * @param {Array} rows - Raw GAQL keyword rows
 * @returns {Array}
 */
function normalizeKeywords(rows) {
  if (!rows) return [];
  return rows.map((row) => {
    const ag = row.ad_group || {};
    const crit = row.ad_group_criterion || {};
    const kw = crit.keyword || {};
    const qi = crit.quality_info || {};
    return {
      text: kw.text || '',
      matchType: kw.match_type || 'UNKNOWN',
      status: crit.status || 'UNKNOWN',
      qualityScore: qi.quality_score != null ? Number(qi.quality_score) : null,
      adGroupId: ag.id || '',
      adGroupName: ag.name || '',
    };
  });
}

/**
 * Normalize raw ad rows (RSA focused).
 * @param {Array} rows - Raw GAQL ad rows
 * @returns {Array}
 */
function normalizeAds(rows) {
  if (!rows) return [];
  return rows.map((row) => {
    const ag = row.ad_group || {};
    const aga = row.ad_group_ad || {};
    const ad = aga.ad || {};
    const rsa = ad.responsive_search_ad || {};

    const headlines = Array.isArray(rsa.headlines)
      ? rsa.headlines.map((h) => (typeof h === 'object' ? h.text || '' : String(h)))
      : [];
    const descriptions = Array.isArray(rsa.descriptions)
      ? rsa.descriptions.map((d) => (typeof d === 'object' ? d.text || '' : String(d)))
      : [];

    const policyEntries = aga.policy_summary?.policy_topic_entries || [];
    const policyIssues = policyEntries.map((e) => e.topic || e);

    return {
      type: ad.type || 'UNKNOWN',
      status: aga.status || 'UNKNOWN',
      adStrength: aga.ad_strength || 'UNKNOWN',
      headlines,
      descriptions,
      policyIssues,
      adGroupId: ag.id || '',
      adGroupName: ag.name || '',
    };
  });
}

/**
 * Normalize raw sitelink asset rows.
 * @param {Array} rows - Raw GAQL sitelink rows
 * @returns {Array}
 */
function normalizeSitelinks(rows) {
  if (!rows) return [];
  return rows.map((row) => {
    const asset = row.asset || {};
    const sa = asset.sitelink_asset || {};
    const ca = row.campaign_asset || {};
    const urls = sa.final_urls || [];
    return {
      id: asset.id || '',
      linkText: sa.link_text || '',
      description1: sa.description1 || '',
      description2: sa.description2 || '',
      finalUrl: urls[0] || '',
      status: ca.status || 'UNKNOWN',
    };
  });
}

/**
 * Normalize raw non-sitelink asset rows.
 * @param {Array} rows - Raw GAQL asset rows
 * @returns {Array}
 */
function normalizeAssets(rows) {
  if (!rows) return [];
  return rows.map((row) => {
    const asset = row.asset || {};
    const ca = row.campaign_asset || {};
    const callout = asset.callout_asset || {};
    const snippet = asset.structured_snippet_asset || {};

    let text = '';
    if (callout.callout_text) {
      text = callout.callout_text;
    } else if (snippet.header) {
      text = `${snippet.header}: ${(snippet.values || []).join(', ')}`;
    }

    return {
      id: asset.id || '',
      name: asset.name || '',
      fieldType: ca.field_type || 'UNKNOWN',
      text,
      status: ca.status || 'UNKNOWN',
    };
  });
}

/**
 * Normalize raw negative keyword rows.
 * @param {Array} rows - Raw GAQL negative keyword rows
 * @returns {Array}
 */
function normalizeNegatives(rows) {
  if (!rows) return [];
  return rows.filter((r) => r.campaign_criterion?.negative).map((row) => {
    const kw = row.campaign_criterion?.keyword || {};
    return {
      text: kw.text || '',
      matchType: kw.match_type || 'UNKNOWN',
    };
  });
}

/**
 * Normalize raw conversion action rows.
 * @param {Array} rows - Raw GAQL conversion action rows
 * @returns {Array}
 */
function normalizeConversionActions(rows) {
  if (!rows) return [];
  return rows.map((row) => {
    const ca = row.conversion_action || {};
    return {
      id: ca.id || '',
      name: ca.name || '',
      status: ca.status || 'UNKNOWN',
      category: ca.category || 'UNKNOWN',
      type: ca.type || 'UNKNOWN',
      countingType: ca.counting_type || 'UNKNOWN',
    };
  });
}

// ─── Deterministic Checks ───────────────────────────────────────────────────

/**
 * Run deterministic readiness checks against a normalized report.
 * @param {object} report - Normalized report object
 * @returns {Array<{check: string, result: string, detail: string}>}
 */
function runDeterministicChecks(report) {
  const findings = [];

  // Campaign found
  if (!report.campaign) {
    findings.push({ check: 'campaign_found', result: 'FAIL', detail: 'Campaign not found' });
    // Add summary and return early — nothing else to check
    findings.push(makeSummary(findings));
    return findings;
  }
  findings.push({ check: 'campaign_found', result: 'PASS', detail: `Campaign "${report.campaign.name}" found` });

  // Campaign status
  if (report.campaign.status === 'ENABLED') {
    findings.push({ check: 'campaign_status_enabled', result: 'PASS', detail: `Campaign status: ${report.campaign.status}` });
  } else {
    findings.push({ check: 'campaign_status_enabled', result: 'FAIL', detail: `Campaign status: ${report.campaign.status}` });
  }

  // Search channel
  if (report.campaign.channelType === 'SEARCH') {
    findings.push({ check: 'campaign_search_channel', result: 'PASS', detail: `Channel: ${report.campaign.channelType}` });
  } else {
    findings.push({ check: 'campaign_search_channel', result: 'WARNING', detail: `Channel: ${report.campaign.channelType} (expected SEARCH)` });
  }

  // Enabled ad groups
  const enabledAdGroups = report.adGroups.filter((ag) => ag.status === 'ENABLED');
  if (enabledAdGroups.length > 0) {
    findings.push({ check: 'has_enabled_ad_groups', result: 'PASS', detail: `${enabledAdGroups.length} enabled ad group(s) out of ${report.adGroups.length}` });
  } else {
    findings.push({ check: 'has_enabled_ad_groups', result: 'FAIL', detail: 'No enabled ad groups' });
  }

  // Enabled keywords
  const enabledKeywords = report.keywords.filter((kw) => kw.status === 'ENABLED');
  if (enabledKeywords.length > 0) {
    findings.push({ check: 'has_enabled_keywords', result: 'PASS', detail: `${enabledKeywords.length} enabled keyword(s)` });
  } else {
    findings.push({ check: 'has_enabled_keywords', result: 'FAIL', detail: 'No enabled keywords' });
  }

  // Enabled RSA ads
  const enabledRSA = report.ads.filter((ad) => ad.status === 'ENABLED' && ad.type === 'RESPONSIVE_SEARCH_AD');
  if (enabledRSA.length > 0) {
    findings.push({ check: 'has_enabled_rsa_ads', result: 'PASS', detail: `${enabledRSA.length} enabled RSA ad(s)` });
  } else {
    findings.push({ check: 'has_enabled_rsa_ads', result: 'FAIL', detail: 'No enabled RSA ads' });
  }

  // RSA minimum assets
  const rsaAssetIssues = [];
  for (const ad of enabledRSA) {
    if (ad.headlines.length < 3) rsaAssetIssues.push(`${ad.adGroupName}: ${ad.headlines.length} headline(s)`);
    if (ad.descriptions.length < 2) rsaAssetIssues.push(`${ad.adGroupName}: ${ad.descriptions.length} description(s)`);
  }
  if (rsaAssetIssues.length === 0 && enabledRSA.length > 0) {
    findings.push({ check: 'rsa_minimum_assets', result: 'PASS', detail: 'All enabled RSAs have ≥ 3 headlines and ≥ 2 descriptions' });
  } else if (rsaAssetIssues.length > 0) {
    findings.push({ check: 'rsa_minimum_assets', result: 'WARNING', detail: `RSA asset gaps: ${rsaAssetIssues.join('; ')}` });
  } else {
    findings.push({ check: 'rsa_minimum_assets', result: 'WARNING', detail: 'No enabled RSAs to check' });
  }

  // Sitelinks
  const enabledSitelinks = report.sitelinks.filter((s) => s.status === 'ENABLED');
  if (enabledSitelinks.length >= 2) {
    findings.push({ check: 'has_sitelinks', result: 'PASS', detail: `${enabledSitelinks.length} enabled sitelink(s)` });
  } else if (enabledSitelinks.length === 1) {
    findings.push({ check: 'has_sitelinks', result: 'WARNING', detail: 'Only 1 sitelink (recommended: ≥ 2)' });
  } else {
    findings.push({ check: 'has_sitelinks', result: 'FAIL', detail: 'No enabled sitelinks' });
  }

  // Other assets
  const enabledAssets = report.assets.filter((a) => a.status === 'ENABLED');
  if (enabledAssets.length > 0) {
    findings.push({ check: 'has_other_assets', result: 'PASS', detail: `${enabledAssets.length} other asset(s) (callouts, snippets, etc.)` });
  } else {
    findings.push({ check: 'has_other_assets', result: 'WARNING', detail: 'No other assets (callouts, snippets, etc.)' });
  }

  // Negative keywords
  if (report.negatives.length > 0) {
    findings.push({ check: 'has_negative_keywords', result: 'PASS', detail: `${report.negatives.length} negative keyword(s)` });
  } else {
    findings.push({ check: 'has_negative_keywords', result: 'WARNING', detail: 'No negative keywords configured' });
  }

  // Conversion tracking
  const enabledConversions = report.conversionActions.filter((ca) => ca.status === 'ENABLED');
  if (enabledConversions.length > 0) {
    findings.push({ check: 'has_conversion_tracking', result: 'PASS', detail: `${enabledConversions.length} enabled conversion action(s)` });
  } else {
    findings.push({ check: 'has_conversion_tracking', result: 'WARNING', detail: 'No enabled conversion actions (note: conversion actions are account-level, not campaign-scoped)' });
  }

  findings.push(makeSummary(findings));
  return findings;
}

function makeSummary(findings) {
  const checks = findings.filter((f) => f.check !== '_summary');
  return {
    check: '_summary',
    result: 'INFO',
    detail: `${checks.length} checks: ${checks.filter((c) => c.result === 'PASS').length} pass, ${checks.filter((c) => c.result === 'WARNING').length} warning(s), ${checks.filter((c) => c.result === 'FAIL').length} fail(s)`,
    passCount: checks.filter((c) => c.result === 'PASS').length,
    warnCount: checks.filter((c) => c.result === 'WARNING').length,
    failCount: checks.filter((c) => c.result === 'FAIL').length,
  };
}

// ─── Report Builder ─────────────────────────────────────────────────────────

/**
 * Build a normalized report from raw query results.
 * @param {object} raw - Raw query results from GAQL queries
 * @param {object} raw.campaign - Campaign row (single)
 * @param {Array} raw.adGroups - Ad group rows
 * @param {Array} raw.keywords - Keyword rows
 * @param {Array} raw.ads - Ad rows
 * @param {Array} raw.sitelinks - Sitelink rows
 * @param {Array} raw.assets - Other asset rows
 * @param {Array} raw.negatives - Negative keyword rows
 * @param {Array} raw.conversionActions - Conversion action rows
 * @returns {object} Normalized report with findings
 */
function buildReport(raw) {
  const campaign = normalizeCampaign(raw.campaign);
  const adGroups = normalizeAdGroups(raw.adGroups);
  const keywords = normalizeKeywords(raw.keywords);
  const ads = normalizeAds(raw.ads);
  const sitelinks = normalizeSitelinks(raw.sitelinks);
  const assets = normalizeAssets(raw.assets);
  const negatives = normalizeNegatives(raw.negatives);
  const conversionActions = normalizeConversionActions(raw.conversionActions);

  const report = {
    campaign,
    adGroups,
    keywords,
    ads,
    sitelinks,
    assets,
    negatives,
    conversionActions,
  };

  report.findings = runDeterministicChecks(report);
  return report;
}

// ─── Text Formatter ─────────────────────────────────────────────────────────

/**
 * Format a report as human-readable text.
 * @param {object} report - Normalized report with findings
 * @returns {string}
 */
function formatTextReport(report) {
  const lines = [];

  lines.push('═══════════════════════════════════════════════');
  lines.push('  Campaign Readiness Report');
  lines.push('═══════════════════════════════════════════════');
  lines.push('');

  if (!report.campaign) {
    lines.push('❌ Campaign not found.');
    return lines.join('\n');
  }

  const c = report.campaign;
  lines.push(`Campaign:   ${c.name}`);
  lines.push(`Status:     ${c.status}`);
  lines.push(`Channel:    ${c.channelType}`);
  lines.push(`Serving:    ${c.servingStatus}`);
  lines.push(`Bidding:    ${c.biddingStrategy}`);
  lines.push(`Cost:       $${c.metrics.cost.toFixed(2)}`);
  lines.push(`Clicks:     ${c.metrics.clicks}`);
  lines.push(`Impr:       ${c.metrics.impressions}`);
  lines.push(`Convs:      ${c.metrics.conversions}`);
  lines.push('');

  // Ad Groups
  lines.push(`── Ad Groups (${report.adGroups.length}) ──`);
  for (const ag of report.adGroups) {
    const icon = ag.status === 'ENABLED' ? '●' : '○';
    lines.push(`  ${icon} ${ag.name} [${ag.status}] — $${ag.metrics.cost.toFixed(2)}, ${ag.metrics.clicks} clicks, ${ag.metrics.conversions} conv`);
  }
  lines.push('');

  // Keywords
  lines.push(`── Keywords (${report.keywords.length}) ──`);
  for (const kw of report.keywords) {
    const icon = kw.status === 'ENABLED' ? '●' : '○';
    const qs = kw.qualityScore != null ? ` QS:${kw.qualityScore}` : '';
    lines.push(`  ${icon} [${kw.matchType}] "${kw.text}"${qs} (${kw.adGroupName})`);
  }
  lines.push('');

  // Ads
  lines.push(`── Ads (${report.ads.length}) ──`);
  for (const ad of report.ads) {
    const icon = ad.status === 'ENABLED' ? '●' : '○';
    lines.push(`  ${icon} ${ad.type} [${ad.status}] strength:${ad.adStrength} (${ad.adGroupName})`);
    if (ad.headlines.length) lines.push(`     Headlines: ${ad.headlines.join(' | ')}`);
    if (ad.descriptions.length) lines.push(`     Descriptions: ${ad.descriptions.join(' | ')}`);
    if (ad.policyIssues.length) lines.push(`     ⚠️  Policy issues: ${ad.policyIssues.join(', ')}`);
  }
  lines.push('');

  // Sitelinks
  lines.push(`── Sitelinks (${report.sitelinks.length}) ──`);
  for (const sl of report.sitelinks) {
    const icon = sl.status === 'ENABLED' ? '●' : '○';
    lines.push(`  ${icon} ${sl.linkText} → ${sl.finalUrl} [${sl.status}]`);
    if (sl.description1) lines.push(`     ${sl.description1}`);
    if (sl.description2) lines.push(`     ${sl.description2}`);
  }
  lines.push('');

  // Other Assets
  lines.push(`── Other Assets (${report.assets.length}) ──`);
  for (const a of report.assets) {
    const icon = a.status === 'ENABLED' ? '●' : '○';
    lines.push(`  ${icon} [${a.fieldType}] ${a.text} [${a.status}]`);
  }
  lines.push('');

  // Negatives
  lines.push(`── Negative Keywords (${report.negatives.length}) ──`);
  for (const neg of report.negatives) {
    lines.push(`  🚫 [${neg.matchType}] "${neg.text}"`);
  }
  lines.push('');

  // Conversion Actions
  lines.push(`── Conversion Actions (${report.conversionActions.length}) ──`);
  for (const ca of report.conversionActions) {
    const icon = ca.status === 'ENABLED' ? '●' : '○';
    lines.push(`  ${icon} ${ca.name} [${ca.status}] (${ca.category})`);
  }
  lines.push('');

  // Findings
  lines.push('── Readiness Checks ──');
  for (const f of report.findings) {
    if (f.check === '_summary') continue;
    const icon = f.result === 'PASS' ? '✅' : f.result === 'WARNING' ? '⚠️' : '❌';
    lines.push(`  ${icon} ${f.result}: ${f.check} — ${f.detail}`);
  }
  lines.push('');

  // Summary
  const summary = report.findings.find((f) => f.check === '_summary');
  if (summary) {
    lines.push(`── Summary ──`);
    lines.push(`  ${summary.detail}`);
    if (summary.failCount > 0) {
      lines.push('  ❌ Campaign is NOT READY for deployment.');
    } else if (summary.warnCount > 0) {
      lines.push('  ⚠️  Campaign has warnings — review before deployment.');
    } else {
      lines.push('  ✅ All deterministic checks passed.');
    }
  }

  lines.push('');
  lines.push('Note: Conversion actions are account-level, not campaign-scoped.');
  lines.push('Note: Subjective analysis (ad quality, keyword coverage) requires model review.');

  return lines.join('\n');
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Query builders
  queryCampaign,
  queryAdGroups,
  queryKeywords,
  queryAds,
  querySitelinks,
  queryAssets,
  queryNegatives,
  queryConversionActions,
  // Normalizers
  normalizeCampaign,
  normalizeAdGroups,
  normalizeKeywords,
  normalizeAds,
  normalizeSitelinks,
  normalizeAssets,
  normalizeNegatives,
  normalizeConversionActions,
  // Checks and formatters
  runDeterministicChecks,
  buildReport,
  formatTextReport,
};
