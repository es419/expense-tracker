Server-side Google loading refactor

Purpose
- Match the attendance app's communication pattern more closely.
- The browser now talks only to /api/data.
- The Vercel server talks to Google Sheets/Drive.

What did NOT change
- Expense/income/transfer financial logic.
- Credit billing dates and the 10th-of-month rule.
- Wallet/checking behavior.
- Budget calculations.
- Monthly carry-forward behavior.
- Canonical Google Drive spreadsheet sync between devices.

Performance changes
- Summary + transactions are read with ONE browser request.
- On the server, both are fetched together using one Sheets values:batchGet call.
- Spreadsheet ID and sheet metadata may be cached only in warm server memory.
- Financial values are never persisted locally in localStorage/IndexedDB.
- Google Sheets remains the source of truth.

Auth changes
- The browser no longer requests or receives a Google access token.
- /api/auth/session checks the encrypted HttpOnly session cookie.
- /api/data refreshes/uses the Google token only on the server.
