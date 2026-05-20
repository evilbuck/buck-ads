---
date: 2026-05-20
domains: [tooling, packaging]
topics: [pi-package, package-json, skills-discovery]
subject: 2026-05-20.pi-package-setup
artifacts: [plan-pi-package-config.md]
related: []
priority: medium
status: active
---

# Session: 2026-05-20 - Configure buck-ads as Pi Package

## Context
- Previous work: None (new project setup)
- Goal: Make buck-ads a proper Pi package so its skills are discoverable by Pi

## Decisions Made
- Added `pi` manifest to package.json pointing to `./skills` directory
- Added `keywords: ["pi-package"]` for gallery discoverability
- Named skill is `google-ads-high-converting` in `skills/` directory

## Implementation Notes
- Key files modified: `package.json`
- Skills location: `skills/google-ads-high-converting/SKILL.md`
- Installation command: `pi install ./path/to/buck-ads` (local) or `pi install npm:buck-ads@1.0.0` (published)

## Next Steps
- [ ] Test package installation with `pi install ./`
- [ ] Consider publishing to npm for broader distribution
