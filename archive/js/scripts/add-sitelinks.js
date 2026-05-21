#!/usr/bin/env node
/**
 * @module add-sitelinks
 * @description Add sitelink extensions to a campaign using REST API.
 *              Creates sitelink assets and attaches them to the specified campaign.
 *
 * @example
 *   node scripts/add-sitelinks.js --campaign=business-purchase-us
 *   node scripts/add-sitelinks.js --campaign=23825732817 --dry-run
 */

const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// ─── Config ─────────────────────────────────────────────────────────────────

const {
  GOOGLE_ADS_CLIENT_ID,
  GOOGLE_ADS_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_ADS_CUSTOMER_ID,
} = process.env;

const CUSTOMER_ID = GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
  const flag = `--${name}=`;
  const arg = args.find((a) => a.startsWith(flag));
  return arg ? arg.replace(flag, '') : defaultVal;
};

const campaignArg = getArg('campaign', '');
const dryRun = getArg('dry-run', 'false') !== 'false';

// ─── Sitelink Definitions ─────────────────────────────────────────────────────

const SITELINKS = [
  {
    title: 'Pricing',
    description1: 'View our plans',
    description2: 'Start free today',
    url: 'https://qrpro.tools/pricing',
  },
  {
    title: 'QR Analytics',
    description1: 'Track every scan',
    description2: 'See conversion data',
    url: 'https://qrpro.tools/qr-code-analytics',
  },
  {
    title: 'Split Testing',
    description1: 'A/B test your QR codes',
    description2: 'Optimize for conversions',
    url: 'https://qrpro.tools/split-testing',
  },
  {
    title: 'Dynamic QR Codes',
    description1: 'Update URLs anytime',
    description2: 'Never reprint QR codes',
    url: 'https://qrpro.tools/dynamic-qr-codes',
  },
  {
    title: 'Compare Tools',
    description1: 'See how we stack up',
    description2: 'vs other QR generators',
    url: 'https://qrpro.tools/compare',
  },
  {
    title: 'Link Shortener',
    description1: 'Shorten any URL',
    description2: 'Track link clicks',
    url: 'https://qrpro.tools/link-shortener',
  },
];

// ─── REST API Helpers ─────────────────────────────────────────────────────────

function getAccessToken() {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: GOOGLE_ADS_CLIENT_ID,
      client_secret: GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': body.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(new Error('No access token in response: ' + data));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function apiRequest(accessToken, path, body) {
  return new Promise((resolve, reject) => {
    const jsonBody = JSON.stringify(body);
    const options = {
      hostname: 'googleads.googleapis.com',
      path: `/v23/customers/${CUSTOMER_ID}${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN,
        'Content-Length': Buffer.byteLength(jsonBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(JSON.stringify(parsed.error || parsed, null, 2)));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(jsonBody);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Google Ads Sitelink Creator (REST API)');
  console.log('='.repeat(50));
  console.log('Customer ID:', CUSTOMER_ID);
  console.log('Dry run:', dryRun);
  console.log();

  // 1. Get access token
  console.log('Getting access token...');
  const accessToken = await getAccessToken();
  console.log('✓ Access token obtained');
  console.log();

  // 2. Find campaign
  console.log('Finding campaign:', campaignArg);

  const campaignQuery = `
    SELECT campaign.id, campaign.name, campaign.resource_name
    FROM campaign
    LIMIT 20
  `;

  const searchResult = await apiRequest(
    accessToken,
    '/googleAds:search',
    { query: campaignQuery }
  );

  let campaign = null;
  for (const row of searchResult.results || []) {
    const c = row.campaign;
    const id = String(c?.id);
    const name = c?.name?.value || c?.name;
    const resourceName = c?.resourceName;

    if (id === campaignArg || name?.toLowerCase() === campaignArg.toLowerCase()) {
      campaign = { id, name, resourceName };
      break;
    }
  }

  if (!campaign) {
    console.error('❌ Campaign not found:', campaignArg);
    process.exit(1);
  }

  console.log('✓ Found campaign:', campaign.name);
  console.log('  Resource:', campaign.resourceName);
  console.log();

  // 3. Check existing sitelinks
  console.log('Checking existing sitelinks...');

  const existingQuery = `
    SELECT
      asset.id,
      asset.final_urls,
      campaign_asset.status
    FROM campaign_asset
    WHERE asset.type = 'SITELINK'
      AND campaign_asset.campaign = '${campaign.resourceName}'
  `;

  const existingResult = await apiRequest(
    accessToken,
    '/googleAds:search',
    { query: existingQuery }
  );

  const existing = existingResult.results || [];
  console.log('Existing sitelinks:', existing.length);
  existing.forEach((row, i) => {
    console.log(
      `  ${i + 1}. ID ${row.asset?.id} -> ${row.asset?.final_urls?.[0]} (${row.campaign_asset?.status})`
    );
  });
  console.log();

  // 4. Display sitelinks to create
  console.log('Sitelinks to create:', SITELINKS.length);
  SITELINKS.forEach((sl, i) => {
    console.log(`  ${i + 1}. ${sl.title} -> ${sl.url}`);
  });
  console.log();

  if (dryRun) {
    console.log('🟡 DRY RUN - No changes will be made');
    return;
  }

  // 5. Create sitelink assets
  console.log('=== Creating Sitelink Assets ===');

  const createdAssets = [];

  for (const sl of SITELINKS) {
    const result = await apiRequest(accessToken, '/assets:mutate', {
      operations: [
        {
          create: {
            type: 'SITELINK',
            finalUrls: [sl.url],
            sitelinkAsset: {
              description1: sl.description1,
              description2: sl.description2,
              linkText: sl.title,
            },
          },
        },
      ],
    });

    const resourceName = result.results?.[0]?.resourceName;
    if (resourceName) {
      createdAssets.push({ ...sl, resourceName });
      console.log(`  ✓ ${sl.title} -> ${resourceName}`);
    }
  }

  console.log();

  // 6. Attach assets to campaign
  console.log('=== Attaching to Campaign ===');

  for (const asset of createdAssets) {
    await apiRequest(accessToken, '/campaignAssets:mutate', {
      operations: [
        {
          create: {
            asset: asset.resourceName,
            campaign: campaign.resourceName,
            fieldType: 'SITELINK',
            status: 'ENABLED',
          },
        },
      ],
    });
    console.log(`  ✓ Attached: ${asset.title}`);
  }

  // 7. Summary
  console.log();
  console.log('='.repeat(50));
  console.log('✅ SUCCESS');
  console.log();
  console.log('Created Sitelinks:');
  createdAssets.forEach((asset, i) => {
    console.log(`  ${i + 1}. ${asset.title}`);
    console.log(`      -> ${asset.url}`);
    console.log(`      Asset: ${asset.resourceName}`);
  });
  console.log();
  console.log('Campaign:', campaign.resourceName);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
