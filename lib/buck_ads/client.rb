# frozen_string_literal: true

require 'google/ads/google_ads'
require 'dotenv'

module BuckAds
  # Google Ads API client wrapper.
  # Provides authentication, client creation, and common utilities
  # for interacting with the Google Ads API via the official Ruby gem.
  #
  # Uses environment variables for credentials (same names as the JS version):
  #   - GOOGLE_ADS_CLIENT_ID
  #   - GOOGLE_ADS_CLIENT_SECRET
  #   - GOOGLE_ADS_DEVELOPER_TOKEN
  #   - GOOGLE_ADS_REFRESH_TOKEN
  #   - GOOGLE_ADS_CUSTOMER_ID
  #
  # @example Create a client and query campaigns
  #   client = BuckAds::Client.create_client
  #   service = client.service.google_ads
  #   response = service.search(customer_id: BuckAds::Client.customer_id, query: "SELECT campaign.name FROM campaign")
  class Client
    REQUIRED_ENV_VARS = %w[
      GOOGLE_ADS_CLIENT_ID
      GOOGLE_ADS_CLIENT_SECRET
      GOOGLE_ADS_DEVELOPER_TOKEN
      GOOGLE_ADS_REFRESH_TOKEN
      GOOGLE_ADS_CUSTOMER_ID
    ].freeze

    # Validate that all required Google Ads environment variables are present.
    #
    # @return [Hash{Symbol => Object}] :valid [Boolean], :missing [Array<String>]
    def self.validate_env
      missing = REQUIRED_ENV_VARS.select { |key| ENV[key].nil? || ENV[key].strip.empty? }
      { valid: missing.empty?, missing: missing }
    end

    # Get the customer ID with hyphens stripped.
    #
    # @return [String] Numeric customer ID without hyphens
    def self.customer_id
      (ENV['GOOGLE_ADS_CUSTOMER_ID'] || '').gsub('-', '')
    end

    # Create and return a configured GoogleAdsClient.
    # Reads credentials from environment variables.
    #
    # @return [Google::Ads::GoogleAds::GoogleAdsClient]
    # @raise [RuntimeError] If required env vars are missing
    def self.create_client
      result = validate_env
      unless result[:valid]
        raise "Missing required Google Ads env vars: #{result[:missing].join(', ')}\n" \
              'Check your .env file.'
      end

      client = Google::Ads::GoogleAds::GoogleAdsClient.new do |config|
        config.client_id = ENV['GOOGLE_ADS_CLIENT_ID']
        config.client_secret = ENV['GOOGLE_ADS_CLIENT_SECRET']
        config.developer_token = ENV['GOOGLE_ADS_DEVELOPER_TOKEN']
        config.refresh_token = ENV['GOOGLE_ADS_REFRESH_TOKEN']
      end
      client
    end

    # Build a campaign resource name from customer ID and campaign ID.
    #
    # @param customer_id [String] Customer ID (no hyphens)
    # @param campaign_id [String, Integer] Campaign ID
    # @return [String] Fully qualified resource name
    def self.campaign_resource_name(customer_id, campaign_id)
      "customers/#{customer_id}/campaigns/#{campaign_id}"
    end
  end
end
