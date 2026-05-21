## Title
fix(cli): escape campaign name in search-terms GAQL query

## Body
The search-terms command interpolated @args[:campaign] directly into a
GAQL LIKE clause without escaping single quotes. All other campaign name
interpolations (resolve_campaign_id, query_campaign) properly escape
with gsub("'", "\\\\'"), but this path was missed.

Adds the same escaping pattern for consistency.

All 43 minitest tests pass.

Also adds backlog item for W3 (lazy require in CLI).
