Loading optimization based on attendance-salary UX pattern

Only loading/data-view behavior was changed. Financial/business logic was not changed.

- App preloads current summary + transactions in the background immediately after sign-in.
- Summary and Transactions use a session-memory snapshot for instant rendering between tabs.
- Both screens still refresh from Google Sheets in the background on mount.
- Concurrent duplicate fetches are deduplicated, but later refreshes still hit Google Sheets.
- Google Sheets remains the source of truth and cross-device sync behavior is unchanged.
- Credit, wallet, checking, budgets, billing dates, transaction calculations and Drive canonical spreadsheet logic were not modified.
