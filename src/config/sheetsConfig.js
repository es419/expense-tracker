export const SHEET_TABS = {
  TRANSACTIONS: 'תנועות',
  SUMMARY: 'סיכום',
}

export const TRANSACTION_COLUMNS = [
  'date',
  'type',
  'amount',
  'category',
  'budget',
  'paymentMethod',
  'chargeDate',
]

export const TRANSACTION_HEADERS = [
  'תאריך',
  'סוג',
  'סכום',
  'קטגוריה',
  'תקציב',
  'אמצעי תשלום',
  'תאריך חיוב',
]

export const TRANSACTION_TYPES = ['הוצאה', 'הכנסה']
export const BUDGET_TYPES = ['הכרחי', 'מותרות']
export const PAYMENT_METHODS = ['אשראי', 'מזומן']
export const CATEGORIES = [
  'אוכל',
  'פורנו',
  'בגדים',
  'לגו',
  'מחשבים',
  'סלולר',
  'נעליים',
  'טיפוח',
  'טעינה לאוטו',
  'ויטמינים',
]

export const GOOGLE_CLIENT_ID = '561126899858-u8npfj4vo25676q2v8updsc6e5sfr26t.apps.googleusercontent.com'
export const REDIRECT_URI = window.location.origin + '/auth/callback'
export const SCOPES = 'https://www.googleapis.com/auth/spreadsheets'
