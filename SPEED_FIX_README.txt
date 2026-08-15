Safe performance optimization

What changed:
- The canonical spreadsheet ID is resolved from Google Drive once per loaded app session.
- Current-month tab metadata is cached in memory once per month/session.
- Financial data (transactions, summary balances, budgets, wallet, credit) is NOT cached.
  Every screen load still fetches fresh values directly from Google Sheets.
- If Google returns 403/404 because the canonical workbook was replaced/deleted,
  runtime caches are cleared and the app resolves the canonical workbook from Drive again.
- Month settings are now saved with one Sheets batchUpdate request instead of several requests.

Why cross-device sync is preserved:
- Both devices still resolve the same canonical spreadsheet from Drive.
- Actual financial data continues to be read from that same spreadsheet.
- The performance cache contains only spreadsheet ID + sheet/tab metadata, not balances/transactions.
