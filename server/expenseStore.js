import {
  SHEET_TABS,
  TRANSACTION_COLUMNS,
  TRANSACTION_HEADERS,
} from '../src/config/sheetsConfig.js'
import {
  computeFinancialState,
  getMonthStart,
  toIsoDate,
} from '../src/utils/billing.js'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_FILES_BASE = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files'
const APP_SPREADSHEET_NAME = 'ניהול הוצאות'
const APP_CONFIG_NAME = 'expense-tracker-config.json'

// Server-memory cache only: IDs and sheet metadata, never financial values.
// It is keyed by the encrypted-session-derived cache key so sessions never
// share workbook state with each other.
const sessionContexts = new Map()

function getSessionContext(cacheKey) {
  if (!sessionContexts.has(cacheKey)) {
    sessionContexts.set(cacheKey, {
      spreadsheetId: null,
      metadata: null,
      monthContexts: new Map(),
      resolvePromise: null,
    })
  }
  return sessionContexts.get(cacheKey)
}

export function clearExpenseRuntimeCache(cacheKey) {
  if (cacheKey) sessionContexts.delete(cacheKey)
}

function validateMonthKey(monthKey) {
  const value = String(monthKey || '')
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('Invalid month key')
  const month = Number(value.slice(5, 7))
  if (month < 1 || month > 12) throw new Error('Invalid month key')
  return value
}

function a1(title, cells) {
  const escaped = String(title).replaceAll("'", "''")
  return `'${escaped}'!${cells}`
}

function tabsForMonth(monthKey) {
  return {
    transactions: `${SHEET_TABS.TRANSACTIONS} ${monthKey}`,
    summary: `${SHEET_TABS.SUMMARY} ${monthKey}`,
  }
}

function findSheet(metadata, title) {
  return metadata.sheets?.find(item => item.properties?.title === title) ?? null
}

function extractMonthKey(title) {
  const match = String(title ?? '').match(/^(?:תנועות|סיכום) (\d{4}-\d{2})$/)
  return match?.[1] ?? null
}

function getLatestPreviousMonthKey(metadata, currentMonthKey) {
  const keys = new Set()
  for (const sheet of metadata.sheets ?? []) {
    const key = extractMonthKey(sheet.properties?.title)
    if (key && key < currentMonthKey) keys.add(key)
  }
  return [...keys].sort().at(-1) ?? null
}

function rowToTransaction(row, rowIndex) {
  const obj = {}
  TRANSACTION_COLUMNS.forEach((key, i) => {
    obj[key] = row[i] ?? ''
  })
  return { ...obj, amount: Number(obj.amount) || 0, rowIndex }
}

function transactionToRow(transaction) {
  return TRANSACTION_COLUMNS.map(key => String(transaction?.[key] ?? ''))
}

function createGoogleRequest(accessToken) {
  return async function googleRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      const error = new Error(`Google API error: ${text}`)
      error.status = response.status
      throw error
    }

    if (response.status === 204) return null
    return response.json()
  }
}

async function getMetadata(googleRequest, spreadsheetId) {
  return googleRequest(`${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`)
}

async function listAppConfigFiles(googleRequest) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${APP_CONFIG_NAME}' and trashed = false`,
    fields: 'files(id,name,createdTime,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '10',
  })
  const data = await googleRequest(`${DRIVE_FILES_BASE}?${params.toString()}`)
  return data.files ?? []
}

async function readCanonicalSpreadsheetId(googleRequest) {
  const configs = await listAppConfigFiles(googleRequest)
  const configFile = configs[0]
  if (!configFile) return { configFileId: null, spreadsheetId: null }

  try {
    const data = await googleRequest(`${DRIVE_FILES_BASE}/${configFile.id}?alt=media`)
    return {
      configFileId: configFile.id,
      spreadsheetId: typeof data?.spreadsheetId === 'string' ? data.spreadsheetId : null,
    }
  } catch {
    return { configFileId: configFile.id, spreadsheetId: null }
  }
}

async function writeCanonicalSpreadsheetId(googleRequest, spreadsheetId, existingConfigFileId = null) {
  let configFileId = existingConfigFileId

  if (!configFileId) {
    const created = await googleRequest(`${DRIVE_FILES_BASE}?fields=id`, {
      method: 'POST',
      body: JSON.stringify({
        name: APP_CONFIG_NAME,
        parents: ['appDataFolder'],
        mimeType: 'application/json',
      }),
    })
    configFileId = created.id
  }

  await googleRequest(`${DRIVE_UPLOAD_BASE}/${configFileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spreadsheetId }),
  })
}

async function findAppSpreadsheetInDrive(googleRequest) {
  const q = [
    `name = '${APP_SPREADSHEET_NAME.replaceAll("'", "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    'trashed = false',
  ].join(' and ')

  const params = new URLSearchParams({
    q,
    spaces: 'drive',
    fields: 'files(id,name,createdTime,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '20',
  })

  const data = await googleRequest(`${DRIVE_FILES_BASE}?${params.toString()}`)
  return data.files?.[0]?.id ?? null
}

async function writeInitialMonthValues(googleRequest, spreadsheetId, tabs, values = {}) {
  const checking = Number(values.checking) || 0
  const credit = Math.max(Number(values.credit) || 0, 0)
  const trackingStartDate = values.trackingStartDate || toIsoDate()
  const essential = Number(values.essential) || 0
  const discretionary = Number(values.discretionary) || 0
  const previousCharges = Math.max(Number(values.previousCharges) || 0, 0)
  const wallet = Number(values.wallet) || 0

  await googleRequest(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: a1(tabs.transactions, 'A1:H1'), values: [TRANSACTION_HEADERS] },
        {
          range: a1(tabs.summary, 'A1:B8'),
          values: [
            ['פריט', 'ערך'],
            ['יתרת עו"ש התחלתית', checking],
            ['יתרת אשראי התחלתית', credit],
            ['תאריך תחילת מעקב', trackingStartDate],
            ['תקציב הכרחי', essential],
            ['תקציב מותרות', discretionary],
            ['חיובים מחודש קודם', previousCharges],
            ['יתרת ארנק התחלתית', wallet],
          ],
        },
      ],
    }),
  })
}

async function createSpreadsheet(googleRequest, monthKey, existingConfigFileId = null) {
  const tabs = tabsForMonth(monthKey)
  const created = await googleRequest(SHEETS_BASE, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: APP_SPREADSHEET_NAME },
      sheets: [
        { properties: { title: tabs.transactions } },
        { properties: { title: tabs.summary } },
      ],
    }),
  })

  const spreadsheetId = created.spreadsheetId
  await writeCanonicalSpreadsheetId(googleRequest, spreadsheetId, existingConfigFileId)
  await writeInitialMonthValues(googleRequest, spreadsheetId, tabs, {
    trackingStartDate: toIsoDate(getMonthStart(monthKey)),
  })
  const metadata = await getMetadata(googleRequest, spreadsheetId)
  return { spreadsheetId, metadata }
}

async function resolveSpreadsheet(googleRequest, session, monthKey) {
  if (session.spreadsheetId && session.metadata) {
    return { spreadsheetId: session.spreadsheetId, metadata: session.metadata }
  }
  if (session.resolvePromise) return session.resolvePromise

  session.resolvePromise = (async () => {
    const canonical = await readCanonicalSpreadsheetId(googleRequest)

    if (canonical.spreadsheetId) {
      try {
        const metadata = await getMetadata(googleRequest, canonical.spreadsheetId)
        session.spreadsheetId = canonical.spreadsheetId
        session.metadata = metadata
        return { spreadsheetId: session.spreadsheetId, metadata }
      } catch (error) {
        if (![403, 404].includes(error?.status)) throw error
      }
    }

    const discovered = await findAppSpreadsheetInDrive(googleRequest)
    if (discovered) {
      const metadata = await getMetadata(googleRequest, discovered)
      await writeCanonicalSpreadsheetId(googleRequest, discovered, canonical.configFileId)
      session.spreadsheetId = discovered
      session.metadata = metadata
      return { spreadsheetId: discovered, metadata }
    }

    const created = await createSpreadsheet(googleRequest, monthKey, canonical.configFileId)
    session.spreadsheetId = created.spreadsheetId
    session.metadata = created.metadata
    return created
  })().finally(() => {
    session.resolvePromise = null
  })

  return session.resolvePromise
}

async function readMonthDataRaw(googleRequest, spreadsheetId, monthKey) {
  const tabs = tabsForMonth(monthKey)
  const ranges = [
    a1(tabs.transactions, 'A2:H'),
    a1(tabs.summary, 'B2'),
    a1(tabs.summary, 'B3'),
    a1(tabs.summary, 'B4'),
    a1(tabs.summary, 'B5'),
    a1(tabs.summary, 'B6'),
    a1(tabs.summary, 'B7'),
    a1(tabs.summary, 'B8'),
  ]
  const query = ranges.map(range => `ranges=${encodeURIComponent(range)}`).join('&')
  const data = await googleRequest(`${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${query}`)
  const transactionRows = data.valueRanges?.[0]?.values ?? []
  const summaryValues = Array.from({ length: 7 }, (_, index) =>
    data.valueRanges?.[index + 1]?.values?.[0]?.[0] ?? ''
  )
  const [checking, credit, trackingStartDate, essential, discretionary, previousCharges, wallet] = summaryValues

  return {
    transactions: transactionRows.map((row, index) => rowToTransaction(row, index + 2)),
    summary: { checking, credit, trackingStartDate, essential, discretionary, previousCharges, wallet },
  }
}

async function migrateLegacyTabs(googleRequest, spreadsheetId, metadata, monthKey) {
  const tabs = tabsForMonth(monthKey)
  if (findSheet(metadata, tabs.transactions) || findSheet(metadata, tabs.summary)) return metadata

  const legacyTransactions = findSheet(metadata, SHEET_TABS.TRANSACTIONS)
  const legacySummary = findSheet(metadata, SHEET_TABS.SUMMARY)
  if (!legacyTransactions || !legacySummary) return metadata

  await googleRequest(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: legacyTransactions.properties.sheetId, title: tabs.transactions },
            fields: 'title',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: legacySummary.properties.sheetId, title: tabs.summary },
            fields: 'title',
          },
        },
      ],
    }),
  })

  return getMetadata(googleRequest, spreadsheetId)
}

async function getCarryForward(googleRequest, spreadsheetId, metadata, currentMonthKey) {
  const previousMonthKey = getLatestPreviousMonthKey(metadata, currentMonthKey)
  const emptyCarry = {
    checking: 0,
    credit: 0,
    essential: 0,
    discretionary: 0,
    previousCharges: 0,
    wallet: 0,
  }
  if (!previousMonthKey) return emptyCarry

  const previousTabs = tabsForMonth(previousMonthKey)
  if (!findSheet(metadata, previousTabs.transactions) || !findSheet(metadata, previousTabs.summary)) {
    return emptyCarry
  }

  const { summary, transactions } = await readMonthDataRaw(googleRequest, spreadsheetId, previousMonthKey)
  const state = computeFinancialState(summary, transactions, getMonthStart(currentMonthKey))

  return {
    checking: state.checking,
    wallet: state.wallet,
    credit: 0,
    previousCharges: state.credit,
    essential: Number(summary.essential) || 0,
    discretionary: Number(summary.discretionary) || 0,
  }
}

async function ensureTransactionHeaders(googleRequest, spreadsheetId, tabs) {
  await googleRequest(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: a1(tabs.transactions, 'A1:H1'), values: [TRANSACTION_HEADERS] },
      ],
    }),
  })
}

async function createMonthTabs(googleRequest, spreadsheetId, metadata, monthKey) {
  const tabs = tabsForMonth(monthKey)
  const missingTransactions = !findSheet(metadata, tabs.transactions)
  const missingSummary = !findSheet(metadata, tabs.summary)
  if (!missingTransactions && !missingSummary) return metadata

  const carry = await getCarryForward(googleRequest, spreadsheetId, metadata, monthKey)
  const requests = []
  if (missingTransactions) requests.push({ addSheet: { properties: { title: tabs.transactions } } })
  if (missingSummary) requests.push({ addSheet: { properties: { title: tabs.summary } } })

  await googleRequest(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  })

  const data = []
  if (missingTransactions) {
    data.push({ range: a1(tabs.transactions, 'A1:H1'), values: [TRANSACTION_HEADERS] })
  }
  if (missingSummary) {
    data.push({
      range: a1(tabs.summary, 'A1:B8'),
      values: [
        ['פריט', 'ערך'],
        ['יתרת עו"ש התחלתית', carry.checking],
        ['יתרת אשראי התחלתית', carry.credit],
        ['תאריך תחילת מעקב', toIsoDate(getMonthStart(monthKey))],
        ['תקציב הכרחי', carry.essential],
        ['תקציב מותרות', carry.discretionary],
        ['חיובים מחודש קודם', carry.previousCharges],
        ['יתרת ארנק התחלתית', carry.wallet],
      ],
    })
  }

  if (data.length) {
    await googleRequest(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    })
  }

  return getMetadata(googleRequest, spreadsheetId)
}

async function ensureCurrentMonth(accessToken, cacheKey, rawMonthKey) {
  const monthKey = validateMonthKey(rawMonthKey)
  const googleRequest = createGoogleRequest(accessToken)
  const session = getSessionContext(cacheKey)

  const existingMonth = session.monthContexts.get(monthKey)
  if (existingMonth) return { googleRequest, ...existingMonth }

  try {
    const resolved = await resolveSpreadsheet(googleRequest, session, monthKey)
    let metadata = resolved.metadata
    metadata = await migrateLegacyTabs(googleRequest, resolved.spreadsheetId, metadata, monthKey)
    metadata = await createMonthTabs(googleRequest, resolved.spreadsheetId, metadata, monthKey)
    await ensureTransactionHeaders(googleRequest, resolved.spreadsheetId, tabsForMonth(monthKey))
    session.metadata = metadata

    const context = {
      spreadsheetId: resolved.spreadsheetId,
      monthKey,
      tabs: tabsForMonth(monthKey),
      metadata,
    }
    session.monthContexts.set(monthKey, context)
    return { googleRequest, ...context }
  } catch (error) {
    if (![403, 404].includes(error?.status)) throw error

    clearExpenseRuntimeCache(cacheKey)
    const freshSession = getSessionContext(cacheKey)
    const resolved = await resolveSpreadsheet(googleRequest, freshSession, monthKey)
    let metadata = await migrateLegacyTabs(googleRequest, resolved.spreadsheetId, resolved.metadata, monthKey)
    metadata = await createMonthTabs(googleRequest, resolved.spreadsheetId, metadata, monthKey)
    await ensureTransactionHeaders(googleRequest, resolved.spreadsheetId, tabsForMonth(monthKey))
    freshSession.metadata = metadata
    const context = {
      spreadsheetId: resolved.spreadsheetId,
      monthKey,
      tabs: tabsForMonth(monthKey),
      metadata,
    }
    freshSession.monthContexts.set(monthKey, context)
    return { googleRequest, ...context }
  }
}

async function normalizeCurrentSummary(googleRequest, spreadsheetId, monthKey, tabs, summary) {
  let trackingStartDate = summary.trackingStartDate
  let previousCharges = summary.previousCharges
  let wallet = summary.wallet
  const updates = []

  if (!trackingStartDate) {
    trackingStartDate = toIsoDate(getMonthStart(monthKey))
    updates.push({ range: a1(tabs.summary, 'A4:B4'), values: [['תאריך תחילת מעקב', trackingStartDate]] })
  }
  if (previousCharges === '') {
    previousCharges = 0
    updates.push({ range: a1(tabs.summary, 'A7:B7'), values: [['חיובים מחודש קודם', 0]] })
  }
  if (wallet === '') {
    wallet = 0
    updates.push({ range: a1(tabs.summary, 'A8:B8'), values: [['יתרת ארנק התחלתית', 0]] })
  }

  if (updates.length) {
    await googleRequest(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates }),
    })
  }

  return {
    ...summary,
    trackingStartDate,
    previousCharges,
    wallet,
  }
}

export async function loadCurrentMonth(accessToken, cacheKey, monthKey) {
  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey)
  const raw = await readMonthDataRaw(context.googleRequest, context.spreadsheetId, context.monthKey)
  const summary = await normalizeCurrentSummary(
    context.googleRequest,
    context.spreadsheetId,
    context.monthKey,
    context.tabs,
    raw.summary
  )
  return { summary, transactions: raw.transactions }
}

export async function appendTransaction(accessToken, cacheKey, monthKey, transaction) {
  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey)
  const range = a1(context.tabs.transactions, 'A2:H')
  return context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [transactionToRow(transaction)] }),
    }
  )
}

export async function updateTransaction(accessToken, cacheKey, monthKey, transaction) {
  const row = Number(transaction?.rowIndex)
  if (!Number.isInteger(row) || row < 2) throw new Error('Invalid transaction row')

  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey)
  const range = a1(context.tabs.transactions, `A${row}:H${row}`)
  return context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [transactionToRow(transaction)] }),
    }
  )
}

export async function deleteTransaction(accessToken, cacheKey, monthKey, rowIndex) {
  const row = Number(rowIndex)
  if (!Number.isInteger(row) || row < 2) throw new Error('Invalid transaction row')

  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey)
  const sheet = findSheet(context.metadata, context.tabs.transactions)
  if (!sheet) throw new Error(`Sheet tab not found: ${context.tabs.transactions}`)

  return context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: row - 1,
              endIndex: row,
            },
          },
        },
      ],
    }),
  })
}

export async function updateSummaryCells(accessToken, cacheKey, monthKey, updates) {
  const cleanUpdates = (updates ?? []).filter(
    item => Array.isArray(item) && item.length >= 2 && /^[A-Z]+\d+$/.test(String(item[0]))
  )
  if (!cleanUpdates.length) return null

  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey)
  return context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: cleanUpdates.map(([cell, value]) => ({
        range: a1(context.tabs.summary, cell),
        values: [[value]],
      })),
    }),
  })
}

export async function ensureMonthOnly(accessToken, cacheKey, monthKey) {
  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey)
  return { spreadsheetId: context.spreadsheetId, monthKey: context.monthKey }
}


export async function listAvailableMonths(accessToken, cacheKey, currentMonthKey) {
  const current = validateMonthKey(currentMonthKey)
  const context = await ensureCurrentMonth(accessToken, cacheKey, current)
  const keys = new Set()

  for (const sheet of context.metadata.sheets ?? []) {
    const key = extractMonthKey(sheet.properties?.title)
    if (key) keys.add(key)
  }

  keys.add(current)
  return [...keys].sort()
}
