function pad(value) {
  return String(value).padStart(2, '0')
}

export function toIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function getMonthKey(date = new Date()) {
  const parsed = date instanceof Date ? date : parseDate(date)
  const safeDate = parsed ?? new Date()
  return `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}`
}

export function getMonthStart(monthKey = getMonthKey()) {
  const match = String(monthKey).match(/^(\d{4})-(\d{2})$/)
  if (!match) return new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  return new Date(Number(match[1]), Number(match[2]) - 1, 1)
}

export function parseDate(value) {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }

  const text = String(value).trim()

  // YYYY-MM-DD (the format used by the app now)
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) {
    const [, year, month, day] = match
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  // Older entries may be stored as DD.MM.YYYY or DD/MM/YYYY.
  match = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

export function getCreditChargeDate(transactionDate) {
  const date = parseDate(transactionDate) ?? new Date()
  const year = date.getFullYear()
  const month = date.getMonth()

  // A purchase made on/before the 10th is charged on this month's 10th.
  // A purchase made after the 10th is charged on next month's 10th.
  if (date.getDate() <= 10) return new Date(year, month, 10)
  return new Date(year, month + 1, 10)
}

export function formatIsoDate(date) {
  const parsed = parseDate(date)
  return parsed ? toIsoDate(parsed) : ''
}

export function formatHebrewDate(date) {
  const parsed = parseDate(date)
  return parsed ? parsed.toLocaleDateString('he-IL') : ''
}

export function formatHebrewMonth(date = new Date()) {
  const parsed = date instanceof Date ? date : parseDate(date)
  return (parsed ?? new Date()).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
}

export function isOnOrBefore(date, referenceDate = new Date()) {
  const parsed = parseDate(date)
  const reference = parseDate(referenceDate)
  if (!parsed || !reference) return false
  return parsed.getTime() <= reference.getTime()
}

export function computeFinancialState(summary, transactions, referenceDate = new Date()) {
  let checking = Number(summary?.checking) || 0
  let credit = 0
  let essentialSpent = 0
  let discretionarySpent = 0
  let nextCreditCharge = null

  // Existing card balance at the start of a month remains outstanding until
  // the first 10th on/after that month's tracking start.
  const initialCredit = Math.max(Number(summary?.credit) || 0, 0)
  if (initialCredit > 0) {
    const trackingStart = parseDate(summary?.trackingStartDate) ?? new Date()
    const initialChargeDate = getCreditChargeDate(trackingStart)
    if (isOnOrBefore(initialChargeDate, referenceDate)) {
      checking -= initialCredit
    } else {
      credit += initialCredit
      nextCreditCharge = initialChargeDate
    }
  }

  for (const t of transactions ?? []) {
    const amount = Math.abs(Number(t.amount) || 0)
    if (!amount) continue

    if (t.type === 'הכנסה') {
      checking += amount
      continue
    }

    if (t.budget === 'הכרחי') essentialSpent += amount
    else discretionarySpent += amount

    if (t.paymentMethod === 'אשראי') {
      const chargeDate = parseDate(t.chargeDate) ?? getCreditChargeDate(t.date)

      if (isOnOrBefore(chargeDate, referenceDate)) {
        checking -= amount
      } else {
        credit += amount
        if (!nextCreditCharge || chargeDate < nextCreditCharge) nextCreditCharge = chargeDate
      }
    } else {
      // Cash/direct expenses reduce checking immediately.
      checking -= amount
    }
  }

  return { checking, credit, essentialSpent, discretionarySpent, nextCreditCharge }
}
