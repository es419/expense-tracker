import { getToken, invalidateAccessToken } from './googleAuth'
import {
  SHEET_TABS,
  TRANSACTION_COLUMNS,
  TRANSACTION_HEADERS,
} from '../config/sheetsConfig'
import {
  computeFinancialState,
  getMonthKey,
  getMonthStart,
  toIsoDate,
} from '../utils/billing'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_FILES_BASE = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files'
const SPREADSHEET_ID_KEY = 'expense_tracker_spreadsheet_id'
const APP_SPREADSHEET_NAME = 'ניהול הוצאות'
const APP_CONFIG_NAME = 'expense-tracker-config.json'
let creationPromise = null
let resolvedSpreadsheetId = null
let resolvedSpreadsheetPromise = null
const monthPromises = new Map()
const monthContexts = new Map()

// View-performance cache only. Google Sheets remains the source of truth.
// These values live only while the current app page is loaded, similar to the
// attendance app keeping its fetched data in React state between views.
let cachedTransactions = null
let cachedSummary = null
let transactionsFetchPromise = null
let summaryFetchPromise = null

async function googleRequest(url, options = {}) {
  async function requestWithToken(token) {
    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  let token = await getToken()
  if (!token) throw new Error('Not signed in')

  let res = await requestWithToken(token)

  // If Google says the short-lived access token is no longer valid, refresh it
  // once through our Vercel backend and retry the Sheets request.
  if (res.status === 401) {
    invalidateAccessToken()
    token = await getToken({ forceRefresh: true })
    if (!token) throw new Error('Not signed in')
    res = await requestWithToken(token)
  }

  if (!res.ok) {
    const err = await res.text()
    const error = new Error(`Google API error: ${err}`)
    error.status = res.status
    throw error
  }

  if (res.status === 204) return null
  return res.json()
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

async function getMetadata(spreadsheetId) {
  return googleRequest(`${BASE}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`)
}

async function writeInitialMonthValues(spreadsheetId, tabs, values = {}) {
  const checking = Number(values.checking) || 0
  const credit = Math.max(Number(values.credit) || 0, 0)
  const trackingStartDate = values.trackingStartDate || toIsoDate()
  const essential = Number(values.essential) || 0
  const discretionary = Number(values.discretionary) || 0
  const previousCharges = Math.max(Number(values.previousCharges) || 0, 0)
  const wallet = Number(values.wallet) || 0

  await googleRequest(`${BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: a1(tabs.transactions, 'A1:G1'),
          values: [TRANSACTION_HEADERS],
        },
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


async function listAppConfigFiles() {
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

async function readCanonicalSpreadsheetId() {
  const configs = await listAppConfigFiles()
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

async function writeCanonicalSpreadsheetId(spreadsheetId, existingConfigFileId = null) {
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

  await googleRequest(
    `${DRIVE_UPLOAD_BASE}/${configFileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId }),
    }
  )

  // Local storage is now only a cache for debugging/speed; Drive appData is canonical.
  localStorage.setItem(SPREADSHEET_ID_KEY, spreadsheetId)
}

async function findAppSpreadsheetInDrive() {
  const q = [
    `name = '${APP_SPREADSHEET_NAME.replaceAll("'", "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    "trashed = false",
  ].join(' and ')

  const params = new URLSearchParams({
    q,
    spaces: 'drive',
    fields: 'files(id,name,createdTime,modifiedTime)',
    // If old duplicates still exist, prefer the one most recently used/modified.
    orderBy: 'modifiedTime desc',
    pageSize: '20',
  })

  const data = await googleRequest(`${DRIVE_FILES_BASE}?${params.toString()}`)
  return data.files?.[0]?.id ?? null
}

async function spreadsheetExists(spreadsheetId) {
  if (!spreadsheetId) return false
  try {
    await getMetadata(spreadsheetId)
    return true
  } catch (error) {
    if ([403, 404].includes(error?.status)) return false
    throw error
  }
}

async function resolveSpreadsheet() {
  // Cross-device source of truth: a tiny private config file in Google Drive's
  // appDataFolder. Every browser/device signed into the same Google account
  // reads the same spreadsheet ID from here.
  const canonical = await readCanonicalSpreadsheetId()

  if (await spreadsheetExists(canonical.spreadsheetId)) {
    localStorage.setItem(SPREADSHEET_ID_KEY, canonical.spreadsheetId)
    return canonical.spreadsheetId
  }

  // Migration path for the first run of this version: if a workbook already
  // exists, adopt it and immediately make it canonical for every device.
  const discovered = await findAppSpreadsheetInDrive()
  if (discovered) {
    await writeCanonicalSpreadsheetId(discovered, canonical.configFileId)
    return discovered
  }

  return { configFileId: canonical.configFileId, spreadsheetId: null }
}

async function createSpreadsheet(existingConfigFileId = null) {
  const monthKey = getMonthKey()
  const tabs = tabsForMonth(monthKey)

  const created = await googleRequest(BASE, {
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

  try {
    await writeCanonicalSpreadsheetId(spreadsheetId, existingConfigFileId)
    await writeInitialMonthValues(spreadsheetId, tabs, {
      trackingStartDate: toIsoDate(getMonthStart(monthKey)),
    })
  } catch (error) {
    localStorage.removeItem(SPREADSHEET_ID_KEY)
    throw error
  }

  return spreadsheetId
}

function clearRuntimeCaches({ clearLocal = false } = {}) {
  resolvedSpreadsheetId = null
  resolvedSpreadsheetPromise = null
  creationPromise = null
  monthPromises.clear()
  monthContexts.clear()
  cachedTransactions = null
  cachedSummary = null
  transactionsFetchPromise = null
  summaryFetchPromise = null
  if (clearLocal) localStorage.removeItem(SPREADSHEET_ID_KEY)
}

export async function ensureSpreadsheet() {
  // IMPORTANT: this caches only the canonical spreadsheet ID for the lifetime
  // of the loaded app. Financial data is still fetched fresh from Sheets.
  if (resolvedSpreadsheetId) return resolvedSpreadsheetId
  if (resolvedSpreadsheetPromise) return resolvedSpreadsheetPromise

  resolvedSpreadsheetPromise = (async () => {
    const resolved = await resolveSpreadsheet()

    if (typeof resolved === 'string') {
      resolvedSpreadsheetId = resolved
      return resolvedSpreadsheetId
    }

    resolvedSpreadsheetId = await createSpreadsheet(resolved?.configFileId ?? null)
    return resolvedSpreadsheetId
  })().finally(() => {
    resolvedSpreadsheetPromise = null
  })

  return resolvedSpreadsheetPromise
}

export function getSpreadsheetId() {
  // Exposed only as the most recently resolved local cache.
  return localStorage.getItem(SPREADSHEET_ID_KEY)
}

function rowToTransaction(row, rowIndex) {
  const obj = {}
  TRANSACTION_COLUMNS.forEach((key, i) => {
    obj[key] = row[i] ?? ''
  })
  return { ...obj, amount: Number(obj.amount) || 0, rowIndex }
}

function transactionToRow(t) {
  return TRANSACTION_COLUMNS.map(key => String(t[key] ?? ''))
}

async function readTransactionsFromMonth(spreadsheetId, monthKey) {
  const tabs = tabsForMonth(monthKey)
  const range = a1(tabs.transactions, 'A2:G')
  const data = await googleRequest(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`)
  const rows = data.values ?? []
  return rows.map((row, i) => rowToTransaction(row, i + 2))
}

async function readSummaryFromMonth(spreadsheetId, monthKey) {
  const tabs = tabsForMonth(monthKey)
  const ranges = [
    a1(tabs.summary, 'B2'),
    a1(tabs.summary, 'B3'),
    a1(tabs.summary, 'B4'),
    a1(tabs.summary, 'B5'),
    a1(tabs.summary, 'B6'),
    a1(tabs.summary, 'B7'),
    a1(tabs.summary, 'B8'),
  ]
  const qs = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')
  const data = await googleRequest(`${BASE}/${spreadsheetId}/values:batchGet?${qs}`)
  const [checking, credit, trackingStartDate, essential, discretionary, previousCharges, wallet] = data.valueRanges.map(
    vr => vr.values?.[0]?.[0] ?? ''
  )

  return { checking, credit, trackingStartDate, essential, discretionary, previousCharges, wallet }
}

async function migrateLegacyTabs(spreadsheetId, metadata, monthKey) {
  const tabs = tabsForMonth(monthKey)
  const currentTransactions = findSheet(metadata, tabs.transactions)
  const currentSummary = findSheet(metadata, tabs.summary)
  if (currentTransactions || currentSummary) return metadata

  const legacyTransactions = findSheet(metadata, SHEET_TABS.TRANSACTIONS)
  const legacySummary = findSheet(metadata, SHEET_TABS.SUMMARY)
  if (!legacyTransactions || !legacySummary) return metadata

  await googleRequest(`${BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: legacyTransactions.properties.sheetId,
              title: tabs.transactions,
            },
            fields: 'title',
          },
        },
        {
          updateSheetProperties: {
            properties: {
              sheetId: legacySummary.properties.sheetId,
              title: tabs.summary,
            },
            fields: 'title',
          },
        },
      ],
    }),
  })

  return getMetadata(spreadsheetId)
}

async function getCarryForward(spreadsheetId, metadata, currentMonthKey) {
  const previousMonthKey = getLatestPreviousMonthKey(metadata, currentMonthKey)
  if (!previousMonthKey) {
    return {
      checking: 0,
      credit: 0,
      essential: 0,
      discretionary: 0,
      previousCharges: 0,
      wallet: 0,
    }
  }

  const previousTabs = tabsForMonth(previousMonthKey)
  if (!findSheet(metadata, previousTabs.transactions) || !findSheet(metadata, previousTabs.summary)) {
    return {
      checking: 0,
      credit: 0,
      essential: 0,
      discretionary: 0,
      previousCharges: 0,
      wallet: 0,
    }
  }

  const [summary, transactions] = await Promise.all([
    readSummaryFromMonth(spreadsheetId, previousMonthKey),
    readTransactionsFromMonth(spreadsheetId, previousMonthKey),
  ])

  // Carry the real balance as of the first day of the new month. Credit that
  // is still waiting for the 10th stays outstanding and is charged automatically.
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

async function createMonthTabs(spreadsheetId, metadata, monthKey) {
  const tabs = tabsForMonth(monthKey)
  const missingTransactions = !findSheet(metadata, tabs.transactions)
  const missingSummary = !findSheet(metadata, tabs.summary)

  if (!missingTransactions && !missingSummary) return metadata

  const carry = await getCarryForward(spreadsheetId, metadata, monthKey)
  const requests = []
  if (missingTransactions) requests.push({ addSheet: { properties: { title: tabs.transactions } } })
  if (missingSummary) requests.push({ addSheet: { properties: { title: tabs.summary } } })

  await googleRequest(`${BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests }),
  })

  const data = []
  if (missingTransactions) {
    data.push({
      range: a1(tabs.transactions, 'A1:G1'),
      values: [TRANSACTION_HEADERS],
    })
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
    await googleRequest(`${BASE}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    })
  }

  return getMetadata(spreadsheetId)
}

async function ensureCurrentMonthInternal() {
  let spreadsheetId = await ensureSpreadsheet()
  const monthKey = getMonthKey()

  try {
    let metadata = await getMetadata(spreadsheetId)
    metadata = await migrateLegacyTabs(spreadsheetId, metadata, monthKey)
    metadata = await createMonthTabs(spreadsheetId, metadata, monthKey)
    return { spreadsheetId, monthKey, tabs: tabsForMonth(monthKey), metadata }
  } catch (error) {
    // If the whole spreadsheet was deleted from Drive, create a fresh one.
    if (error.status === 404) {
      clearRuntimeCaches({ clearLocal: true })
      spreadsheetId = await ensureSpreadsheet()
      const metadata = await getMetadata(spreadsheetId)
      return { spreadsheetId, monthKey, tabs: tabsForMonth(monthKey), metadata }
    }
    throw error
  }
}

export async function ensureCurrentMonth() {
  const spreadsheetId = await ensureSpreadsheet()
  const monthKey = getMonthKey()
  const key = `${spreadsheetId}:${monthKey}`

  // Cache only sheet/tab metadata. Actual balances/transactions are never
  // cached here and continue to be fetched directly from Google Sheets.
  if (monthContexts.has(key)) return monthContexts.get(key)

  if (!monthPromises.has(key)) {
    monthPromises.set(
      key,
      ensureCurrentMonthInternal()
        .then(context => {
          monthContexts.set(key, context)
          return context
        })
        .finally(() => {
          monthPromises.delete(key)
        })
    )
  }

  return monthPromises.get(key)
}

async function withCurrentMonthRetry(operation) {
  let context = await ensureCurrentMonth()

  try {
    return await operation(context)
  } catch (error) {
    // If the canonical workbook was deleted/replaced while this tab was open,
    // invalidate only runtime metadata and resolve again from Drive.
    if (![403, 404].includes(error?.status)) throw error

    clearRuntimeCaches({ clearLocal: true })
    context = await ensureCurrentMonth()
    return operation(context)
  }
}

export function getCachedTransactions() {
  return cachedTransactions ? cachedTransactions.map(item => ({ ...item })) : null
}

export async function fetchTransactions() {
  // Deduplicate only concurrent requests. A later call still goes to Sheets,
  // so another device's changes are picked up normally.
  if (transactionsFetchPromise) return transactionsFetchPromise

  transactionsFetchPromise = withCurrentMonthRetry(async ({ spreadsheetId, tabs }) => {
    const range = a1(tabs.transactions, 'A2:G')
    const data = await googleRequest(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`)
    const rows = data.values ?? []
    const result = rows.map((row, i) => rowToTransaction(row, i + 2))
    cachedTransactions = result
    return result.map(item => ({ ...item }))
  }).finally(() => {
    transactionsFetchPromise = null
  })

  return transactionsFetchPromise
}

export async function appendTransaction(transaction) {
  return withCurrentMonthRetry(({ spreadsheetId, tabs }) => {
    const range = a1(tabs.transactions, 'A2:G')
    return googleRequest(
      `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        body: JSON.stringify({ values: [transactionToRow(transaction)] }),
      }
    )
  })
}

export async function updateTransaction(transaction) {
  return withCurrentMonthRetry(({ spreadsheetId, tabs }) => {
    const range = a1(tabs.transactions, `A${transaction.rowIndex}:G${transaction.rowIndex}`)
    return googleRequest(
      `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [transactionToRow(transaction)] }),
      }
    )
  })
}

export async function deleteTransaction(rowIndex) {
  const row = Number(rowIndex)
  if (!Number.isInteger(row) || row < 2) {
    throw new Error('Invalid transaction row')
  }

  return withCurrentMonthRetry(({ spreadsheetId, tabs, metadata }) => {
    const sheet = findSheet(metadata, tabs.transactions)
    if (!sheet) throw new Error(`Sheet tab not found: ${tabs.transactions}`)

    // Sheets API uses zero-based indexes and an exclusive endIndex.
    return googleRequest(`${BASE}/${spreadsheetId}:batchUpdate`, {
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
  })
}

export function getCachedSummary() {
  return cachedSummary ? { ...cachedSummary } : null
}

export async function fetchSummary() {
  if (summaryFetchPromise) return summaryFetchPromise

  summaryFetchPromise = withCurrentMonthRetry(async ({ spreadsheetId, monthKey, tabs }) => {
    const ranges = [
    a1(tabs.summary, 'B2'),
    a1(tabs.summary, 'B3'),
    a1(tabs.summary, 'B4'),
    a1(tabs.summary, 'B5'),
    a1(tabs.summary, 'B6'),
    a1(tabs.summary, 'B7'),
    a1(tabs.summary, 'B8'),
  ]
  const qs = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')
  const data = await googleRequest(`${BASE}/${spreadsheetId}/values:batchGet?${qs}`)
  const [checking, credit, trackingStartDate, essential, discretionary, previousCharges, wallet] = data.valueRanges.map(
    vr => vr.values?.[0]?.[0] ?? ''
  )

  let startDate = trackingStartDate
  if (!startDate) {
    startDate = toIsoDate(getMonthStart(monthKey))
    const range = a1(tabs.summary, 'A4:B4')
    await googleRequest(
      `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [['תאריך תחילת מעקב', startDate]] }),
      }
    )
  }

  // Existing monthly sheets created before this feature won't have B7 yet.
  // Initialize it lazily so old data keeps working.
  if (previousCharges === '') {
    const previousRange = a1(tabs.summary, 'A7:B7')
    await googleRequest(
      `${BASE}/${spreadsheetId}/values/${encodeURIComponent(previousRange)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [['חיובים מחודש קודם', 0]] }),
      }
    )
  }

  // Existing monthly sheets created before wallet tracking won't have B8 yet.
  if (wallet === '') {
    const walletRange = a1(tabs.summary, 'A8:B8')
    await googleRequest(
      `${BASE}/${spreadsheetId}/values/${encodeURIComponent(walletRange)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [['יתרת ארנק התחלתית', 0]] }),
      }
    )
  }

    const result = {
      checking,
      credit,
      trackingStartDate: startDate,
      essential,
      discretionary,
      previousCharges: previousCharges === '' ? 0 : previousCharges,
      wallet: wallet === '' ? 0 : wallet,
    }
    cachedSummary = result
    return { ...result }
  }).finally(() => {
    summaryFetchPromise = null
  })

  return summaryFetchPromise
}

export async function preloadFinancialData() {
  // Warm the same canonical month in the background when the app opens.
  // No financial result is trusted permanently: screen refreshes still call
  // fetchSummary/fetchTransactions and therefore still read Google Sheets.
  await Promise.all([fetchSummary(), fetchTransactions()])
}

export async function updateSummaryCell(cell, value) {
  return updateSummaryCells([[cell, value]])
}

export async function updateSummaryCells(updates) {
  const cleanUpdates = (updates ?? []).filter(
    item => Array.isArray(item) && item.length >= 2 && item[0]
  )
  if (!cleanUpdates.length) return null

  return withCurrentMonthRetry(({ spreadsheetId, tabs }) =>
    googleRequest(`${BASE}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: cleanUpdates.map(([cell, value]) => ({
          range: a1(tabs.summary, cell),
          values: [[value]],
        })),
      }),
    })
  )
}
