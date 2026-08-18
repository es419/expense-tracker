import { AuthenticationError, getGoogleAutomationSession } from '../server/googleSession.js'
import { appendTransaction, loadCurrentMonth } from '../server/expenseStore.js'
import { getCreditChargeDate, toIsoDate } from '../src/utils/billing.js'

const CATEGORY = 'מנהרות הכרמל'
const AMOUNT = 24
const PAYMENT_METHOD = 'אשראי'
const DUPLICATE_WINDOW_MINUTES = 15

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

function bearerToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

function validDate(value) {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null

  return text
}

function validTime(value) {
  const text = String(value || '').trim()
  const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  return match ? text : null
}

function minutesFromTime(value) {
  const match = String(value || '').match(/(?:^|\s)([01]\d|2[0-3]):([0-5]\d)(?:$|\s)/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function isDuplicate(transactions, date, time) {
  const targetMinutes = minutesFromTime(time)
  if (targetMinutes === null) return false

  return (transactions || []).some(transaction => {
    if (transaction?.type !== 'הוצאה') return false
    if (String(transaction?.category || '').trim() !== CATEGORY) return false
    if (String(transaction?.date || '').trim() !== date) return false

    const description = String(transaction?.description || '')
    if (!description.includes('אוטומטי')) return false

    const existingMinutes = minutesFromTime(description)
    if (existingMinutes === null) return false
    return Math.abs(existingMinutes - targetMinutes) <= DUPLICATE_WINDOW_MINUTES
  })
}

async function appendCarmelTransaction(session, date, time) {
  const monthKey = date.slice(0, 7)
  const current = await loadCurrentMonth(
    session.accessToken,
    session.cacheKey,
    monthKey,
    session.spreadsheetId
  )

  if (isDuplicate(current.transactions, date, time)) {
    return { duplicate: true, added: false, monthKey }
  }

  const transaction = {
    date,
    type: 'הוצאה',
    amount: AMOUNT,
    category: CATEGORY,
    budget: '',
    paymentMethod: PAYMENT_METHOD,
    chargeDate: toIsoDate(getCreditChargeDate(date)),
    description: `אוטומטי · ${time}`,
  }

  await appendTransaction(
    session.accessToken,
    session.cacheKey,
    monthKey,
    transaction,
    session.spreadsheetId
  )

  return { duplicate: false, added: true, monthKey, transaction }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405, { Allow: 'POST' })
    }

    const token = bearerToken(request)
    if (!token) return json({ error: 'missing_automation_token' }, 401)

    const body = await request.json().catch(() => ({}))
    const date = validDate(body.date)
    const time = validTime(body.time)
    if (!date || !time) {
      return json({ error: 'invalid_date_or_time', expected: { date: 'YYYY-MM-DD', time: 'HH:mm' } }, 400)
    }

    let session
    try {
      session = await getGoogleAutomationSession(token)
    } catch (error) {
      if (error instanceof AuthenticationError || error?.status === 401) {
        return json({ error: error?.code || 'invalid_automation_token' }, 401)
      }
      console.error('Automation session failed:', error)
      return json({ error: 'automation_session_failed' }, 500)
    }

    try {
      let result
      try {
        result = await appendCarmelTransaction(session, date, time)
      } catch (error) {
        if (error?.status !== 401) throw error
        session = await getGoogleAutomationSession(token, { forceRefresh: true })
        result = await appendCarmelTransaction(session, date, time)
      }

      return json({ ok: true, ...result })
    } catch (error) {
      console.error('Carmel automation failed:', error)
      return json({ error: error?.message || 'carmel_automation_failed' }, error?.status || 500)
    }
  },
}
