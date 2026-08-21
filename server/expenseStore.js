import {
  SHEET_TABS,
  TRANSACTION_COLUMNS,
  TRANSACTION_HEADERS,
  CATEGORIES,
  DEFAULT_BUDGETS,
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
const CUSTOM_CATEGORIES_SHEET = '_קטגוריות'
const CUSTOM_CATEGORY_HEADER = 'קטגוריה'
const CATEGORY_SCHEMA_MARKER = 'all_categories_v2'
const BUDGETS_SHEET = '_תקציבים'
const BUDGET_INIT_MARKER = '__INIT__'
const SAVINGS_SHEET = '_חסכונות'
const SAVINGS_HEADERS = ['מזהה', 'שם', 'סוג', 'יתרה', 'הפקדה חודשית', 'תשואה שנתית משוערת', 'דמי ניהול', 'עודכן', 'מקושר לשכר']

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
      monthPromises: new Map(),
      resolvePromise: null,
    })
  }
  return sessionContexts.get(cacheKey)
}

export function clearExpenseRuntimeCache(cacheKey) {
  if (cacheKey) sessionContexts.delete(cacheKey)
}

export function getExpenseSpreadsheetId(cacheKey) {
  return cacheKey ? sessionContexts.get(cacheKey)?.spreadsheetId ?? null : null
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

function normalizeCustomCategory(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

function syncMetadataToSession(cacheKey, metadata) {
  const session = getSessionContext(cacheKey)
  session.metadata = metadata
  for (const [monthKey, context] of session.monthContexts.entries()) {
    session.monthContexts.set(monthKey, { ...context, metadata })
  }
}

function monthKeysFromMetadata(metadata, currentMonthKey = null) {
  const keys = new Set()
  for (const sheet of metadata?.sheets ?? []) {
    const key = extractMonthKey(sheet.properties?.title)
    if (key) keys.add(key)
  }
  if (currentMonthKey) keys.add(currentMonthKey)
  return [...keys].sort()
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
    // Fast path for serverless cold starts: the encrypted session cookie can
    // carry the workbook ID from a previous request. Validate it with one
    // Sheets metadata call instead of doing two Drive appData lookups first.
    if (session.spreadsheetId) {
      try {
        const metadata = await getMetadata(googleRequest, session.spreadsheetId)
        session.metadata = metadata
        return { spreadsheetId: session.spreadsheetId, metadata }
      } catch (error) {
        if (![403, 404].includes(error?.status)) throw error
        session.spreadsheetId = null
        session.metadata = null
      }
    }

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
    a1(tabs.summary, 'B2:B8'),
  ]
  const query = ranges.map(range => `ranges=${encodeURIComponent(range)}`).join('&')
  const data = await googleRequest(`${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${query}`)
  const transactionRows = data.valueRanges?.[0]?.values ?? []
  const summaryRows = data.valueRanges?.[1]?.values ?? []
  const summaryValues = Array.from({ length: 7 }, (_, index) => summaryRows[index]?.[0] ?? '')
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

async function ensureCurrentMonth(accessToken, cacheKey, rawMonthKey, spreadsheetHint = null) {
  const monthKey = validateMonthKey(rawMonthKey)
  const googleRequest = createGoogleRequest(accessToken)
  const session = getSessionContext(cacheKey)

  if (spreadsheetHint && !session.spreadsheetId) {
    session.spreadsheetId = spreadsheetHint
  }

  const existingMonth = session.monthContexts.get(monthKey)
  if (existingMonth) return { googleRequest, ...existingMonth }

  if (!session.monthPromises.has(monthKey)) {
    const promise = (async () => {
      try {
        const resolved = await resolveSpreadsheet(googleRequest, session, monthKey)
        let metadata = resolved.metadata
        metadata = await migrateLegacyTabs(googleRequest, resolved.spreadsheetId, metadata, monthKey)
        metadata = await createMonthTabs(googleRequest, resolved.spreadsheetId, metadata, monthKey)
        session.metadata = metadata

        const context = {
          spreadsheetId: resolved.spreadsheetId,
          monthKey,
          tabs: tabsForMonth(monthKey),
          metadata,
        }
        session.monthContexts.set(monthKey, context)
        return context
      } catch (error) {
        if (![403, 404].includes(error?.status)) throw error

        clearExpenseRuntimeCache(cacheKey)
        const freshSession = getSessionContext(cacheKey)
        const resolved = await resolveSpreadsheet(googleRequest, freshSession, monthKey)
        let metadata = await migrateLegacyTabs(googleRequest, resolved.spreadsheetId, resolved.metadata, monthKey)
        metadata = await createMonthTabs(googleRequest, resolved.spreadsheetId, metadata, monthKey)
        freshSession.metadata = metadata
        const context = {
          spreadsheetId: resolved.spreadsheetId,
          monthKey,
          tabs: tabsForMonth(monthKey),
          metadata,
        }
        freshSession.monthContexts.set(monthKey, context)
        return context
      }
    })().finally(() => {
      session.monthPromises.delete(monthKey)
    })

    session.monthPromises.set(monthKey, promise)
  }

  const context = await session.monthPromises.get(monthKey)
  return { googleRequest, ...context }
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

export async function loadCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint = null) {
  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  const raw = await readMonthDataRaw(context.googleRequest, context.spreadsheetId, context.monthKey)
  const summary = await normalizeCurrentSummary(
    context.googleRequest,
    context.spreadsheetId,
    context.monthKey,
    context.tabs,
    raw.summary
  )
  return {
    summary,
    transactions: raw.transactions,
    availableMonths: monthKeysFromMetadata(context.metadata, context.monthKey),
  }
}

export async function appendTransaction(accessToken, cacheKey, monthKey, transaction, spreadsheetHint = null) {
  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  const range = a1(context.tabs.transactions, 'A2:H')
  return context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [transactionToRow(transaction)] }),
    }
  )
}

export async function updateTransaction(accessToken, cacheKey, monthKey, transaction, spreadsheetHint = null) {
  const row = Number(transaction?.rowIndex)
  if (!Number.isInteger(row) || row < 2) throw new Error('Invalid transaction row')

  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  const range = a1(context.tabs.transactions, `A${row}:H${row}`)
  return context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [transactionToRow(transaction)] }),
    }
  )
}

export async function deleteTransaction(accessToken, cacheKey, monthKey, rowIndex, spreadsheetHint = null) {
  const row = Number(rowIndex)
  if (!Number.isInteger(row) || row < 2) throw new Error('Invalid transaction row')

  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
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

export async function updateSummaryCells(accessToken, cacheKey, monthKey, updates, spreadsheetHint = null) {
  const cleanUpdates = (updates ?? []).filter(
    item => Array.isArray(item) && item.length >= 2 && /^[A-Z]+\d+$/.test(String(item[0]))
  )
  if (!cleanUpdates.length) return null

  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
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

async function ensureCustomCategoriesSheet(accessToken, cacheKey, monthKey, spreadsheetHint = null) {
  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  let metadata = context.metadata
  let sheet = findSheet(metadata, CUSTOM_CATEGORIES_SHEET)
  let created = false

  if (!sheet) {
    created = true
    await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          { addSheet: { properties: { title: CUSTOM_CATEGORIES_SHEET, hidden: true } } },
        ],
      }),
    })

    metadata = await getMetadata(context.googleRequest, context.spreadsheetId)
    syncMetadataToSession(cacheKey, metadata)
    sheet = findSheet(metadata, CUSTOM_CATEGORIES_SHEET)
  }

  const headerRange = a1(CUSTOM_CATEGORIES_SHEET, 'A1:B1')
  const headerData = created
    ? { values: [] }
    : await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(headerRange)}`)
  const marker = headerData.values?.[0]?.[1] ?? ''

  if (created || marker !== CATEGORY_SCHEMA_MARKER) {
    const rows = created ? [] : await readCustomCategoryRows({ ...context, metadata, sheet })
    const seen = new Set()
    const migrated = []

    for (const name of [...CATEGORIES, ...rows.map(item => item.name)]) {
      const clean = normalizeCustomCategory(name)
      const key = clean.toLocaleLowerCase('he')
      if (!clean || seen.has(key)) continue
      seen.add(key)
      migrated.push(clean)
    }

    const clearRange = a1(CUSTOM_CATEGORIES_SHEET, 'A1:B')
    await context.googleRequest(
      `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`,
      { method: 'POST', body: JSON.stringify({}) }
    )

    await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [{
          range: a1(CUSTOM_CATEGORIES_SHEET, `A1:B${Math.max(1, migrated.length + 1)}`),
          values: [
            [CUSTOM_CATEGORY_HEADER, CATEGORY_SCHEMA_MARKER],
            ...migrated.map(name => [name, '']),
          ],
        }],
      }),
    })
  }

  return { ...context, metadata, sheet }
}

async function readCustomCategoryRows(context) {
  const range = a1(CUSTOM_CATEGORIES_SHEET, 'A2:A')
  const data = await context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}`
  )

  return (data.values ?? [])
    .map((row, index) => ({ name: normalizeCustomCategory(row?.[0]), rowIndex: index + 2 }))
    .filter(item => item.name)
}

export async function listCustomCategories(accessToken, cacheKey, monthKey, spreadsheetHint = null) {
  const context = await ensureCustomCategoriesSheet(accessToken, cacheKey, monthKey, spreadsheetHint)
  const rows = await readCustomCategoryRows(context)
  const seen = new Set()
  const result = []

  for (const item of rows) {
    const key = item.name.toLocaleLowerCase('he')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item.name)
  }

  return result
}

export async function addCustomCategory(accessToken, cacheKey, monthKey, rawCategory, spreadsheetHint = null) {
  const category = normalizeCustomCategory(rawCategory)
  if (!category) {
    const error = new Error('Category name is required')
    error.status = 400
    throw error
  }

  const lower = category.toLocaleLowerCase('he')
  const context = await ensureCustomCategoriesSheet(accessToken, cacheKey, monthKey, spreadsheetHint)
  const existing = await readCustomCategoryRows(context)
  if (existing.some(item => item.name.toLocaleLowerCase('he') === lower)) {
    return listCustomCategories(accessToken, cacheKey, monthKey, spreadsheetHint)
  }

  const range = a1(CUSTOM_CATEGORIES_SHEET, 'A2:A')
  await context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [[category]] }),
    }
  )

  return listCustomCategories(accessToken, cacheKey, monthKey, spreadsheetHint)
}

export async function deleteCustomCategory(accessToken, cacheKey, monthKey, rawCategory, spreadsheetHint = null) {
  const category = normalizeCustomCategory(rawCategory)
  if (!category) return listCustomCategories(accessToken, cacheKey, monthKey, spreadsheetHint)

  const context = await ensureCustomCategoriesSheet(accessToken, cacheKey, monthKey, spreadsheetHint)
  const rows = await readCustomCategoryRows(context)
  const targets = rows.filter(item => item.name.toLocaleLowerCase('he') === category.toLocaleLowerCase('he'))
  if (!targets.length) return listCustomCategories(accessToken, cacheKey, monthKey, spreadsheetHint)
  if (!context.sheet) throw new Error('Categories sheet not found')

  await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [...targets]
        .sort((a, b) => b.rowIndex - a.rowIndex)
        .map(target => ({
          deleteDimension: {
            range: {
              sheetId: context.sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: target.rowIndex - 1,
              endIndex: target.rowIndex,
            },
          },
        })),
    }),
  })

  return listCustomCategories(accessToken, cacheKey, monthKey, spreadsheetHint)
}

function normalizeBudgetName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
}

async function ensureBudgetsSheet(accessToken, cacheKey, monthKey, spreadsheetHint = null) {
  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  let metadata = context.metadata
  let sheet = findSheet(metadata, BUDGETS_SHEET)

  if (!sheet) {
    await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: BUDGETS_SHEET, hidden: true } } }],
      }),
    })
    await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [{ range: a1(BUDGETS_SHEET, 'A1:C1'), values: [['חודש', 'תקציב', 'סכום']] }],
      }),
    })
    metadata = await getMetadata(context.googleRequest, context.spreadsheetId)
    syncMetadataToSession(cacheKey, metadata)
    sheet = findSheet(metadata, BUDGETS_SHEET)
  }

  return { ...context, metadata, sheet }
}

async function readBudgetRows(context) {
  const range = a1(BUDGETS_SHEET, 'A2:C')
  const data = await context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}`
  )
  return (data.values ?? []).map((row, index) => ({
    monthKey: String(row?.[0] ?? ''),
    name: normalizeBudgetName(row?.[1]),
    amount: Number(row?.[2]) || 0,
    rowIndex: index + 2,
  })).filter(item => item.monthKey && item.name)
}

async function ensureBudgetRowsForMonth(accessToken, cacheKey, monthKey, spreadsheetHint = null) {
  const context = await ensureBudgetsSheet(accessToken, cacheKey, monthKey, spreadsheetHint)
  const rows = await readBudgetRows(context)
  if (rows.some(item => item.monthKey === monthKey && item.name === BUDGET_INIT_MARKER)) {
    return { context, rows }
  }

  const initializedMonths = [...new Set(
    rows.filter(item => item.name === BUDGET_INIT_MARKER).map(item => item.monthKey)
  )].sort()
  const maxInitialized = initializedMonths.at(-1) ?? null
  let seed = []

  if (maxInitialized && monthKey > maxInitialized) {
    seed = rows
      .filter(item => item.monthKey === maxInitialized && item.name !== BUDGET_INIT_MARKER)
      .map(item => ({ name: item.name, amount: item.amount }))
  } else {
    const raw = await readMonthDataRaw(context.googleRequest, context.spreadsheetId, monthKey)
    const legacyAmounts = {
      הכרחי: Number(raw.summary?.essential) || 0,
      מותרות: Number(raw.summary?.discretionary) || 0,
    }
    seed = DEFAULT_BUDGETS.map(name => ({ name, amount: legacyAmounts[name] || 0 }))
  }

  const appendRange = a1(BUDGETS_SHEET, 'A2:C')
  await context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [
          [monthKey, BUDGET_INIT_MARKER, ''],
          ...seed.map(item => [monthKey, item.name, item.amount]),
        ],
      }),
    }
  )

  return { context, rows: await readBudgetRows(context) }
}

export async function listBudgets(accessToken, cacheKey, monthKey, spreadsheetHint = null) {
  const { rows } = await ensureBudgetRowsForMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  const seen = new Set()
  const result = []
  for (const item of rows) {
    if (item.monthKey !== monthKey || item.name === BUDGET_INIT_MARKER) continue
    const key = item.name.toLocaleLowerCase('he')
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ name: item.name, amount: item.amount })
  }
  return result
}

export async function addBudget(accessToken, cacheKey, monthKey, rawBudget, spreadsheetHint = null) {
  const name = normalizeBudgetName(rawBudget)
  if (!name) {
    const error = new Error('Budget name is required')
    error.status = 400
    throw error
  }

  const { context, rows } = await ensureBudgetRowsForMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  const lower = name.toLocaleLowerCase('he')
  if (rows.some(item => item.monthKey === monthKey && item.name !== BUDGET_INIT_MARKER && item.name.toLocaleLowerCase('he') === lower)) {
    return listBudgets(accessToken, cacheKey, monthKey, spreadsheetHint)
  }

  const range = a1(BUDGETS_SHEET, 'A2:C')
  await context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    { method: 'POST', body: JSON.stringify({ values: [[monthKey, name, 0]] }) }
  )
  return listBudgets(accessToken, cacheKey, monthKey, spreadsheetHint)
}

export async function deleteBudget(accessToken, cacheKey, monthKey, rawBudget, spreadsheetHint = null) {
  const name = normalizeBudgetName(rawBudget)
  if (!name) return listBudgets(accessToken, cacheKey, monthKey, spreadsheetHint)

  const { context, rows } = await ensureBudgetRowsForMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  const targets = rows.filter(item =>
    item.monthKey === monthKey &&
    item.name !== BUDGET_INIT_MARKER &&
    item.name.toLocaleLowerCase('he') === name.toLocaleLowerCase('he')
  )
  if (!targets.length) return listBudgets(accessToken, cacheKey, monthKey, spreadsheetHint)
  if (!context.sheet) throw new Error('Budgets sheet not found')

  await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [...targets]
        .sort((a, b) => b.rowIndex - a.rowIndex)
        .map(target => ({
          deleteDimension: {
            range: {
              sheetId: context.sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: target.rowIndex - 1,
              endIndex: target.rowIndex,
            },
          },
        })),
    }),
  })
  return listBudgets(accessToken, cacheKey, monthKey, spreadsheetHint)
}

export async function updateBudgetAmount(accessToken, cacheKey, monthKey, rawBudget, rawAmount, spreadsheetHint = null) {
  const name = normalizeBudgetName(rawBudget)
  const amount = Math.max(Number(rawAmount) || 0, 0)
  const { context, rows } = await ensureBudgetRowsForMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  const target = rows.find(item =>
    item.monthKey === monthKey &&
    item.name !== BUDGET_INIT_MARKER &&
    item.name.toLocaleLowerCase('he') === name.toLocaleLowerCase('he')
  )
  if (!target) {
    const error = new Error('Budget not found')
    error.status = 404
    throw error
  }

  const range = a1(BUDGETS_SHEET, `C${target.rowIndex}`)
  await context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values: [[amount]] }) }
  )
  return listBudgets(accessToken, cacheKey, monthKey, spreadsheetHint)
}

function normalizeSavingText(value, maxLength = 60) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

async function ensureSavingsSheet(accessToken, cacheKey, monthKey, spreadsheetHint = null) {
  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  let metadata = context.metadata
  let sheet = findSheet(metadata, SAVINGS_SHEET)

  if (!sheet) {
    await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: SAVINGS_SHEET, hidden: true } } }],
      }),
    })
    await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [{ range: a1(SAVINGS_SHEET, 'A1:I1'), values: [SAVINGS_HEADERS] }],
      }),
    })
    metadata = await getMetadata(context.googleRequest, context.spreadsheetId)
    syncMetadataToSession(cacheKey, metadata)
    sheet = findSheet(metadata, SAVINGS_SHEET)
  } else {
    const headerRange = a1(SAVINGS_SHEET, 'A1:I1')
    const headerData = await context.googleRequest(
      `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(headerRange)}`
    )
    const currentHeader = headerData.values?.[0] || []
    if (currentHeader[8] !== SAVINGS_HEADERS[8]) {
      await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(headerRange)}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [SAVINGS_HEADERS] }),
      })
    }
  }

  return { ...context, metadata, sheet }
}

async function readSavingRows(context) {
  const range = a1(SAVINGS_SHEET, 'A2:I')
  const data = await context.googleRequest(
    `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}`
  )
  return (data.values ?? []).map((row, index) => ({
    id: normalizeSavingText(row?.[0], 80),
    name: normalizeSavingText(row?.[1]),
    type: normalizeSavingText(row?.[2], 40),
    balance: Number(row?.[3]) || 0,
    monthlyDeposit: Number(row?.[4]) || 0,
    annualReturn: Number(row?.[5]) || 0,
    managementFee: Number(row?.[6]) || 0,
    updatedAt: String(row?.[7] ?? ''),
    salaryLinked: ['true', '1', 'כן'].includes(String(row?.[8] ?? '').toLowerCase()),
    rowIndex: index + 2,
  })).filter(item => item.id && item.name)
}

export async function listSavings(accessToken, cacheKey, monthKey, spreadsheetHint = null) {
  const context = await ensureSavingsSheet(accessToken, cacheKey, monthKey, spreadsheetHint)
  const rows = await readSavingRows(context)
  return rows.map(({ rowIndex, ...item }) => item)
}

export async function upsertSaving(accessToken, cacheKey, monthKey, rawSaving, spreadsheetHint = null) {
  const id = normalizeSavingText(rawSaving?.id, 80)
  const name = normalizeSavingText(rawSaving?.name)
  if (!id || !name) {
    const error = new Error('Saving id and name are required')
    error.status = 400
    throw error
  }

  const saving = {
    id,
    name,
    type: normalizeSavingText(rawSaving?.type, 40) || 'אחר',
    balance: Math.max(Number(rawSaving?.balance) || 0, 0),
    monthlyDeposit: Math.max(Number(rawSaving?.monthlyDeposit) || 0, 0),
    annualReturn: Math.max(-99.9, Math.min(Number(rawSaving?.annualReturn) || 0, 1000)),
    managementFee: Math.max(Number(rawSaving?.managementFee) || 0, 0),
    salaryLinked: Boolean(rawSaving?.salaryLinked),
    updatedAt: new Date().toISOString(),
  }

  const context = await ensureSavingsSheet(accessToken, cacheKey, monthKey, spreadsheetHint)
  const rows = await readSavingRows(context)

  // Only one training fund can receive the salary-linked contribution at a time.
  // When a different training fund is activated, automatically deactivate any
  // previously active one so the same salary contribution is never counted twice.
  if (saving.type === 'קרן השתלמות' && saving.salaryLinked) {
    const otherLinkedTrainingFunds = rows.filter(item =>
      item.id !== saving.id &&
      item.type === 'קרן השתלמות' &&
      item.salaryLinked
    )

    if (otherLinkedTrainingFunds.length) {
      await context.googleRequest(
        `${SHEETS_BASE}/${context.spreadsheetId}/values:batchUpdate`,
        {
          method: 'POST',
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: otherLinkedTrainingFunds.map(item => ({
              range: a1(SAVINGS_SHEET, `I${item.rowIndex}`),
              values: [['false']],
            })),
          }),
        }
      )
    }
  }

  const existing = rows.find(item => item.id === id)
  const values = [[
    saving.id,
    saving.name,
    saving.type,
    saving.balance,
    saving.monthlyDeposit,
    saving.annualReturn,
    saving.managementFee,
    saving.updatedAt,
    saving.salaryLinked ? 'true' : 'false',
  ]]

  if (existing) {
    const range = a1(SAVINGS_SHEET, `A${existing.rowIndex}:I${existing.rowIndex}`)
    await context.googleRequest(
      `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      { method: 'PUT', body: JSON.stringify({ values }) }
    )
  } else {
    const range = a1(SAVINGS_SHEET, 'A2:I')
    await context.googleRequest(
      `${SHEETS_BASE}/${context.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      { method: 'POST', body: JSON.stringify({ values }) }
    )
  }

  return listSavings(accessToken, cacheKey, monthKey, spreadsheetHint)
}

export async function deleteSaving(accessToken, cacheKey, monthKey, rawId, spreadsheetHint = null) {
  const id = normalizeSavingText(rawId, 80)
  const context = await ensureSavingsSheet(accessToken, cacheKey, monthKey, spreadsheetHint)
  const rows = await readSavingRows(context)
  const target = rows.find(item => item.id === id)
  if (!target) return rows.map(({ rowIndex, ...item }) => item)
  if (!context.sheet) throw new Error('Savings sheet not found')

  await context.googleRequest(`${SHEETS_BASE}/${context.spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId: context.sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: target.rowIndex - 1,
            endIndex: target.rowIndex,
          },
        },
      }],
    }),
  })
  return listSavings(accessToken, cacheKey, monthKey, spreadsheetHint)
}

export async function ensureMonthOnly(accessToken, cacheKey, monthKey, spreadsheetHint = null) {
  const context = await ensureCurrentMonth(accessToken, cacheKey, monthKey, spreadsheetHint)
  return { spreadsheetId: context.spreadsheetId, monthKey: context.monthKey }
}


export async function listAvailableMonths(accessToken, cacheKey, currentMonthKey, spreadsheetHint = null) {
  const current = validateMonthKey(currentMonthKey)
  const context = await ensureCurrentMonth(accessToken, cacheKey, current, spreadsheetHint)
  return monthKeysFromMetadata(context.metadata, current)
}
