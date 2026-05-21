# frozen_string_literal: true

# Main entry point for the buck_ads gem.
# Provides CLI tools for Google Ads campaign management.
module BuckAds
  VERSION = '0.1.0'.freeze
end

require_relative 'buck_ads/client'
