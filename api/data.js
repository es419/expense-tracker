import {
  AuthenticationError,
  clearServerSessionCache,
  getGoogleSession,
} from '../server/googleSession.js'
import {
  appendTransaction,
  clearExpenseRuntimeCache,
  deleteTransaction,
  ensureMonthOnly,
  getExpenseSpreadsheetId,
  loadCurrentMonth,
  listAvailableMonths,
  updateSummaryCells,
  updateTransaction,
} from '../server/expenseStore.js'

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

async function executeAction(session, body) {
  const action = body.action || 'loadMonth'
  const monthKey = body.monthKey
  const spreadsheetHint = session.spreadsheetId

  switch (action) {
    case 'loadMonth':
      return loadCurrentMonth(session.accessToken, session.cacheKey, monthKey, spreadsheetHint)
    case 'ensureMonth':
      return ensureMonthOnly(session.accessToken, session.cacheKey, monthKey, spreadsheetHint)
    case 'listMonths':
      return listAvailableMonths(session.accessToken, session.cacheKey, monthKey, spreadsheetHint)
    case 'appendTransaction':
      return appendTransaction(session.accessToken, session.cacheKey, monthKey, body.transaction, spreadsheetHint)
    case 'updateTransaction':
      return updateTransaction(session.accessToken, session.cacheKey, monthKey, body.transaction, spreadsheetHint)
    case 'deleteTransaction':
      return deleteTransaction(session.accessToken, session.cacheKey, monthKey, body.rowIndex, spreadsheetHint)
    case 'updateSummaryCells':
      return updateSummaryCells(session.accessToken, session.cacheKey, monthKey, body.updates, spreadsheetHint)
    default: {
      const error = new Error('Unknown action')
      error.status = 400
      throw error
    }
  }
}

function updatedSessionCookie(session) {
  const spreadsheetId = getExpenseSpreadsheetId(session.cacheKey) || session.spreadsheetId
  return session.sessionCookieForSpreadsheet?.(spreadsheetId) || session.sessionCookie
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405, { Allow: 'POST' })
    }

    const body = await request.json().catch(() => ({}))
    let session

    try {
      session = await getGoogleSession(request)
    } catch (error) {
      if (error instanceof AuthenticationError || error?.status === 401) {
        return json(
          { authenticated: false, error: error?.code || 'not_signed_in' },
          401,
          error?.clearCookie ? { 'Set-Cookie': error.clearCookie } : {}
        )
      }
      console.error('Session setup failed:', error)
      return json({ error: 'session_failed' }, 500)
    }

    try {
      let result
      try {
        result = await executeAction(session, body)
      } catch (error) {
        // If Google unexpectedly rejects a short-lived access token, force a
        // refresh once. This also replaces any stale token carried in the
        // encrypted session cookie.
        if (error?.status !== 401) throw error

        clearExpenseRuntimeCache(session.cacheKey)
        clearServerSessionCache(session.cacheKey)
        session = await getGoogleSession(request, { forceRefresh: true })
        result = await executeAction(session, body)
      }

      return json({ ok: true, result }, 200, { 'Set-Cookie': updatedSessionCookie(session) })
    } catch (error) {
      console.error('Expense data API failed:', error)

      if (error instanceof AuthenticationError || error?.status === 401) {
        clearExpenseRuntimeCache(session?.cacheKey)
        clearServerSessionCache(session?.cacheKey)
        return json(
          { authenticated: false, error: error?.code || 'google_unauthorized' },
          401,
          error?.clearCookie ? { 'Set-Cookie': error.clearCookie } : {}
        )
      }

      return json({ error: error?.message || 'data_request_failed' }, error?.status || 500, {
        'Set-Cookie': updatedSessionCookie(session),
      })
    }
  },
}
