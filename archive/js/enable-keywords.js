/**
 * Enable all paused keywords in a campaign
 * Usage: node enable-keywords.js [campaign-name] [--dry-run]
 */

const { createCustomer } = require('./src/client');
const { resources, enums } = require('google-ads-api');

async function enableKeywords(campaignName, dryRun = false) {
  const customer = createCustomer();

  // Find the campaign
  const campaigns = await customer.query(`
    SELECT campaign.id, campaign.name
    FROM campaign
    WHERE campaign.status IN ('ENABLED', 'PAUSED')
  `);

  const campaign = campaigns.find(c => 
    c.campaign.name.toLowerCase().includes(campaignName.toLowerCase())
  );

  if (!campaign) {
    console.error(`Campaign "${campaignName}" not found`);
    console.log('Available campaigns:', campaigns.map(c => c.campaign.name));
    process.exit(1);
  }

  console.log(`Found campaign: ${campaign.campaign.name} (ID: ${campaign.campaign.id})`);

  // Get all ad groups in this campaign
  const adGroups = await customer.query(`
    SELECT ad_group.id, ad_group.name, ad_group.status
    FROM ad_group
    WHERE campaign.id = ${campaign.campaign.id}
  `);

  console.log(`Found ${adGroups.length} ad groups\n`);

  let totalEnabled = 0;
  let totalErrors = 0;
  const criteriaToUpdate = [];

  for (const adGroup of adGroups) {
    // Get PAUSED keywords for this ad group
    const keywords = await customer.query(`
      SELECT 
        ad_group_criterion.criterion_id,
        ad_group_criterion.resource_name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status
      FROM ad_group_criterion
      WHERE ad_group.id = ${adGroup.ad_group.id}
        AND ad_group_criterion.type = 'KEYWORD'
        AND ad_group_criterion.status = PAUSED
    `);

    if (keywords.length === 0) {
      console.log(`  ${adGroup.ad_group.name}: No paused keywords`);
      continue;
    }

    console.log(`  ${adGroup.ad_group.name}: ${keywords.length} paused keywords`);

    for (const keyword of keywords) {
      const resourceName = keyword.ad_group_criterion?.resource_name;
      const text = keyword.ad_group_criterion?.keyword?.text;

      if (!resourceName) {
        console.log(`    ERROR: Missing resource_name for keyword "${text}"`);
        totalErrors++;
        continue;
      }

      const criterion = new resources.AdGroupCriterion({
        status: enums.AdGroupCriterionStatus.ENABLED,
      });
      criterion.resource_name = resourceName;

      criteriaToUpdate.push(criterion);
      console.log(`    Queued: "${text}"`);
      totalEnabled++;
    }
  }

  if (totalEnabled === 0) {
    console.log('\nNo paused keywords to enable.');
    return;
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Enabling ${totalEnabled} keywords...`);

  if (dryRun) {
    console.log('\nDry run - no changes made. Run without --dry-run to apply.');
    return;
  }

  try {
    const result = await customer.adGroupCriteria.update(criteriaToUpdate);
    console.log(`\n✅ Successfully enabled ${totalEnabled} keywords`);
    if (result.partial_failure_error) {
      console.log('Partial failures:', JSON.stringify(result.partial_failure_error, null, 2));
    }
  } catch (err) {
    console.error('Error enabling keywords:', err.message);
    process.exit(1);
  }
}

const campaignName = process.argv[2] || 'business-purchase-us';
const dryRun = process.argv.includes('--dry-run');
enableKeywords(campaignName, dryRun).catch(console.error);
