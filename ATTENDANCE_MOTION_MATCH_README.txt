Expense tracker — motion matched to the latest attendance app.

Copied the attendance app's motion approach:
- one keyed scene animation only
- no document.startViewTransition
- no overlapping route animations
- no transition blur/filter
- short direction-aware horizontal movement
- one shared sliding glass selector in the bottom nav
- attendance-style spring timing for the selector
- static ambient background instead of continuously moving light blobs

No financial logic, Google Sheets/API, authentication, sync, transactions,
wallet, credit or budget behavior changed.
