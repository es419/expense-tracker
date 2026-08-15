Cross-device sync fix

This version no longer treats localStorage as the source of truth for the Google Sheet.
On every device it:
1. Uses the cached spreadsheet ID only if it still exists.
2. Otherwise searches Google Drive for the app-created "ניהול הוצאות" spreadsheet.
3. Reuses that file when found.
4. Creates a new one only when none exists.

IMPORTANT one-time Google Cloud step:
Enable the Google Drive API for the same Google Cloud project used by the app.
The OAuth scope now also includes:
https://www.googleapis.com/auth/drive.file

After deploying, sign out and sign in again once so Google can grant the new scope.
