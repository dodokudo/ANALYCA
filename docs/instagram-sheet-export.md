# Instagram DB → existing Google Sheet

The authenticated `/api/sync/instagram/sheet-export` cron runs daily at **02:30 JST** (`30 17 * * *`).
Only `instagram_sheet_sources` rows with `export_enabled=TRUE` are exported. The existing hourly LINE import remains independent.

## Scope

- `Instagram insight!A:G`: daily DB observations from `export_insights_start_date` onward. Engagement uses `total_interactions`, matching the original Apps Script, rather than `accounts_engaged`.
- `reel rawdata!A:P`: stored reels plus their latest saved metric snapshots. Watch time converts seconds to Sheets days. Q formulas support both archived Drive and direct image URLs.
- `stories rawdata!A:L`: stored story observations and image URLs. `stories!H` supports Drive and archived GCS images; B/H formulas extend with new raw rows.
- Existing row order and unmatched history remain. IDs are string values. Permalinks reconcile legacy rounded/missing IDs; a unique timestamp reconciles the legacy row whose URL was replaced with a copied page title. Ambiguous matches fail before writing.
- Missing observations preserve the previous cell; they never replace saved counts with zero. A measured zero remains zero.
- No direct metrics are written to `daily`, `月次サマリー`, `reel`, `LINE daily`, account configuration, or retired manual fields.

## Monthly story tabs

The same daily job repairs a missing current-month tab and prepares the following month on the last Japanese calendar day. Existing monthly tabs are identified by their C2 date; historical selectors and manual notes are preserved. Missing tabs duplicate the latest layout, clear copied inputs, and restore only labels, C2 and the five display formulas. Empty months use IFNA, and columns grow if needed. Existing November/December 2026 tabs are reused.

## Reliability and cutover

Apply `scripts/migrations/20261027-instagram-sheet-export.sql` before deployment. New sources are disabled by default. Stop only the three legacy Instagram retrieval functions before enabling export. Keep `getLineDailyData` and remove Instagram calls from the old combined initialization/trigger menus.

The existing bound Apps Script retains its trigger definitions and legacy source for rollback. Its three Instagram entrypoints return immediately while `INSTAGRAM_DB_EXPORT_ENABLED=true`; they perform no API calls or sheet writes. The LINE source and its trigger remain unchanged. The combined menu only starts LINE retrieval and cannot recreate Instagram writers.

For user `33833959932919231`, the destination is `1FPl5JTHTqNpiMyjvCH0TxZtvx8x_nHMzdX2rHaykbTA`, and the daily insight cutover is **2026-10-23**, after the last existing sheet observation. Historical sheet values through October 22 are preserved because older DB observations differ; this change does not reconcile those historical differences. Historical missing followers or unavailable metrics are not fabricated.

Each source uses a conditional BigQuery lease with a 10-minute expiry, longer than the route's 5-minute limit. A single Sheets batch applies each plan atomically. Readback of all three raw tables must match before updating `last_export_at`. Failures set `last_export_error` and return a non-success HTTP status. Retrying upserts the same keys instead of appending duplicates. Source data and Google API credentials are never returned by the route.

Tests: `node --import ./scripts/register-ts-tests.mjs --test lib/__tests__/instagram-sheet-export.test.ts`
