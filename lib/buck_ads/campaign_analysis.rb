# frozen_string_literal: true

require 'json'

module BuckAds
  # Campaign readiness analysis for Google Ads.
  # Gathers campaign data via GAQL queries, normalizes raw API rows,
  # runs deterministic health checks, and produces JSON/text reports.
  #
  # This module is data-only — no live API calls.
  # The caller (CLI) is responsible for running GAQL queries
  # and passing raw results to build_report().
  module CampaignAnalysis
    # ─── Query Builders ──────────────────────────────────────────────────────

    # Build GAQL query for campaign basics.
    def self.query_campaign(campaign_name, date_range = 'LAST_30_DAYS')
      escaped = campaign_name.gsub("'", "\\\\'")
      <<~GAQL
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          campaign.serving_status,
          campaign.bidding_strategy_type,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.all_conversions
        FROM campaign
        WHERE campaign.name = '#{escaped}'
          AND segments.date DURING #{date_range}
      GAQL
    end

    # Build GAQL query for ad groups with metrics.
    def self.query_ad_groups(campaign_resource, date_range = 'LAST_30_DAYS')
      <<~GAQL
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.all_conversions
        FROM ad_group
        WHERE ad_group.campaign = '#{campaign_resource}'
          AND segments.date DURING #{date_range}
      GAQL
    end

    # Build GAQL query for keywords.
    def self.query_keywords(campaign_resource)
      <<~GAQL
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.quality_info.quality_score,
          ad_group_criterion.status
        FROM ad_group_criterion
        WHERE campaign.id = '#{campaign_resource.split('/').last}'
          AND ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.negative = FALSE
      GAQL
    end

    # Build GAQL query for ads (RSA).
    def self.query_ads(campaign_resource)
      <<~GAQL
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group_ad.ad.type,
          ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions,
          ad_group_ad.status,
          ad_group_ad.ad_strength,
          ad_group_ad.policy_summary.policy_topic_entries
        FROM ad_group_ad
        WHERE campaign.id = '#{campaign_resource.split('/').last}'
      GAQL
    end

    # Build GAQL query for sitelink assets.
    def self.query_sitelinks(campaign_resource)
      <<~GAQL
        SELECT
          asset.id,
          asset.name,
          asset.sitelink_asset.link_text,
          asset.sitelink_asset.description1,
          asset.sitelink_asset.description2,
          campaign_asset.status
        FROM campaign_asset
        WHERE campaign_asset.campaign = '#{campaign_resource}'
          AND campaign_asset.field_type = 'SITELINK'
      GAQL
    end

    # Build GAQL query for other assets (callouts, snippets, etc.).
    def self.query_assets(campaign_resource)
      <<~GAQL
        SELECT
          asset.id,
          asset.name,
          asset.callout_asset.callout_text,
          asset.structured_snippet_asset.header,
          asset.structured_snippet_asset.values,
          campaign_asset.status,
          campaign_asset.field_type
        FROM campaign_asset
        WHERE campaign_asset.campaign = '#{campaign_resource}'
          AND campaign_asset.field_type != 'SITELINK'
      GAQL
    end

    # Build GAQL query for campaign-level negative keywords.
    def self.query_negatives(campaign_resource)
      <<~GAQL
        SELECT
          campaign_criterion.keyword.text,
          campaign_criterion.keyword.match_type,
          campaign_criterion.negative
        FROM campaign_criterion
        WHERE campaign_criterion.campaign = '#{campaign_resource}'
          AND campaign_criterion.type = 'KEYWORD'
          AND campaign_criterion.negative = TRUE
      GAQL
    end

    # Build GAQL query for conversion actions (account-level).
    def self.query_conversion_actions
      <<~GAQL
        SELECT
          conversion_action.id,
          conversion_action.name,
          conversion_action.status,
          conversion_action.category,
          conversion_action.type,
          conversion_action.counting_type
        FROM conversion_action
      GAQL
    end

    # ─── Normalizers ─────────────────────────────────────────────────────────

    # Convert micros to dollars.
    def self.micros_to_dollars(micros)
      (micros || 0).to_i / 1_000_000.0
    end

    # Convert a protobuf enum/value to a string, handling symbols, strings, and nil.
    def self.enum_to_s(val)
      return 'UNKNOWN' if val.nil?
      val.to_s
    end

    # Safely access a method on a protobuf object, returning default if missing.
    def self.safe_send(obj, method, default = '')
      return default if obj.nil?
      return default unless obj.respond_to?(method)
      val = obj.send(method)
      val.nil? ? default : val
    end

    private_class_method :safe_send

    # Normalize a raw campaign row.
    def self.normalize_campaign(row)
      return nil unless row

      c = row.campaign
      m = row.metrics

      {
        id: safe_send(c, :id, '').to_s,
        name: safe_send(c, :name, '').to_s,
        status: enum_to_s(safe_send(c, :status, nil)),
        channel_type: enum_to_s(safe_send(c, :advertising_channel_type, nil)),
        serving_status: enum_to_s(safe_send(c, :serving_status, nil)),
        bidding_strategy: enum_to_s(safe_send(c, :bidding_strategy_type, nil)),
        start_date: safe_send(c, :start_date, '').to_s,
        end_date: safe_send(c, :end_date, '').to_s,
        metrics: {
          cost: micros_to_dollars(m&.cost_micros),
          clicks: (m&.clicks || 0).to_i,
          impressions: (m&.impressions || 0).to_i,
          conversions: (m&.all_conversions || 0).to_i
        }
      }
    end

    # Normalize raw ad group rows.
    def self.normalize_ad_groups(rows)
      return [] unless rows

      rows.map do |row|
        ag = row.ad_group
        m = row.metrics
        {
          id: (ag.id || '').to_s,
          name: (ag.name || '').to_s,
          status: enum_to_s(ag.status),
          metrics: {
            cost: micros_to_dollars(m&.cost_micros),
            clicks: (m&.clicks || 0).to_i,
            impressions: (m&.impressions || 0).to_i,
            conversions: (m&.all_conversions || 0).to_i
          }
        }
      end
    end

    # Normalize raw keyword rows.
    def self.normalize_keywords(rows)
      return [] unless rows

      rows.map do |row|
        ag = row.ad_group
        crit = row.ad_group_criterion
        kw = crit.keyword
        qi = crit.quality_info

        quality_score = qi.respond_to?(:quality_score) ? qi.quality_score : nil

        {
          text: (kw.text || '').to_s,
          match_type: enum_to_s(kw.match_type),
          status: enum_to_s(crit.status),
          quality_score: quality_score.nil? ? nil : quality_score.to_i,
          ad_group_id: (ag.id || '').to_s,
          ad_group_name: (ag.name || '').to_s
        }
      end
    end

    # Normalize raw ad rows (RSA focused).
    def self.normalize_ads(rows)
      return [] unless rows

      rows.map do |row|
        ag = row.ad_group
        aga = row.ad_group_ad
        ad = aga.ad
        rsa = ad.respond_to?(:responsive_search_ad) ? ad.responsive_search_ad : nil

        headlines = extract_ad_texts(rsa&.headlines)
        descriptions = extract_ad_texts(rsa&.descriptions)

        policy_entries = aga.policy_summary&.policy_topic_entries || []
        policy_issues = policy_entries.map { |e| e.respond_to?(:topic) ? e.topic.to_s : e.to_s }

        {
          type: enum_to_s(ad.type),
          status: enum_to_s(aga.status),
          ad_strength: enum_to_s(aga.ad_strength),
          headlines: headlines,
          descriptions: descriptions,
          policy_issues: policy_issues,
          ad_group_id: (ag.id || '').to_s,
          ad_group_name: (ag.name || '').to_s
        }
      end
    end

    # Normalize raw sitelink asset rows.
    def self.normalize_sitelinks(rows)
      return [] unless rows

      rows.map do |row|
        asset = row.asset
        sa = asset.sitelink_asset
        ca = row.campaign_asset
        urls = sa.respond_to?(:final_urls) ? (sa.final_urls || []) : []

        {
          id: (asset.id || '').to_s,
          link_text: (sa&.link_text || '').to_s,
          description1: (sa&.description1 || '').to_s,
          description2: (sa&.description2 || '').to_s,
          final_url: (urls.first || '').to_s,
          status: enum_to_s(ca.status)
        }
      end
    end

    # Normalize raw non-sitelink asset rows.
    def self.normalize_assets(rows)
      return [] unless rows

      rows.map do |row|
        asset = row.asset
        ca = row.campaign_asset
        callout = asset.callout_asset
        snippet = asset.structured_snippet_asset

        text = if callout&.callout_text && !callout.callout_text.to_s.empty?
                 callout.callout_text.to_s
               elsif snippet&.header && !snippet.header.to_s.empty?
                 values = (snippet.values || []).map(&:to_s).join(', ')
                 "#{snippet.header}: #{values}"
               else
                 ''
               end

        {
          id: (asset.id || '').to_s,
          name: (asset.name || '').to_s,
          field_type: enum_to_s(ca.field_type),
          text: text,
          status: enum_to_s(ca.status)
        }
      end
    end

    # Normalize raw negative keyword rows.
    def self.normalize_negatives(rows)
      return [] unless rows

      rows.select { |r| r.campaign_criterion&.negative }.map do |row|
        kw = row.campaign_criterion&.keyword
        {
          text: (kw&.text || '').to_s,
          match_type: enum_to_s(kw&.match_type)
        }
      end
    end

    # Normalize raw conversion action rows.
    def self.normalize_conversion_actions(rows)
      return [] unless rows

      rows.map do |row|
        ca = row.conversion_action
        {
          id: (ca.id || '').to_s,
          name: (ca.name || '').to_s,
          status: enum_to_s(ca.status),
          category: enum_to_s(ca.category),
          type: enum_to_s(ca.type),
          counting_type: enum_to_s(ca.counting_type)
        }
      end
    end

    # ─── Deterministic Checks ───────────────────────────────────────────────

    # Run deterministic readiness checks against a normalized report.
    def self.run_checks(report)
      findings = []

      # Campaign found
      if report[:campaign].nil?
        findings << { check: 'campaign_found', result: 'FAIL', detail: 'Campaign not found' }
        findings << make_summary(findings)
        return findings
      end
      findings << { check: 'campaign_found', result: 'PASS', detail: "Campaign \"#{report[:campaign][:name]}\" found" }

      # Campaign status
      if report[:campaign][:status] == 'ENABLED'
        findings << { check: 'campaign_status_enabled', result: 'PASS', detail: "Campaign status: #{report[:campaign][:status]}" }
      else
        findings << { check: 'campaign_status_enabled', result: 'FAIL', detail: "Campaign status: #{report[:campaign][:status]}" }
      end

      # Search channel
      if report[:campaign][:channel_type] == 'SEARCH'
        findings << { check: 'campaign_search_channel', result: 'PASS', detail: "Channel: #{report[:campaign][:channel_type]}" }
      else
        findings << { check: 'campaign_search_channel', result: 'WARNING', detail: "Channel: #{report[:campaign][:channel_type]} (expected SEARCH)" }
      end

      # Enabled ad groups
      enabled_ad_groups = report[:ad_groups].select { |ag| ag[:status] == 'ENABLED' }
      if enabled_ad_groups.any?
        findings << { check: 'has_enabled_ad_groups', result: 'PASS', detail: "#{enabled_ad_groups.length} enabled ad group(s) out of #{report[:ad_groups].length}" }
      else
        findings << { check: 'has_enabled_ad_groups', result: 'FAIL', detail: 'No enabled ad groups' }
      end

      # Enabled keywords
      enabled_keywords = report[:keywords].select { |kw| kw[:status] == 'ENABLED' }
      if enabled_keywords.any?
        findings << { check: 'has_enabled_keywords', result: 'PASS', detail: "#{enabled_keywords.length} enabled keyword(s)" }
      else
        findings << { check: 'has_enabled_keywords', result: 'FAIL', detail: 'No enabled keywords' }
      end

      # Enabled RSA ads
      enabled_rsa = report[:ads].select { |ad| ad[:status] == 'ENABLED' && ad[:type] == 'RESPONSIVE_SEARCH_AD' }
      if enabled_rsa.any?
        findings << { check: 'has_enabled_rsa_ads', result: 'PASS', detail: "#{enabled_rsa.length} enabled RSA ad(s)" }
      else
        findings << { check: 'has_enabled_rsa_ads', result: 'FAIL', detail: 'No enabled RSA ads' }
      end

      # RSA minimum assets
      rsa_asset_issues = []
      enabled_rsa.each do |ad|
        rsa_asset_issues << "#{ad[:ad_group_name]}: #{ad[:headlines].length} headline(s)" if ad[:headlines].length < 3
        rsa_asset_issues << "#{ad[:ad_group_name]}: #{ad[:descriptions].length} description(s)" if ad[:descriptions].length < 2
      end
      if rsa_asset_issues.empty? && enabled_rsa.any?
        findings << { check: 'rsa_minimum_assets', result: 'PASS', detail: 'All enabled RSAs have ≥ 3 headlines and ≥ 2 descriptions' }
      elsif rsa_asset_issues.any?
        findings << { check: 'rsa_minimum_assets', result: 'WARNING', detail: "RSA asset gaps: #{rsa_asset_issues.join('; ')}" }
      else
        findings << { check: 'rsa_minimum_assets', result: 'WARNING', detail: 'No enabled RSAs to check' }
      end

      # Sitelinks
      enabled_sitelinks = report[:sitelinks].select { |s| s[:status] == 'ENABLED' }
      if enabled_sitelinks.length >= 2
        findings << { check: 'has_sitelinks', result: 'PASS', detail: "#{enabled_sitelinks.length} enabled sitelink(s)" }
      elsif enabled_sitelinks.length == 1
        findings << { check: 'has_sitelinks', result: 'WARNING', detail: 'Only 1 sitelink (recommended: ≥ 2)' }
      else
        findings << { check: 'has_sitelinks', result: 'FAIL', detail: 'No enabled sitelinks' }
      end

      # Other assets
      enabled_assets = report[:assets].select { |a| a[:status] == 'ENABLED' }
      if enabled_assets.any?
        findings << { check: 'has_other_assets', result: 'PASS', detail: "#{enabled_assets.length} other asset(s) (callouts, snippets, etc.)" }
      else
        findings << { check: 'has_other_assets', result: 'WARNING', detail: 'No other assets (callouts, snippets, etc.)' }
      end

      # Negative keywords
      if report[:negatives].any?
        findings << { check: 'has_negative_keywords', result: 'PASS', detail: "#{report[:negatives].length} negative keyword(s)" }
      else
        findings << { check: 'has_negative_keywords', result: 'WARNING', detail: 'No negative keywords configured' }
      end

      # Conversion tracking
      enabled_conversions = report[:conversion_actions].select { |ca| ca[:status] == 'ENABLED' }
      if enabled_conversions.any?
        findings << { check: 'has_conversion_tracking', result: 'PASS', detail: "#{enabled_conversions.length} enabled conversion action(s)" }
      else
        findings << { check: 'has_conversion_tracking', result: 'WARNING', detail: 'No enabled conversion actions (note: conversion actions are account-level, not campaign-scoped)' }
      end

      findings << make_summary(findings)
      findings
    end

    # Build a summary finding from the accumulated checks.
    def self.make_summary(findings)
      checks = findings.reject { |f| f[:check] == '_summary' }
      pass_count = checks.count { |c| c[:result] == 'PASS' }
      warn_count = checks.count { |c| c[:result] == 'WARNING' }
      fail_count = checks.count { |c| c[:result] == 'FAIL' }

      {
        check: '_summary',
        result: 'INFO',
        detail: "#{checks.length} checks: #{pass_count} pass, #{warn_count} warning(s), #{fail_count} fail(s)",
        pass_count: pass_count,
        warn_count: warn_count,
        fail_count: fail_count
      }
    end

    # ─── Report Builder ─────────────────────────────────────────────────────

    # Build a normalized report from raw query results.
    def self.build_report(raw)
      report = {
        campaign: normalize_campaign(raw[:campaign]),
        ad_groups: normalize_ad_groups(raw[:ad_groups]),
        keywords: normalize_keywords(raw[:keywords]),
        ads: normalize_ads(raw[:ads]),
        sitelinks: normalize_sitelinks(raw[:sitelinks]),
        assets: normalize_assets(raw[:assets]),
        negatives: normalize_negatives(raw[:negatives]),
        conversion_actions: normalize_conversion_actions(raw[:conversion_actions])
      }
      report[:findings] = run_checks(report)
      report
    end

    # ─── Instance-based Analysis ─────────────────────────────────────────────

    # Run a full campaign analysis using a live client.
    def self.analyze(client, customer_id, campaign_name, date_range: 'LAST_30_DAYS')
      service = client.service.google_ads

      # 1. Resolve campaign
      campaign_rows = service.search(customer_id: customer_id, query: query_campaign(campaign_name, date_range)).to_a
      campaign_row = campaign_rows.first

      unless campaign_row
        return build_report(
          campaign: nil, ad_groups: [], keywords: [], ads: [],
          sitelinks: [], assets: [], negatives: [], conversion_actions: []
        )
      end

      campaign_resource = "customers/#{customer_id}/campaigns/#{campaign_row.campaign.id}"

      # 2. Run all data queries
      ad_group_rows = safe_search(service, customer_id, query_ad_groups(campaign_resource, date_range))
      keyword_rows = safe_search(service, customer_id, query_keywords(campaign_resource))
      ad_rows = safe_search(service, customer_id, query_ads(campaign_resource))
      sitelink_rows = safe_search(service, customer_id, query_sitelinks(campaign_resource))
      asset_rows = safe_search(service, customer_id, query_assets(campaign_resource))
      negative_rows = safe_search(service, customer_id, query_negatives(campaign_resource))
      conversion_rows = safe_search(service, customer_id, query_conversion_actions)

      build_report(
        campaign: campaign_row,
        ad_groups: ad_group_rows,
        keywords: keyword_rows,
        ads: ad_rows,
        sitelinks: sitelink_rows,
        assets: asset_rows,
        negatives: negative_rows,
        conversion_actions: conversion_rows
      )
    end

    # Run a GAQL search with error handling, returning empty array on failure.
    def self.safe_search(service, customer_id, query)
      service.search(customer_id: customer_id, query: query).to_a
    rescue StandardError => e
      msg = e.respond_to?(:failure) && e.failure ? e.failure.errors.map(&:message).join('; ') : e.message
      $stderr.puts "Warning: query failed: #{msg}"
      []
    end

    private_class_method :safe_search

    # ─── Helpers ─────────────────────────────────────────────────────────────

    # Extract text strings from ad text asset arrays (protobuf or plain).
    def self.extract_ad_texts(assets)
      return [] unless assets

      assets.map do |a|
        if a.respond_to?(:text)
          a.text.to_s
        else
          a.to_s
        end
      end
    end

    private_class_method :extract_ad_texts
  end

  # Text formatter for campaign readiness reports.
  module TextFormatter
    # Format a report as human-readable text.
    def self.format_report(report)
      lines = []

      lines << '═══════════════════════════════════════════════'
      lines << '  Campaign Readiness Report'
      lines << '═══════════════════════════════════════════════'
      lines << ''

      unless report[:campaign]
        lines << '❌ Campaign not found.'
        return lines.join("\n")
      end

      c = report[:campaign]
      lines << "Campaign:   #{c[:name]}"
      lines << "Status:     #{c[:status]}"
      lines << "Channel:    #{c[:channel_type]}"
      lines << "Serving:    #{c[:serving_status]}"
      lines << "Bidding:    #{c[:bidding_strategy]}"
      lines << "Cost:       $#{'%.2f' % c[:metrics][:cost]}"
      lines << "Clicks:     #{c[:metrics][:clicks]}"
      lines << "Impr:       #{c[:metrics][:impressions]}"
      lines << "Convs:      #{c[:metrics][:conversions]}"
      lines << ''

      # Ad Groups
      lines << "── Ad Groups (#{report[:ad_groups].length}) ──"
      report[:ad_groups].each do |ag|
        icon = ag[:status] == 'ENABLED' ? '●' : '○'
        lines << "  #{icon} #{ag[:name]} [#{ag[:status]}] — $#{'%.2f' % ag[:metrics][:cost]}, #{ag[:metrics][:clicks]} clicks, #{ag[:metrics][:conversions]} conv"
      end
      lines << ''

      # Keywords
      lines << "── Keywords (#{report[:keywords].length}) ──"
      report[:keywords].each do |kw|
        icon = kw[:status] == 'ENABLED' ? '●' : '○'
        qs = kw[:quality_score] ? " QS:#{kw[:quality_score]}" : ''
        lines << "  #{icon} [#{kw[:match_type]}] \"#{kw[:text]}\"#{qs} (#{kw[:ad_group_name]})"
      end
      lines << ''

      # Ads
      lines << "── Ads (#{report[:ads].length}) ──"
      report[:ads].each do |ad|
        icon = ad[:status] == 'ENABLED' ? '●' : '○'
        lines << "  #{icon} #{ad[:type]} [#{ad[:status]}] strength:#{ad[:ad_strength]} (#{ad[:ad_group_name]})"
        lines << "     Headlines: #{ad[:headlines].join(' | ')}" if ad[:headlines].any?
        lines << "     Descriptions: #{ad[:descriptions].join(' | ')}" if ad[:descriptions].any?
        lines << "     ⚠️  Policy issues: #{ad[:policy_issues].join(', ')}" if ad[:policy_issues].any?
      end
      lines << ''

      # Sitelinks
      lines << "── Sitelinks (#{report[:sitelinks].length}) ──"
      report[:sitelinks].each do |sl|
        icon = sl[:status] == 'ENABLED' ? '●' : '○'
        lines << "  #{icon} #{sl[:link_text]} → #{sl[:final_url]} [#{sl[:status]}]"
        lines << "     #{sl[:description1]}" unless sl[:description1].to_s.empty?
        lines << "     #{sl[:description2]}" unless sl[:description2].to_s.empty?
      end
      lines << ''

      # Other Assets
      lines << "── Other Assets (#{report[:assets].length}) ──"
      report[:assets].each do |a|
        icon = a[:status] == 'ENABLED' ? '●' : '○'
        lines << "  #{icon} [#{a[:field_type]}] #{a[:text]} [#{a[:status]}]"
      end
      lines << ''

      # Negatives
      lines << "── Negative Keywords (#{report[:negatives].length}) ──"
      report[:negatives].each do |neg|
        lines << "  🚫 [#{neg[:match_type]}] \"#{neg[:text]}\""
      end
      lines << ''

      # Conversion Actions
      lines << "── Conversion Actions (#{report[:conversion_actions].length}) ──"
      report[:conversion_actions].each do |ca|
        icon = ca[:status] == 'ENABLED' ? '●' : '○'
        lines << "  #{icon} #{ca[:name]} [#{ca[:status]}] (#{ca[:category]})"
      end
      lines << ''

      # Findings
      lines << '── Readiness Checks ──'
      report[:findings].each do |f|
        next if f[:check] == '_summary'
        icon = case f[:result]
               when 'PASS' then '✅'
               when 'WARNING' then '⚠️'
               else '❌'
               end
        lines << "  #{icon} #{f[:result]}: #{f[:check]} — #{f[:detail]}"
      end
      lines << ''

      # Summary
      summary = report[:findings].find { |f| f[:check] == '_summary' }
      if summary
        lines << '── Summary ──'
        lines << "  #{summary[:detail]}"
        if summary[:fail_count] > 0
          lines << '  ❌ Campaign is NOT READY for deployment.'
        elsif summary[:warn_count] > 0
          lines << '  ⚠️  Campaign has warnings — review before deployment.'
        else
          lines << '  ✅ All deterministic checks passed.'
        end
      end

      lines << ''
      lines << 'Note: Conversion actions are account-level, not campaign-scoped.'
      lines << 'Note: Subjective analysis (ad quality, keyword coverage) requires model review.'

      lines.join("\n")
    end
  end
end
