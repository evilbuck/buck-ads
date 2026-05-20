/**
 * @module scripts/google-ads/restructure-business-purchase-us
 * @description Restructures the existing business-purchase-us campaign:
 *   1. Adds missing negative keywords (22 new)
 *   2. Creates 6 new ad groups segmented by purchase intent (all PAUSED)
 *   3. Adds ~77 EXACT/PHRASE keywords to each ad group
 *   4. Creates new RSA ads per group with split-testing-led copy
 *   5. Pauses the old "small business focused" ad group (35 broad keywords)
 *
 *   Does NOT change budget or unpause the campaign.
 *
 *   Usage: node scripts/google-ads/restructure-business-purchase-us.js [--dry-run]
 */

const { enums, resources } = require('google-ads-api');
const { createCustomer, getCustomerId } = require('../src/client');

const DRY_RUN = process.argv.includes('--dry-run');
const BASE_URL = 'https://qrpro.tools';
const CAMPAIGN_NAME = 'business-purchase-us';
const OLD_AD_GROUP_ID = '200050668207';

function log(msg) { console.log(`[${DRY_RUN ? 'DRY-RUN' : 'LIVE'}] ${msg}`); }
function logSuccess(msg) { console.log(`  ✅ ${msg}`); }
function logSkip(msg) { console.log(`  ⏭️  ${msg}`); }

// ─── Config ─────────────────────────────────────────────────────────────────

const NEW_NEGATIVES = [
  { text: 'me qr', type: 'PHRASE' },
  { text: 'create qr code', type: 'PHRASE' },
  { text: 'qr code create', type: 'PHRASE' },
  { text: 'text to qr', type: 'PHRASE' },
  { text: 'qr code', type: 'EXACT' },
  { text: 'qr', type: 'EXACT' },
  { text: 'cod qr', type: 'PHRASE' },
  { text: 'dr code', type: 'PHRASE' },
  { text: 'spotify qr', type: 'PHRASE' },
  { text: 'whatsapp qr', type: 'PHRASE' },
  { text: 'vcard qr', type: 'PHRASE' },
  { text: 'qr code wifi', type: 'PHRASE' },
  { text: 'wifi qr code', type: 'PHRASE' },
  { text: 'instagram qr', type: 'PHRASE' },
  { text: 'facebook qr', type: 'PHRASE' },
  { text: 'svg qr code', type: 'PHRASE' },
  { text: 'png qr code', type: 'PHRASE' },
  { text: 'qr code api', type: 'PHRASE' },
  { text: 'qr code javascript', type: 'PHRASE' },
  { text: 'qr code python', type: 'PHRASE' },
  { text: 'qr code open source', type: 'PHRASE' },
  { text: 'test_negative_keyword', type: 'PHRASE' },
];

const AD_GROUPS = [
  {
    name: 'Dynamic / Editable QR Codes',
    final_url: `${BASE_URL}/dynamic-qr-codes`,
    keywords: {
      exact: ['dynamic qr code','dynamic qr codes','dynamic qr code generator','editable qr code','editable qr codes','trackable qr code generator','trackable qr codes','qr code you can edit','changeable qr code'],
      phrase: ['qr codes you can edit','change qr code destination','update qr code after printing','edit qr code without reprinting','qr code that can be changed','redirect qr code to new url'],
    },
    rsa: {
      headlines: ['Edit QR After Printing','Dynamic QR Codes','Track Every Scan','Print Once. Test Forever.','No Reprint Needed','QRPro for Business','Dynamic QR Platform','Re-Point Any Printed QR','From $8/mo. Cancel Anytime','Free for 5 QR Codes'],
      descriptions: ['Edit QR destinations after printing. Track device, location, conversions in real time.','Dynamic QR codes with analytics, split testing, branded design. $8/mo. Cancel anytime.','Stop reprinting. Update where your QR goes anytime. Track every scan and conversion.'],
    },
  },
  {
    name: 'QR Analytics / Tracking',
    final_url: `${BASE_URL}/qr-code-analytics`,
    keywords: {
      exact: ['qr code analytics','qr code tracking','qr code scan tracking','qr code tracking software','qr code analytics software','qr code conversion tracking','qr scan analytics'],
      phrase: ['track qr code scans','qr code campaign tracking','qr code with analytics','measure qr code conversions','qr code roi tracking'],
    },
    rsa: {
      headlines: ['QR Code Analytics','Track QR Conversions','Track Every Scan','Measure Print ROI','QR Tracking Software','Know Which Flyer Worked','QRPro for Business','From $8/mo. Cancel Anytime','Free for 5 QR Codes'],
      descriptions: ['See which flyer, sign, or ad drove the scan. Track device, location, time, conversions.','QR analytics built for marketers. Device, city, conversion data per code. From $8/mo.','Stop guessing. QRPro shows you exactly which print placement drove each conversion.'],
    },
  },
  {
    name: 'Split Testing / A/B Testing QR',
    final_url: `${BASE_URL}/split-testing`,
    keywords: {
      exact: ['qr code split testing','qr code ab testing','ab test qr code','split test qr code','qr code a/b test tool'],
      phrase: ['ab test qr code destination','split test qr code campaign','qr code a/b testing','test multiple qr code destinations','optimize qr code conversions','compare qr code landing pages'],
    },
    rsa: {
      headlines: ['Split Test QR Codes','A/B Test QR Destinations','Print Once. Test Forever.','One QR. Multiple Destinations.','Find the Winning Page','QRPro for Business','Track QR Conversions','From $8/mo. Cancel Anytime','Free for 5 QR Codes'],
      descriptions: ['Split test destinations from one QR. Track conversions per variant. No reprinting.','One printed QR. Multiple landing pages. Track which converts. Switch to the winner.','A/B test your QR campaigns. Route traffic, measure conversions, optimize.'],
    },
  },
  {
    name: 'Business / Marketing QR Codes',
    final_url: `${BASE_URL}/business`,
    keywords: {
      exact: ['business qr code generator','qr codes for business','professional qr code generator','qr code marketing software','branded qr code generator','qr code management platform','qr code for marketing'],
      phrase: ['qr code marketing','qr code campaign','qr code for marketing campaign','qr code with logo generator','qr code for print marketing','branded qr codes for business','trackable qr codes for marketing'],
    },
    rsa: {
      headlines: ['Business QR Platform','Branded QR Codes','QRPro for Business','Marketing QR Software','Track Print ROI','QR Codes With Analytics','From $8/mo. Cancel Anytime','Free for 5 QR Codes','Bulk QR Code Generator','Create Trackable QRs'],
      descriptions: ['Dynamic QR codes with analytics, split testing, branded design. $8/mo. Cancel anytime.','Business QR codes with tracking, branded design, split testing. From $8/mo.','Turn print into a measurable channel. Dynamic QRs, analytics, A/B testing. Free to start.'],
    },
  },
  {
    name: 'Competitor Alternatives',
    final_url: `${BASE_URL}/business`,
    keywords: {
      exact: ['qr.io alternative','qr io alternative','bitly qr code alternative','qr tiger alternative','qr code monkey alternative','beaconstac alternative','uniqode alternative','flowcode alternative','qr code generator with analytics','cheaper than bitly qr'],
      phrase: ['best qr code generator for business','qr.io vs alternatives','bitly qr code competitor','affordable qr code platform','cheapest dynamic qr code generator'],
    },
    rsa: {
      headlines: ['Save 72% vs Bitly','Cheaper Than Flowcode','QRPro vs QR.io','QRPro: $8/mo. Bitly: $29/mo','Same Features. 72% Less.','Dynamic QR Platform','Track Every Scan','Free for 5 QR Codes','No Reprint Needed','QRPro for Business'],
      descriptions: ['QRPro Pro is $8/mo. Bitly starts at $29/mo. Same dynamic codes, 72% less. Cancel anytime.','Compare QR platforms. Dynamic codes, analytics, split testing at a fraction of the cost.','Switch from QR.io or Bitly. Dynamic QRs with split testing and analytics from $8/mo.'],
    },
  },
  {
    name: 'Bulk / Batch QR Codes',
    final_url: `${BASE_URL}/business/pricing`,
    keywords: {
      exact: ['bulk qr code generator','batch qr code generator','csv qr code generator','bulk dynamic qr codes','multiple qr code generator'],
      phrase: ['generate qr codes in bulk','bulk qr code creation','qr code generator from csv','mass qr code generator','create multiple qr codes at once'],
    },
    rsa: {
      headlines: ['Bulk QR Code Generator','Generate QR Codes in Bulk','CSV to QR Codes','Batch QR Code Creator','QRPro for Business','From $8/mo. Cancel Anytime','Free for 5 QR Codes','Bulk Dynamic QR Codes'],
      descriptions: ['Generate hundreds of dynamic QR codes from a CSV. Track every scan. From $8/mo.','Bulk QR code generator with analytics and dynamic links. CSV upload. From $8/mo.','Create batch QR codes with tracking and branded design. Free to start, $8/mo for Pro.'],
    },
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const customer = createCustomer();
  const cid = getCustomerId();

  log(`Customer ID: ${cid}`);
  log(`Campaign: ${CAMPAIGN_NAME}`);

  // ── Step 0: Resolve campaign ────────────────────────────────────────────
  const camps = await customer.query(`
    SELECT campaign.id, campaign.name
    FROM campaign
    WHERE campaign.name = '${CAMPAIGN_NAME}'
  `);
  if (!camps.length) throw new Error(`Campaign "${CAMPAIGN_NAME}" not found`);
  const campaignId = camps[0].campaign.id;
  const campaignResource = `customers/${cid}/campaigns/${campaignId}`;
  log(`Campaign ID: ${campaignId}\n`);

  // ── Step 1: Add missing negatives ───────────────────────────────────────
  log('═══ Step 1: Adding Negative Keywords ═══');
  const existingNegs = await customer.query(`
    SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
    FROM campaign_criterion
    WHERE campaign_criterion.campaign = '${campaignResource}'
      AND campaign_criterion.negative = TRUE
      AND campaign_criterion.type = 'KEYWORD'
  `);
  const existingNegSet = new Set(
    existingNegs.map(r => `${(r.campaign_criterion?.keyword?.text || '').toLowerCase()}:${r.campaign_criterion?.keyword?.match_type}`)
  );

  const negOperations = [];
  for (const neg of NEW_NEGATIVES) {
    const matchTypeEnum = neg.type === 'EXACT' ? enums.KeywordMatchType.EXACT : enums.KeywordMatchType.PHRASE;
    const key = `${neg.text.toLowerCase()}:${matchTypeEnum}`;
    if (existingNegSet.has(key)) {
      logSkip(`exists: "${neg.text}" (${neg.type})`);
      continue;
    }
    negOperations.push({
      entity: 'campaign_criterion',
      operation: 'create',
      resource: {
        campaign: campaignResource,
        negative: true,
        keyword: { text: neg.text, match_type: matchTypeEnum },
      },
    });
    log(`  + "${neg.text}" (${neg.type})`);
  }

  if (negOperations.length) {
    if (!DRY_RUN) {
      await customer.mutateResources(negOperations);
      logSuccess(`Added ${negOperations.length} negative keywords`);
    } else {
      log(`  → Would add ${negOperations.length} negatives`);
    }
  } else {
    log('  No new negatives needed');
  }

  // ── Step 2: Pause old ad group ──────────────────────────────────────────
  log('\n═══ Step 2: Pausing Old Ad Group ═══');
  const oldAGResource = `customers/${cid}/adGroups/${OLD_AD_GROUP_ID}`;
  log(`  Pausing "small business focused" (${OLD_AD_GROUP_ID})`);
  if (!DRY_RUN) {
    await customer.mutateResources([{
      entity: 'ad_group',
      operation: 'update',
      resource: {
        resource_name: oldAGResource,
        status: enums.AdGroupStatus.PAUSED,
      },
    }]);
    logSuccess('Paused old ad group');
  }

  // ── Step 3: Create new ad groups + keywords + RSA ads ──────────────────
  log('\n═══ Step 3: Creating New Ad Groups ═══');
  const allOperations = [];
  let totalKW = 0;

  for (let i = 0; i < AD_GROUPS.length; i++) {
    const ag = AD_GROUPS[i];
    const tempId = -100 - i; // Temporary negative IDs for resource linking
    const agResourceName = `customers/${cid}/adGroups/${tempId}`;

    log(`\n  ── "${ag.name}" → ${ag.final_url}`);

    // Create ad group (PAUSED)
    allOperations.push({
      entity: 'ad_group',
      operation: 'create',
      resource: {
        resource_name: agResourceName,
        name: ag.name,
        campaign: campaignResource,
        status: enums.AdGroupStatus.PAUSED,
      },
    });

    // Keywords
    for (const [matchType, keywords] of Object.entries(ag.keywords)) {
      const matchTypeEnum = matchType === 'exact' ? enums.KeywordMatchType.EXACT : enums.KeywordMatchType.PHRASE;
      for (const kwText of keywords) {
        allOperations.push({
          entity: 'ad_group_criterion',
          operation: 'create',
          resource: {
            ad_group: agResourceName,
            keyword: { text: kwText, match_type: matchTypeEnum },
            status: enums.AdGroupCriterionStatus.PAUSED,
          },
        });
        totalKW++;
      }
    }

    log(`    ${ag.keywords.exact.length} EXACT + ${ag.keywords.phrase.length} PHRASE = ${ag.keywords.exact.length + ag.keywords.phrase.length} keywords`);

    // RSA ad
    const ad = new resources.Ad({
      responsive_search_ad: {
        headlines: ag.rsa.headlines.map(text => ({ text })),
        descriptions: ag.rsa.descriptions.map(text => ({ text })),
        path1: ag.name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 15),
      },
      final_urls: [ag.final_url],
      type: enums.AdType.RESPONSIVE_SEARCH_AD,
    });

    allOperations.push({
      entity: 'ad_group_ad',
      operation: 'create',
      resource: {
        ad_group: agResourceName,
        ad,
        status: enums.AdGroupAdStatus.PAUSED,
      },
    });

    log(`    ${ag.rsa.headlines.length} headlines, ${ag.rsa.descriptions.length} descriptions`);
  }

  log(`\n  Total operations: ${allOperations.length} (${totalKW} keywords, ${AD_GROUPS.length} ad groups, ${AD_GROUPS.length} RSA ads)`);

  if (allOperations.length) {
    if (!DRY_RUN) {
      const result = await customer.mutateResources(allOperations);
      logSuccess(`Created ${allOperations.length} resources`);
      if (result.results) {
        log(`  Resource names returned: ${result.results.length}`);
      }
    } else {
      log(`  → Would create ${allOperations.length} resources`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  log('\n═══ Summary ═══');
  log(`Negatives added: ${negOperations.length}`);
  log(`Old ad group: paused`);
  log(`New ad groups: ${AD_GROUPS.length}`);
  log(`New keywords: ${totalKW} (all EXACT/PHRASE, zero broad)`);
  log(`New RSA ads: ${AD_GROUPS.length}`);
  log(`Budget: UNCHANGED`);
  log(`Campaign status: still PAUSED`);

  if (DRY_RUN) {
    log('\n🧪 This was a dry run. No live mutations were made.');
    log('Run without --dry-run to execute.');
  } else {
    log('\n✅ Campaign restructured successfully.');
    log('Next steps:');
    log('  1. Set campaign budget in Google Ads UI');
    log('  2. Verify conversion tracking fires correctly');
    log('  3. Enable campaign manually in Google Ads UI');
  }
}

main().catch(err => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
