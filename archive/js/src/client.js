/**
 * @module client
 * @description Shared Google Ads API client setup.
 *              Provides a configured GoogleAdsApi client and customer instance
 *              using environment variables from .env.
 *              All Google Ads scripts should use this module for authentication.
 */

const { GoogleAdsApi } = require('google-ads-api');
const path = require('path');

// Load .env if not already loaded
if (!process.env.GOOGLE_ADS_CLIENT_ID) {
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
}

/**
 * Validate that all required Google Ads environment variables are present.
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateEnv() {
  const required = [
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_CUSTOMER_ID',
  ];

  const missing = required.filter((key) => !process.env[key]);
  return { valid: missing.length === 0, missing };
}

/**
 * Get the raw customer ID (numeric, no hyphens).
 * @returns {string}
 */
function getCustomerId() {
  return (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
}

/**
 * Create and return a configured GoogleAdsApi client.
 * @returns {import('google-ads-api').Client}
 * @throws {Error} If required env vars are missing
 */
function createClient() {
  const { valid, missing } = validateEnv();
  if (!valid) {
    throw new Error(
      `Missing required Google Ads env vars: ${missing.join(', ')}\n` +
        'Check your .env file or run: node src/cli.js authorize'
    );
  }

  return new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });
}

/**
 * Create and return a Customer instance for the default account.
 * @param {object} [hooks] - Optional hooks for the customer instance
 * @returns {import('google-ads-api').Customer}
 * @throws {Error} If required env vars are missing
 */
function createCustomer(hooks) {
  const client = createClient();
  const customerId = getCustomerId();

  return client.Customer(
    {
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    },
    hooks
  );
}

module.exports = {
  createClient,
  createCustomer,
  getCustomerId,
  validateEnv,
};
