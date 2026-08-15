Cross-device sync - canonical Drive config

This version fixes the remaining cross-device issue.

How it works:
- A private config file is stored in Google Drive appDataFolder.
- That config contains the ONE canonical spreadsheet ID.
- Every device signed into the same Google account reads that same ID.
- localStorage is no longer used to decide which spreadsheet is canonical.
- If no config exists yet, the app adopts the most recently modified non-trashed
  "ניהול הוצאות" workbook, or creates a new workbook if none exists.

One-time setup:
1. Enable Google Drive API in the same Google Cloud project.
2. Deploy this version.
3. Sign out of the app and sign in again on each device once.
   Google must grant the new drive.appdata scope.

Recommended clean reset:
If you do not need any old data, delete old "ניהול הוצאות" files first,
then deploy and sign in on ONE device first. Let it create the workbook.
After that, sign in on the other devices.
