# frozen_string_literal: true

require_relative 'test_helper'
require 'ostruct'
require 'buck_ads/campaign_analysis'

class TestCampaignAnalysis < Minitest::Test
  # ─── Fixtures ────────────────────────────────────────────────────────────

  # Simulated protobuf-like objects using OpenStruct
  def campaign_row
    row = OpenStruct.new
    row.campaign = OpenStruct.new(
      id: '12345',
      name: 'business-purchase-us',
      status: :ENABLED,
      advertising_channel_type: :SEARCH,
      serving_status: :SERVING,
      bidding_strategy_type: :TARGET_CPA,
      start_date: '2025-01-01',
      end_date: '2030-12-30'
    )
    row.metrics = OpenStruct.new(
      cost_micros: 50_000_000,
      clicks: 1200,
      impressions: 35_000,
      all_conversions: 45
    )
    row
  end

  def ad_group_rows
    [
      OpenStruct.new(
        ad_group: OpenStruct.new(id: '100', name: 'General Purchase Intent', status: :ENABLED),
        metrics: OpenStruct.new(cost_micros: 30_000_000, clicks: 800, impressions: 20_000, all_conversions: 30)
      ),
      OpenStruct.new(
        ad_group: OpenStruct.new(id: '101', name: 'Brand Terms', status: :PAUSED),
        metrics: OpenStruct.new(cost_micros: 10_000_000, clicks: 200, impressions: 8000, all_conversions: 10)
      ),
      OpenStruct.new(
        ad_group: OpenStruct.new(id: '102', name: 'Competitor Terms', status: :ENABLED),
        metrics: OpenStruct.new(cost_micros: 10_000_000, clicks: 200, impressions: 7000, all_conversions: 5)
      )
    ]
  end

  def keyword_rows
    [
      OpenStruct.new(
        ad_group: OpenStruct.new(id: '100', name: 'General Purchase Intent'),
        ad_group_criterion: OpenStruct.new(
          keyword: OpenStruct.new(text: 'buy a business', match_type: :BROAD),
          quality_info: OpenStruct.new(quality_score: 7),
          status: :ENABLED
        )
      ),
      OpenStruct.new(
        ad_group: OpenStruct.new(id: '100', name: 'General Purchase Intent'),
        ad_group_criterion: OpenStruct.new(
          keyword: OpenStruct.new(text: 'business for sale', match_type: :PHRASE),
          quality_info: OpenStruct.new(quality_score: 5),
          status: :ENABLED
        )
      ),
      OpenStruct.new(
        ad_group: OpenStruct.new(id: '101', name: 'Brand Terms'),
        ad_group_criterion: OpenStruct.new(
          keyword: OpenStruct.new(text: 'my brand', match_type: :EXACT),
          quality_info: OpenStruct.new(quality_score: 8),
          status: :PAUSED
        )
      ),
      OpenStruct.new(
        ad_group: OpenStruct.new(id: '102', name: 'Competitor Terms'),
        ad_group_criterion: OpenStruct.new(
          keyword: OpenStruct.new(text: 'competitor name', match_type: :EXACT),
          quality_info: OpenStruct.new(quality_score: 3),
          status: :ENABLED
        )
      )
    ]
  end

  def ad_rows
    # Build RSA headlines/descriptions as arrays of OpenStruct (protobuf AdTextAsset)
    [
      OpenStruct.new(
        ad_group: OpenStruct.new(id: '100', name: 'General Purchase Intent'),
        ad_group_ad: OpenStruct.new(
          ad: OpenStruct.new(
            type: :RESPONSIVE_SEARCH_AD,
            responsive_search_ad: OpenStruct.new(
              headlines: [
                OpenStruct.new(text: 'Buy a Business Today'),
                OpenStruct.new(text: 'Business for Sale'),
                OpenStruct.new(text: 'Find Your Business')
              ],
              descriptions: [
                OpenStruct.new(text: 'Browse listings of businesses for sale across the US.'),
                OpenStruct.new(text: 'Start your entrepreneurial journey today.')
              ]
            )
          ),
          status: :ENABLED,
          ad_strength: :GOOD,
          policy_summary: OpenStruct.new(policy_topic_entries: [])
        )
      ),
      OpenStruct.new(
        ad_group: OpenStruct.new(id: '101', name: 'Brand Terms'),
        ad_group_ad: OpenStruct.new(
          ad: OpenStruct.new(
            type: :RESPONSIVE_SEARCH_AD,
            responsive_search_ad: OpenStruct.new(
              headlines: [OpenStruct.new(text: 'Only One Headline')],
              descriptions: [OpenStruct.new(text: 'Only one description.')]
            )
          ),
          status: :PAUSED,
          ad_strength: :POOR,
          policy_summary: OpenStruct.new(policy_topic_entries: [OpenStruct.new(topic: 'ALCOHOL')])
        )
      )
    ]
  end

  def sitelink_rows
    [
      OpenStruct.new(
        asset: OpenStruct.new(
          id: '500',
          name: 'Sitelink 1',
          sitelink_asset: OpenStruct.new(
            link_text: 'Our Process',
            description1: 'How we work',
            description2: 'Step by step',
            final_urls: ['https://example.com/process']
          )
        ),
        campaign_asset: OpenStruct.new(status: :ENABLED)
      ),
      OpenStruct.new(
        asset: OpenStruct.new(
          id: '501',
          name: 'Sitelink 2',
          sitelink_asset: OpenStruct.new(
            link_text: 'Testimonials',
            description1: 'What clients say',
            description2: '',
            final_urls: ['https://example.com/testimonials']
          )
        ),
        campaign_asset: OpenStruct.new(status: :ENABLED)
      )
    ]
  end

  def asset_rows
    [
      OpenStruct.new(
        asset: OpenStruct.new(
          id: '600',
          name: 'Callout 1',
          callout_asset: OpenStruct.new(callout_text: '20+ Years Experience'),
          structured_snippet_asset: nil
        ),
        campaign_asset: OpenStruct.new(status: :ENABLED, field_type: :CALLOUT)
      ),
      OpenStruct.new(
        asset: OpenStruct.new(
          id: '601',
          name: 'Snippet 1',
          callout_asset: nil,
          structured_snippet_asset: OpenStruct.new(header: 'Types', values: ['Retail', 'Service', 'Online'])
        ),
        campaign_asset: OpenStruct.new(status: :ENABLED, field_type: :STRUCTURED_SNIPPET)
      )
    ]
  end

  def negative_rows
    [
      OpenStruct.new(
        campaign_criterion: OpenStruct.new(
          keyword: OpenStruct.new(text: 'free', match_type: :BROAD),
          negative: true
        )
      ),
      OpenStruct.new(
        campaign_criterion: OpenStruct.new(
          keyword: OpenStruct.new(text: 'jobs', match_type: :BROAD),
          negative: true
        )
      )
    ]
  end

  def conversion_rows
    [
      OpenStruct.new(
        conversion_action: OpenStruct.new(
          id: '700',
          name: 'Purchase/Signup',
          status: :ENABLED,
          category: :PURCHASE,
          type: :WEBPAGE,
          counting_type: :MANY_PER_CLICK
        )
      ),
      OpenStruct.new(
        conversion_action: OpenStruct.new(
          id: '701',
          name: 'Old Lead Form',
          status: :PAUSED,
          category: :LEAD,
          type: :WEBPAGE,
          counting_type: :ONE_PER_CLICK
        )
      )
    ]
  end

  # ─── Normalization Tests ────────────────────────────────────────────────

  def test_normalize_campaign
    result = BuckAds::CampaignAnalysis.normalize_campaign(campaign_row)
    assert_equal '12345', result[:id]
    assert_equal 'business-purchase-us', result[:name]
    assert_equal 'ENABLED', result[:status]
    assert_equal 'SEARCH', result[:channel_type]
    assert_equal 'SERVING', result[:serving_status]
    assert_equal 'TARGET_CPA', result[:bidding_strategy]
    assert_in_delta 50.0, result[:metrics][:cost], 0.01
    assert_equal 1200, result[:metrics][:clicks]
    assert_equal 35_000, result[:metrics][:impressions]
    assert_equal 45, result[:metrics][:conversions]
  end

  def test_normalize_campaign_handles_nil
    result = BuckAds::CampaignAnalysis.normalize_campaign(nil)
    assert_nil result
  end

  def test_normalize_campaign_handles_missing_fields
    row = OpenStruct.new(campaign: OpenStruct.new(id: '1', name: 'Test'), metrics: nil)
    result = BuckAds::CampaignAnalysis.normalize_campaign(row)
    assert_equal 'UNKNOWN', result[:status]
    assert_in_delta 0.0, result[:metrics][:cost], 0.01
  end

  def test_normalize_ad_groups
    result = BuckAds::CampaignAnalysis.normalize_ad_groups(ad_group_rows)
    assert_equal 3, result.length
    assert_equal '100', result[0][:id]
    assert_equal 'General Purchase Intent', result[0][:name]
    assert_equal 'ENABLED', result[0][:status]
    assert_in_delta 30.0, result[0][:metrics][:cost], 0.01
    assert_equal 'PAUSED', result[1][:status]
  end

  def test_normalize_ad_groups_empty
    assert_equal [], BuckAds::CampaignAnalysis.normalize_ad_groups([])
  end

  def test_normalize_keywords
    result = BuckAds::CampaignAnalysis.normalize_keywords(keyword_rows)
    assert_equal 4, result.length
    assert_equal 'buy a business', result[0][:text]
    assert_equal 'BROAD', result[0][:match_type]
    assert_equal 'ENABLED', result[0][:status]
    assert_equal 7, result[0][:quality_score]
    assert_equal '100', result[0][:ad_group_id]
  end

  def test_normalize_keywords_handles_missing_quality_score
    row = OpenStruct.new(
      ad_group: OpenStruct.new(id: '100', name: 'Test'),
      ad_group_criterion: OpenStruct.new(
        keyword: OpenStruct.new(text: 'test kw', match_type: :BROAD),
        quality_info: OpenStruct.new,
        status: :ENABLED
      )
    )
    result = BuckAds::CampaignAnalysis.normalize_keywords([row])
    assert_nil result[0][:quality_score]
  end

  def test_normalize_ads
    result = BuckAds::CampaignAnalysis.normalize_ads(ad_rows)
    assert_equal 2, result.length

    ad = result[0]
    assert_equal 'ENABLED', ad[:status]
    assert_equal 'GOOD', ad[:ad_strength]
    assert_equal 'RESPONSIVE_SEARCH_AD', ad[:type]
    assert_equal 3, ad[:headlines].length
    assert_equal 2, ad[:descriptions].length
    assert_equal [], ad[:policy_issues]
  end

  def test_normalize_ads_extracts_policy_issues
    result = BuckAds::CampaignAnalysis.normalize_ads(ad_rows)
    assert_equal ['ALCOHOL'], result[1][:policy_issues]
  end

  def test_normalize_ads_handles_non_rsa
    row = OpenStruct.new(
      ad_group: OpenStruct.new(id: '100', name: 'Test'),
      ad_group_ad: OpenStruct.new(
        ad: OpenStruct.new(type: :EXPANDED_TEXT_AD, responsive_search_ad: nil),
        status: :ENABLED,
        ad_strength: :AVERAGE,
        policy_summary: OpenStruct.new(policy_topic_entries: [])
      )
    )
    result = BuckAds::CampaignAnalysis.normalize_ads([row])
    assert_equal [], result[0][:headlines]
    assert_equal [], result[0][:descriptions]
  end

  def test_normalize_sitelinks
    result = BuckAds::CampaignAnalysis.normalize_sitelinks(sitelink_rows)
    assert_equal 2, result.length
    assert_equal '500', result[0][:id]
    assert_equal 'Our Process', result[0][:link_text]
    assert_equal 'How we work', result[0][:description1]
    assert_equal 'https://example.com/process', result[0][:final_url]
    assert_equal 'ENABLED', result[0][:status]
  end

  def test_normalize_assets
    result = BuckAds::CampaignAnalysis.normalize_assets(asset_rows)
    assert_equal 2, result.length
    assert_equal 'CALLOUT', result[0][:field_type]
    assert_equal '20+ Years Experience', result[0][:text]
    assert_equal 'STRUCTURED_SNIPPET', result[1][:field_type]
    assert_match(/Types:.*Retail.*Service.*Online/, result[1][:text])
  end

  def test_normalize_negatives
    result = BuckAds::CampaignAnalysis.normalize_negatives(negative_rows)
    assert_equal 2, result.length
    assert_equal 'free', result[0][:text]
    assert_equal 'BROAD', result[0][:match_type]
  end

  def test_normalize_negatives_filters_non_negative
    rows = negative_rows + [
      OpenStruct.new(
        campaign_criterion: OpenStruct.new(
          keyword: OpenStruct.new(text: 'positive kw', match_type: :BROAD),
          negative: false
        )
      )
    ]
    result = BuckAds::CampaignAnalysis.normalize_negatives(rows)
    assert_equal 2, result.length
  end

  def test_normalize_conversion_actions
    result = BuckAds::CampaignAnalysis.normalize_conversion_actions(conversion_rows)
    assert_equal 2, result.length
    assert_equal '700', result[0][:id]
    assert_equal 'Purchase/Signup', result[0][:name]
    assert_equal 'ENABLED', result[0][:status]
    assert_equal 'PURCHASE', result[0][:category]
    assert_equal 'PAUSED', result[1][:status]
  end

  def test_normalize_conversion_actions_empty
    assert_equal [], BuckAds::CampaignAnalysis.normalize_conversion_actions([])
  end

  # ─── Deterministic Check Tests ───────────────────────────────────────────

  def make_report(overrides = {})
    {
      campaign: overrides.key?(:campaign) ? overrides[:campaign] : {
        id: '12345', name: 'business-purchase-us', status: 'ENABLED',
        channel_type: 'SEARCH', serving_status: 'SERVING', bidding_strategy: 'TARGET_CPA',
        metrics: { cost: 50, clicks: 1200, impressions: 35_000, conversions: 45 }
      },
      ad_groups: overrides[:ad_groups] || [
        { id: '100', name: 'AG1', status: 'ENABLED', metrics: { cost: 30, clicks: 800, impressions: 20_000, conversions: 30 } }
      ],
      keywords: overrides[:keywords] || [
        { text: 'buy a business', match_type: 'BROAD', status: 'ENABLED', quality_score: 7, ad_group_id: '100', ad_group_name: 'AG1' }
      ],
      ads: overrides[:ads] || [
        { type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', ad_strength: 'GOOD',
          headlines: ['H1', 'H2', 'H3'], descriptions: ['D1', 'D2'],
          policy_issues: [], ad_group_id: '100', ad_group_name: 'AG1' }
      ],
      sitelinks: overrides[:sitelinks] || [
        { id: '500', link_text: 'Process', description1: 'How', description2: 'Step', final_url: 'https://example.com', status: 'ENABLED' },
        { id: '501', link_text: 'About', description1: '', description2: '', final_url: 'https://example.com/about', status: 'ENABLED' }
      ],
      assets: overrides[:assets] || [
        { id: '600', field_type: 'CALLOUT', text: '20+ Years', status: 'ENABLED' }
      ],
      negatives: overrides[:negatives] || [
        { text: 'free', match_type: 'BROAD' }
      ],
      conversion_actions: overrides[:conversion_actions] || [
        { id: '700', name: 'Purchase', status: 'ENABLED', category: 'PURCHASE' }
      ]
    }
  end

  def test_all_checks_pass_for_healthy_campaign
    report = make_report
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    failures = findings.select { |f| f[:result] == 'FAIL' }
    assert_empty failures, "Expected no FAIL findings, got: #{failures.inspect}"
  end

  def test_fail_campaign_not_found
    report = make_report(campaign: nil)
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    found = findings.find { |f| f[:check] == 'campaign_found' }
    assert_equal 'FAIL', found[:result]
  end

  def test_fail_campaign_paused
    report = make_report(campaign: { id: '1', name: 'test', status: 'PAUSED', channel_type: 'SEARCH', serving_status: 'SERVING', bidding_strategy: 'TARGET_CPA', metrics: { cost: 0, clicks: 0, impressions: 0, conversions: 0 } })
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'campaign_status_enabled' }
    assert_equal 'FAIL', check[:result]
  end

  def test_warning_campaign_not_search_channel
    report = make_report(campaign: { id: '1', name: 'test', status: 'ENABLED', channel_type: 'DISPLAY', serving_status: 'SERVING', bidding_strategy: 'TARGET_CPA', metrics: { cost: 0, clicks: 0, impressions: 0, conversions: 0 } })
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'campaign_search_channel' }
    assert_equal 'WARNING', check[:result]
  end

  def test_fail_no_enabled_ad_groups
    report = make_report(ad_groups: [{ id: '100', name: 'AG1', status: 'PAUSED', metrics: { cost: 0, clicks: 0, impressions: 0, conversions: 0 } }])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'has_enabled_ad_groups' }
    assert_equal 'FAIL', check[:result]
  end

  def test_fail_no_enabled_keywords
    report = make_report(keywords: [{ text: 'test', match_type: 'BROAD', status: 'PAUSED', quality_score: 5, ad_group_id: '100', ad_group_name: 'AG1' }])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'has_enabled_keywords' }
    assert_equal 'FAIL', check[:result]
  end

  def test_fail_no_enabled_rsa_ads
    report = make_report(ads: [{ type: 'RESPONSIVE_SEARCH_AD', status: 'PAUSED', ad_strength: 'POOR', headlines: ['H1'], descriptions: ['D1'], policy_issues: [], ad_group_id: '100', ad_group_name: 'AG1' }])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'has_enabled_rsa_ads' }
    assert_equal 'FAIL', check[:result]
  end

  def test_warning_rsa_fewer_than_3_headlines
    report = make_report(ads: [{ type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', ad_strength: 'GOOD', headlines: ['H1', 'H2'], descriptions: ['D1', 'D2'], policy_issues: [], ad_group_id: '100', ad_group_name: 'AG1' }])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'rsa_minimum_assets' }
    assert_equal 'WARNING', check[:result]
  end

  def test_warning_rsa_fewer_than_2_descriptions
    report = make_report(ads: [{ type: 'RESPONSIVE_SEARCH_AD', status: 'ENABLED', ad_strength: 'GOOD', headlines: ['H1', 'H2', 'H3'], descriptions: ['D1'], policy_issues: [], ad_group_id: '100', ad_group_name: 'AG1' }])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'rsa_minimum_assets' }
    assert_equal 'WARNING', check[:result]
  end

  def test_warning_fewer_than_2_sitelinks
    report = make_report(sitelinks: [{ id: '500', link_text: 'Only One', description1: '', description2: '', final_url: 'https://example.com', status: 'ENABLED' }])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'has_sitelinks' }
    assert_equal 'WARNING', check[:result]
  end

  def test_fail_no_sitelinks
    report = make_report(sitelinks: [])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'has_sitelinks' }
    assert_equal 'FAIL', check[:result]
  end

  def test_warning_no_other_assets
    report = make_report(assets: [])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'has_other_assets' }
    assert_equal 'WARNING', check[:result]
  end

  def test_warning_no_negative_keywords
    report = make_report(negatives: [])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'has_negative_keywords' }
    assert_equal 'WARNING', check[:result]
  end

  def test_warning_no_enabled_conversion_actions
    report = make_report(conversion_actions: [{ id: '700', name: 'Old', status: 'PAUSED', category: 'LEAD' }])
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    check = findings.find { |f| f[:check] == 'has_conversion_tracking' }
    assert_equal 'WARNING', check[:result]
  end

  def test_summary_counts_are_correct
    report = make_report
    findings = BuckAds::CampaignAnalysis.run_checks(report)
    summary = findings.find { |f| f[:check] == '_summary' }
    assert summary[:pass_count] > 0
    assert_equal 0, summary[:warn_count]
    assert_equal 0, summary[:fail_count]
  end

  # ─── Text Formatter Tests ────────────────────────────────────────────────

  def test_format_text_report_contains_campaign_name
    report = make_report
    report[:findings] = BuckAds::CampaignAnalysis.run_checks(report)
    text = BuckAds::TextFormatter.format_report(report)
    assert_includes text, 'business-purchase-us'
    assert_includes text, 'Campaign Readiness Report'
    assert_includes text, 'PASS'
  end

  # ─── Build Report Integration Test ───────────────────────────────────────

  def test_build_report_assembles_full_report
    raw = {
      campaign: campaign_row,
      ad_groups: ad_group_rows,
      keywords: keyword_rows,
      ads: ad_rows,
      sitelinks: sitelink_rows,
      assets: asset_rows,
      negatives: negative_rows,
      conversion_actions: conversion_rows
    }
    report = BuckAds::CampaignAnalysis.build_report(raw)
    assert_equal 'business-purchase-us', report[:campaign][:name]
    assert_equal 3, report[:ad_groups].length
    assert_equal 4, report[:keywords].length
    assert_equal 2, report[:ads].length
    assert_equal 2, report[:sitelinks].length
    assert_equal 2, report[:assets].length
    assert_equal 2, report[:negatives].length
    assert_equal 2, report[:conversion_actions].length
    refute_nil report[:findings]
    assert report[:findings].length > 0
  end

  def test_build_report_handles_null_campaign
    raw = {
      campaign: nil,
      ad_groups: [], keywords: [], ads: [],
      sitelinks: [], assets: [], negatives: [], conversion_actions: []
    }
    report = BuckAds::CampaignAnalysis.build_report(raw)
    assert_nil report[:campaign]
    found = report[:findings].find { |f| f[:check] == 'campaign_found' }
    assert_equal 'FAIL', found[:result]
  end
end
