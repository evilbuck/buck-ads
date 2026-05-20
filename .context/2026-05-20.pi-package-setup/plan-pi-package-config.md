---
status: completed
date: 2026-05-20
subject: 2026-05-20.pi-package-setup
topics: [pi-package, package-json, skills]
memory: [pi-package-setup-2026-05-20.md]
---

# Plan: Configure buck-ads as Pi Package

## Goal
Configure buck-ads project as a proper Pi package so its skills are discoverable.

## Scope
- **In scope**: Add `pi` manifest to package.json, add keywords for discoverability
- **Out of scope**: Publishing to npm, creating new skills

## Affected Files
- `package.json` - Add pi manifest and keywords

## Implementation Steps
1. [x] Add `keywords: ["pi-package"]` for gallery discoverability
2. [x] Add `pi: { skills: ["./skills"] }` manifest

## Verification
- [x] package.json parses correctly
- [x] pi manifest structure matches docs

## Notes
- Skills are in `skills/google-ads-high-converting/SKILL.md`
- Package can now be installed via `pi install ./path/to/buck-ads`
