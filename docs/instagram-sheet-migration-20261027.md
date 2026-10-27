# Instagram history migration (2026-10-27)

- Account: `33833959932919231`; destination: `/33833959932919231?tab=instagram`.
- Source spreadsheet: `1FPl5JTHTqNpiMyjvCH0TxZtvx8x_nHMzdX2rHaykbTA`.
- Source records: 444 reels, 833 stories, 476 raw insight days plus the daily sheet's 2025-06-19 post-count record, 489 unique LINE days.
- Instagram history is a one-time import. Future Instagram collection uses the existing reel/insight/story jobs and token refresh.
- LINE alone continues from `LINE daily` and `daily` (column O registrations). `/api/sync/instagram/sheet-line` runs hourly at minute 15, requires `CRON_SECRET`, and processes enabled `instagram_sheet_sources`. Failures retain saved data, record `last_error`, and return a failure status.

## Data rules

- History MERGEs fill missing cells; existing non-null API values and snapshots win. Reimporting does not add duplicate posts or dates.
- Daily LINE counts are preserved, not derived again from cumulative totals. Duplicate exports are not summed. Missing source days remain unavailable.
- Raw story columns E/F mean views/reach; the processed sheet reverses the labels and is not the metric source.
- Watch durations are spreadsheet day fractions, converted to hours for legacy storage. They must not be parsed from the wrapped time display.
- Reel IDs are reconciled using the account's API media list, URL and publication timestamp. One missing ID and one duplicated/wrong ID were recovered. Eight rounded numeric IDs were verified by API. One unavailable reel and seven expired stories retain explicit `sheet:` archive keys; their saved metrics remain visible, with no invented Graph IDs.
- Manual reel title/duration/follows remain separate from newer API metrics. A live request for reel `follows` returned HTTP 400/code 100, unsupported for this media product type; do not treat this as missing OAuth permission or replace it with zero.
- Retain both clearly labelled save-rate denominators (views and reach). Story rates use the followers recorded for the publication day. Missing previous-day follower totals do not imply zero growth.
- Historical exports are cumulative observations, not authenticated 24-hour-after-posting snapshots.

## Recovery and verification

Private source snapshots, ID reconciliation, pre-import account rows and verification reports are under ignored `tmp/ig-sheet-migration-20261027/`; no credentials or customer source data are committed.

The scripts default to a dry run. With a verified source snapshot and API media inventory:

```sh
node --import ./scripts/register-ts-tests.mjs scripts/resolve-instagram-sheet-ids.ts SOURCE.json API_MEDIA.json
node --env-file=.env.local --import ./scripts/register-ts-tests.mjs scripts/import-instagram-sheet.ts RESOLVED_SOURCE.json 33833959932919231
```

Add `--apply` only for an authorized import. The import creates the additive schema, saves account-scoped backups once, validates unique database keys, and enables LINE sync. Keep the original spreadsheet; it remains the LINE source.
