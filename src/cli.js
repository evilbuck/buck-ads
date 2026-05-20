#!/usr/bin/env node

/**
 * @module cli
 * @description Google Ads CLI for campaign management.
 *              Supports reading campaigns/search terms, adding negatives,
 *              planning campaigns, creating from specs (dry-run by default),
 *              and verifying campaigns against specs.
 *
 * @example
 *   node src/cli.js plan-campaign --template=qrpro-bofu-us
 *   node src/cli.js create-campaign-from-spec --template=qrpro-bofu-us --dry-run
 *   node src/cli.js verify-campaign --campaign="Campaign Name"
 */

const path = require('path');
const fs = require('fs');

// Load .env
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { createCustomer, getCustomerId } = require('./client');
const { planCampaign, createCampaign, verifyCampaign } = require('./campaign-builder');

// ─── Spec Registry ────────────────────────────────────────────────────────────

/**
 * Load all .js spec files from a directory.
 * @param {string} specsDir - Path to specs directory
 * @returns {{ [name]: () => object }} Map of template name → lazy spec loader
 */
function loadSpecsFromDir(specsDir) {
  const templates = {};

  if (!fs.existsSync(specsDir)) {
    return templates;
  }

  const files = fs.readdirSync(specsDir);
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const templateName = file.replace(/\.js$/, '');
    try {
      const specPath = path.resolve(specsDir, file);
      // Lazy-load: store the path, resolve on demand
      templates[templateName] = () => require(specPath);
    } catch (err) {
      console.warn(`  ⚠️  Failed to load spec "${file}": ${err.message}`);
    }
  }

  return templates;
}

/**
 * Build the template registry from the configured specs directory.
 * @param {string} [specsDirOverride] - Optional override from --specs-dir flag
 * @returns {{ [name]: () => object }}
 */
function buildTemplateRegistry(specsDirOverride) {
  const defaultSpecsDir = path.resolve(__dirname, '..', 'specs');
  const specsDir = specsDirOverride || defaultSpecsDir;
  return loadSpecsFromDir(specsDir);
}

// ─── Commands ────────────────────────────────────────────────────────────────

function cmdCampaigns() {
  const customer = createCustomer();

  customer
    .query(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.all_conversions
      FROM campaign
      ORDER BY metrics.cost_micros DESC
    `)
    .then((rows) => {
      if (!rows.length) {
        console.log('No campaigns found.');
        return;
      }

      console.log(`\n${'Campaign Name'.padEnd(50)} ${'Status'.padEnd(12)} ${'Cost'.padStart(10)} ${'Clicks'.padStart(8)} ${'Conv'.padStart(6)}`);
      console.log('-'.repeat(90));

      for (const row of rows) {
        const c = row.campaign;
        const cost = row.metrics ? `$${(Number(row.metrics.cost_micros) / 1_000_000).toFixed(2)}` : '$0.00';
        const clicks = row.metrics?.clicks || '0';
        const conv = row.metrics?.all_conversions || '0';

        console.log(
          `${(c.name || '').substring(0, 48).padEnd(50)} ${String(c.status || '').padEnd(12)} ${cost.padStart(10)} ${String(clicks).padStart(8)} ${String(conv).padStart(6)}`
        );
      }
      console.log();
    })
    .catch((err) => {
      console.error('Error fetching campaigns:', err.message);
      process.exit(1);
    });
}

function cmdSearchTerms(args) {
  const customer = createCustomer();
  const minCost = args['min-cost'] ? parseFloat(args['min-cost']) : 0;
  const campaignFilter = args.campaign
    ? `AND campaign.name LIKE '%${args.campaign}%'`
    : '';

  customer
    .query(`
      SELECT
        campaign.name,
        ad_group.name,
        search_term_view.search_term,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions,
        metrics.all_conversions
      FROM search_term_view
      WHERE segments.date DURING LAST_30_DAYS
        AND metrics.cost_micros > ${(minCost * 1_000_000).toFixed(0)}
        ${campaignFilter}
      ORDER BY metrics.cost_micros DESC
      LIMIT 200
    `)
    .then((rows) => {
      if (!rows.length) {
        console.log('No search terms found matching criteria.');
        return;
      }

      console.log(`\n${'Search Term'.padEnd(40)} ${'Campaign'.padEnd(30)} ${'Cost'.padStart(10)} ${'Clicks'.padStart(8)} ${'Conv'.padStart(6)}`);
      console.log('-'.repeat(100));

      const wasteCandidates = [];

      for (const row of rows) {
        const term = row.search_term_view?.search_term || '';
        const campaignName = row.campaign?.name || '';
        const cost = row.metrics ? Number(row.metrics.cost_micros) / 1_000_000 : 0;
        const clicks = row.metrics?.clicks || 0;
        const conv = row.metrics?.all_conversions || 0;

        console.log(
          `${term.substring(0, 38).padEnd(40)} ${campaignName.substring(0, 28).padEnd(30)} $${cost.toFixed(2).padStart(9)} ${String(clicks).padStart(8)} ${String(conv).padStart(6)}`
        );

        if (conv === 0 && cost > 0.5) {
          wasteCandidates.push(term);
        }
      }

      if (wasteCandidates.length) {
        console.log(`\n⚠️  ${wasteCandidates.length} terms with cost > $0.50 and 0 conversions:`);
        for (const t of wasteCandidates) {
          console.log(`   - ${t}`);
        }
        console.log('\nConsider adding these as negative keywords.');
      }
      console.log();
    })
    .catch((err) => {
      console.error('Error fetching search terms:', err.message);
      process.exit(1);
    });
}

function cmdAddNegatives(args) {
  const campaignName = args.campaign;
  const keywordsRaw = args.keywords;
  const matchType = (args['match-type'] || 'BROAD').toUpperCase();

  if (!campaignName || !keywordsRaw) {
    console.error('Usage: add-negatives --campaign="Name" --keywords="kw1,kw2" [--match-type=BROAD|PHRASE|EXACT]');
    process.exit(1);
  }

  const keywords = keywordsRaw.split(',').map((k) => k.trim());
  const customer = createCustomer();

  // Find campaign ID
  customer
    .query(`
      SELECT campaign.id, campaign.name
      FROM campaign
      WHERE campaign.name = '${campaignName.replace(/'/g, "\\'")}'
    `)
    .then((rows) => {
      if (!rows.length) {
        throw new Error(`Campaign "${campaignName}" not found`);
      }

      const campaignId = rows[0].campaign.id;
      const campaignResource = `customers/${getCustomerId()}/campaigns/${campaignId}`;

      // Check existing negatives to avoid duplicates
      return customer
        .query(`
          SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
          FROM campaign_criterion
          WHERE campaign_criterion.campaign = '${campaignResource}'
            AND campaign_criterion.negative = TRUE
            AND campaign_criterion.type = 'KEYWORD'
        `)
        .then((existing) => {
          const existingSet = new Set(
            existing.map((r) => `${(r.campaign_criterion?.keyword?.text || '').toLowerCase()}:${r.campaign_criterion?.keyword?.match_type}`)
          );

          const newKeywords = keywords.filter((kw) => {
            const key = `${kw.toLowerCase()}:${matchType}`;
            if (existingSet.has(key)) {
              console.log(`  Skipping duplicate: "${kw}" (${matchType})`);
              return false;
            }
            return true;
          });

          if (!newKeywords.length) {
            console.log('All keywords already exist as negatives. No changes made.');
            return;
          }

          const { enums } = require('google-ads-api');
          const operations = newKeywords.map((kw) => ({
            entity: 'campaign_criterion',
            operation: 'create',
            resource: {
              campaign: campaignResource,
              negative: true,
              keyword: {
                text: kw,
                match_type: enums.KeywordMatchType[matchType],
              },
            },
          }));

          return customer.mutateResources(operations).then((result) => {
            console.log(`✅ Added ${newKeywords.length} negative keyword(s) to "${campaignName}":`);
            for (const kw of newKeywords) {
              console.log(`   - "${kw}" (${matchType})`);
            }
          });
        });
    })
    .catch((err) => {
      console.error('Error adding negatives:', err.message);
      process.exit(1);
    });
}

function cmdPlanCampaign(args, TEMPLATES) {
  const templateName = args.template;
  if (!templateName || !TEMPLATES[templateName]) {
    console.error(`Unknown template: ${templateName || '(none)'}`);
    console.error(`Available templates: ${Object.keys(TEMPLATES).join(', ') || '(none — add .js files to specs/)'}`);
    process.exit(1);
  }

  const spec = TEMPLATES[templateName]();
  const result = planCampaign(spec);

  if (!result.valid) {
    console.error('\n❌ Spec validation failed:');
    for (const err of result.errors) {
      console.error(`   - ${err}`);
    }
    process.exit(1);
  }

  console.log('\n✅ Campaign plan validated successfully.\n');

  const plan = result.plan;
  console.log(`📋 Campaign: ${plan.campaign.name}`);
  console.log(`   Status: ${plan.campaign.status}`);
  console.log(`   Total operations: ${plan.total_operations}`);
  console.log();

  console.log('📦 Ad Groups:');
  for (const ag of plan.ad_groups) {
    console.log(`   • ${ag.name} → ${ag.final_url}`);
  }
  console.log();

  console.log('🔑 Keywords:');
  const byType = {};
  for (const kw of plan.keywords) {
    const key = `${kw.ad_group} (${kw.match_type})`;
    byType[key] = byType[key] || [];
    byType[key].push(kw.text);
  }
  for (const [group, kws] of Object.entries(byType)) {
    console.log(`   ${group}:`);
    for (const kw of kws) {
      console.log(`     - [${kw}]`);
    }
  }
  console.log();

  console.log('🚫 Negative Keywords:');
  const byTheme = {};
  for (const neg of plan.negatives) {
    byTheme[neg.theme] = byTheme[neg.theme] || [];
    byTheme[neg.theme].push(neg);
  }
  for (const [theme, negs] of Object.entries(byTheme)) {
    console.log(`   ${theme}:`);
    for (const neg of negs) {
      console.log(`     - "${neg.text}" (${neg.match_type})`);
    }
  }
  console.log();

  console.log('📝 RSA Assets:');
  console.log(`   Headlines: ${plan.rsa.headlines_count}`);
  console.log(`   Descriptions: ${plan.rsa.descriptions_count}`);
  console.log();

  if (plan.warnings?.length) {
    console.log('⚠️  Warnings:');
    for (const w of plan.warnings) {
      console.log(`   - ${w}`);
    }
    console.log();
  }

  if (result.warnings?.length) {
    for (const w of result.warnings) {
      console.log(`   - ${w}`);
    }
    console.log();
  }

  console.log('This is a dry-run plan. No live mutations were made.');
  console.log('To create, run: node src/cli.js create-campaign-from-spec --template=' + templateName + ' --dry-run');
}

async function cmdCreateCampaign(args, TEMPLATES) {
  const templateName = args.template;
  const dryRun = args['dry-run'] !== 'false'; // default true

  if (!templateName || !TEMPLATES[templateName]) {
    console.error(`Unknown template: ${templateName || '(none)'}`);
    console.error(`Available templates: ${Object.keys(TEMPLATES).join(', ') || '(none — add .js files to specs/)'}`);
    process.exit(1);
  }

  const spec = TEMPLATES[templateName]();

  try {
    const result = await createCampaign(spec, {
      dryRun,
      budgetResourceName: args['budget-resource'],
    });

    if (!result.success) {
      console.error('\n❌ Campaign creation failed:');
      for (const err of result.errors) {
        console.error(`   - ${err}`);
      }
      process.exit(1);
    }

    if (result.dry_run) {
      console.log('\n✅ Dry run completed. No live mutations were made.\n');
      console.log('📋 Manifest:');
      console.log(`   Campaign: ${result.results.manifest.campaign?.name}`);
      console.log(`   Ad Groups: ${result.results.manifest.adGroups?.length}`);
      console.log(`   Keywords: ${result.results.manifest.keywords?.length}`);
      console.log(`   Negatives: ${result.results.manifest.negatives?.length}`);
      console.log(`   Total operations: ${result.results.total_operations}`);
      console.log();
      console.log('To create live, provide a budget resource name:');
      console.log(`  node src/cli.js create-campaign-from-spec --template=${templateName} --budget-resource=customers/XXX/campaignBudgets/YYY`);
    } else {
      console.log('\n✅ Campaign created successfully (PAUSED).\n');
      console.log('Resources created:');
      for (const rn of result.results.resource_names || []) {
        console.log(`   - ${rn}`);
      }
      console.log();
      console.log('⚠️  Campaign is PAUSED. Enable manually in Google Ads UI after setting budget.');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

async function cmdVerifyCampaign(args) {
  const campaignName = args.campaign;
  if (!campaignName) {
    console.error('Usage: verify-campaign --campaign="Campaign Name"');
    process.exit(1);
  }

  try {
    const result = await verifyCampaign(campaignName);
    console.log(`\nCampaign: "${campaignName}"\n`);

    if (!result.found) {
      console.log('❌ Campaign not found.');
      if (result.errors.length) {
        for (const err of result.errors) {
          console.error(`   - ${err}`);
        }
      }
      process.exit(1);
    }

    for (const check of result.checks) {
      const icon = check.passed ? '✅' : '❌';
      console.log(`  ${icon} ${check.check}: ${check.detail}`);
    }
    console.log();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

function cmdNegatives(args) {
  const campaignName = args.campaign;
  if (!campaignName) {
    console.error('Usage: negatives --campaign="Campaign Name"');
    process.exit(1);
  }

  const customer = createCustomer();

  // First resolve campaign name to resource name
  customer
    .query(`
      SELECT campaign.id, campaign.name
      FROM campaign
      WHERE campaign.name = '${campaignName.replace(/'/g, "\\'")}'
    `)
    .then((rows) => {
      if (!rows.length) {
        throw new Error(`Campaign "${campaignName}" not found`);
      }
      const campaignResource = `customers/${getCustomerId()}/campaigns/${rows[0].campaign.id}`;
      return customer.query(`
        SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type, campaign_criterion.negative
        FROM campaign_criterion
        WHERE campaign_criterion.campaign = '${campaignResource}'
          AND campaign_criterion.type = 'KEYWORD'
      `);
    })
    .then((rows) => {
      const negatives = rows.filter((r) => r.campaign_criterion?.negative);
      if (!negatives.length) {
        console.log(`No negative keywords found for "${campaignName}".`);
        return;
      }

      console.log(`\nNegative keywords for "${campaignName}":`);
      for (const row of negatives) {
        const kw = row.campaign_criterion?.keyword;
        console.log(`  - "${kw?.text}" (${kw?.match_type})`);
      }
      console.log();
    })
    .catch((err) => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

// ─── CLI Parser ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=');
      args[key] = valueParts.join('=') || true;
    }
  }
  return args;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const command = process.argv[2];
const args = parseArgs(process.argv);

// Build template registry from --specs-dir flag or default ./specs
const specsDirOverride = args['specs-dir'] || null;
const TEMPLATES = buildTemplateRegistry(specsDirOverride);

switch (command) {
  case 'campaigns':
    cmdCampaigns();
    break;
  case 'search-terms':
    cmdSearchTerms(args);
    break;
  case 'negatives':
    cmdNegatives(args);
    break;
  case 'add-negatives':
    cmdAddNegatives(args);
    break;
  case 'plan-campaign':
    cmdPlanCampaign(args, TEMPLATES);
    break;
  case 'create-campaign-from-spec':
    cmdCreateCampaign(args, TEMPLATES);
    break;
  case 'verify-campaign':
    cmdVerifyCampaign(args);
    break;
  default:
    console.log('buck-ads — Google Ads CLI\n');
    console.log('Commands:');
    console.log('  campaigns                         List all campaigns with metrics');
    console.log('  search-terms [--min-cost=X] [--campaign=X]  Get search terms report');
    console.log('  negatives --campaign="Name"        List negative keywords');
    console.log('  add-negatives --campaign="Name" --keywords="kw1,kw2"  Add negatives');
    console.log('  plan-campaign --template=X [--specs-dir=Path]  Validate and plan a campaign spec');
    console.log('  create-campaign-from-spec --template=X [--dry-run] [--budget-resource=X]');
    console.log('                                    Create campaign from spec (dry-run by default)');
    console.log('  verify-campaign --campaign="Name"  Verify campaign settings');
    console.log();
    console.log('Options:');
    console.log('  --specs-dir=Path   Load specs from a custom directory (default: ./specs)');
    console.log();
    const available = Object.keys(TEMPLATES);
    if (available.length) {
      console.log('Templates:', available.join(', '));
    } else {
      console.log('No templates found. Add .js spec files to the specs directory.');
    }
    break;
}
