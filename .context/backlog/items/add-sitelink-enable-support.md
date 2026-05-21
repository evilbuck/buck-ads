---
title: Add sitelink enable support
status: active
priority: medium
created: 2026-05-20
updated: 2026-05-20
completed: null
related:
  - skills/add-sitelinks.js
---

# Add Sitelink Enable Support

## Description
Add support for enabling (activating) sitelinks that are currently PAUSED in the business-purchase-us campaign.

## Context
- Relevant file: `scripts/add-sitelinks.js`
- Current state: 6 sitelinks created and attached to business-purchase-us, all PAUSED
- Requirements: Ability to change sitelink status from PAUSED to ENABLED
- Technical notes: Uses REST API with AssetService + CampaignAsset mutate operations

## Next Steps
- [ ] Add `enable-sitelinks` command to CLI
- [ ] Support enabling all sitelinks on a campaign
- [ ] Support enabling specific sitelinks by ID
- [ ] Test enable functionality on business-purchase-us sitelinks
