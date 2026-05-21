# frozen_string_literal: true

require 'minitest/autorun'
require 'minitest/reporters'

Minitest::Reporters.use! Minitest::Reporters::SpecReporter.new

# Load .env for tests if present
require 'dotenv'
Dotenv.load(File.join(__dir__, '..', '.env'))

$LOAD_PATH.unshift File.expand_path('../lib', __dir__)
require 'buck_ads'
