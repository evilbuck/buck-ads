# buck-ads

Google Ads campaign automation CLI with safety-first guards. Create and verify Search campaigns from declarative specs — dry-run by default, never touches budgets or bids.

## Install

```bash
npm install
cp .env.example .env
# Fill in your Google Ads credentials in .env
```

## Quick Start

```bash
# List campaigns
node src/cli.js campaigns

# Plan a campaign spec (dry-run validation)
node src/cli.js plan-campaign --template=qrpro-bofu-us

# Create campaign from spec (dry-run by default)
node src/cli.js create-campaign-from-spec --template=qrpro-bofu-us

# Get search terms report
node src/cli.js search-terms --min-cost=0.20

# Add negative keywords
node src/cli.js add-negatives --campaign="Campaign Name" --keywords="free,gratis,tutorial"
```

## Commands

| Command | Description |
|---------|-------------|
| `campaigns` | List all campaigns with metrics |
| `search-terms [--min-cost=X] [--campaign=Name]` | Get search terms report |
| `negatives --campaign="Name"` | List negative keywords |
| `add-negatives --campaign="Name" --keywords="kw1,kw2"` | Add negative keywords |
| `plan-campaign --template=Name` | Validate and plan a campaign spec |
| `create-campaign-from-spec --template=Name [--dry-run] [--budget-resource=X]` | Create campaign from spec |
| `verify-campaign --campaign="Name"` | Verify campaign settings |

## Safety Model

All mutations are guarded by safety invariants that **cannot be overridden**:

| Guard | What is blocked |
|-------|----------------|
| PAUSED only | Campaign creation with any status other than PAUSED |
| No budget | Any mutation targeting budget |
| No bidding | Any mutation to bids or bidding strategy |
| EXACT/PHRASE only | BROAD match keywords are rejected at validation time |

Campaigns are always created PAUSED. Set budget and enable manually in Google Ads UI.

## Spec Authoring

Campaign specs are JavaScript modules. See `specs/qrpro-bofu-us.js` for a complete example and `specs/README.md` for the spec format guide.

```bash
# Use specs from the default ./specs directory
node src/cli.js plan-campaign --template=qrpro-bofu-us

# Use specs from a custom directory
node src/cli.js plan-campaign --template=my-campaign --specs-dir=/path/to/my/specs
```

## Files

```
src/
  client.js           Google Ads API client setup
  campaign-builder.js  Builder, validation, safety guards
  cli.js              CLI entry point
specs/                Campaign spec examples
scripts/              Example restructure scripts
tests/                Jest test suite (64 tests)
docs/                 Operator guide
skills/               Methodology skills
.env.example          Environment variable template
```
