# frozen_string_literal: true

require_relative 'test_helper'
require 'buck_ads/client'

class TestClient < Minitest::Test
  def setup
    # Save original env vars
    @saved_env = {
      'GOOGLE_ADS_CLIENT_ID' => ENV['GOOGLE_ADS_CLIENT_ID'],
      'GOOGLE_ADS_CLIENT_SECRET' => ENV['GOOGLE_ADS_CLIENT_SECRET'],
      'GOOGLE_ADS_DEVELOPER_TOKEN' => ENV['GOOGLE_ADS_DEVELOPER_TOKEN'],
      'GOOGLE_ADS_REFRESH_TOKEN' => ENV['GOOGLE_ADS_REFRESH_TOKEN'],
      'GOOGLE_ADS_CUSTOMER_ID' => ENV['GOOGLE_ADS_CUSTOMER_ID']
    }
  end

  def teardown
    # Restore original env vars
    @saved_env.each { |k, v| ENV[k] = v }
  end

  # ─── Env Validation Tests ────────────────────────────────────────────────

  def test_validate_env_returns_valid_when_all_vars_present
    set_all_env_vars
    result = BuckAds::Client.validate_env
    assert result[:valid], 'Expected valid when all env vars present'
    assert_empty result[:missing], 'Expected no missing vars'
  end

  def test_validate_env_returns_invalid_when_vars_missing
    clear_all_env_vars
    result = BuckAds::Client.validate_env
    refute result[:valid], 'Expected invalid when env vars missing'
    assert_includes result[:missing], 'GOOGLE_ADS_CLIENT_ID'
    assert_includes result[:missing], 'GOOGLE_ADS_DEVELOPER_TOKEN'
  end

  def test_validate_env_reports_only_missing_vars
    clear_all_env_vars
    ENV['GOOGLE_ADS_CLIENT_ID'] = 'present'
    ENV['GOOGLE_ADS_DEVELOPER_TOKEN'] = 'present'
    result = BuckAds::Client.validate_env
    refute result[:valid]
    assert_includes result[:missing], 'GOOGLE_ADS_CLIENT_SECRET'
    refute_includes result[:missing], 'GOOGLE_ADS_CLIENT_ID'
  end

  # ─── Customer ID Parsing ──────────────────────────────────────────────────

  def test_get_customer_id_strips_hyphens
    ENV['GOOGLE_ADS_CUSTOMER_ID'] = '123-456-7890'
    assert_equal '1234567890', BuckAds::Client.customer_id
  end

  def test_get_customer_id_handles_no_hyphens
    ENV['GOOGLE_ADS_CUSTOMER_ID'] = '1234567890'
    assert_equal '1234567890', BuckAds::Client.customer_id
  end

  def test_get_customer_id_returns_empty_when_not_set
    ENV.delete('GOOGLE_ADS_CUSTOMER_ID')
    assert_equal '', BuckAds::Client.customer_id
  end

  # ─── Client Creation ──────────────────────────────────────────────────────

  def test_create_client_raises_when_env_vars_missing
    clear_all_env_vars
    assert_raises(RuntimeError) { BuckAds::Client.create_client }
  end

  def test_create_client_returns_google_ads_client_when_env_valid
    set_all_env_vars
    client = BuckAds::Client.create_client
    assert_instance_of Google::Ads::GoogleAds::GoogleAdsClient, client
  end

  # ─── Customer Resource Name ──────────────────────────────────────────────

  def test_campaign_resource_name
    assert_equal(
      'customers/1234567890/campaigns/999',
      BuckAds::Client.campaign_resource_name('1234567890', '999')
    )
  end

  private

  def set_all_env_vars
    ENV['GOOGLE_ADS_CLIENT_ID'] = 'test-client-id.apps.googleusercontent.com'
    ENV['GOOGLE_ADS_CLIENT_SECRET'] = 'test-secret'
    ENV['GOOGLE_ADS_DEVELOPER_TOKEN'] = 'test-dev-token'
    ENV['GOOGLE_ADS_REFRESH_TOKEN'] = 'test-refresh-token'
    ENV['GOOGLE_ADS_CUSTOMER_ID'] = '123-456-7890'
  end

  def clear_all_env_vars
    %w[GOOGLE_ADS_CLIENT_ID GOOGLE_ADS_CLIENT_SECRET GOOGLE_ADS_DEVELOPER_TOKEN
       GOOGLE_ADS_REFRESH_TOKEN GOOGLE_ADS_CUSTOMER_ID].each { |k| ENV.delete(k) }
  end
end
