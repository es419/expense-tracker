import { getMonthKey } from '../utils/billing'

// In-memory view cache only. Financial data is never written to browser storage.
const monthCache = new Map()
const monthPromises = new Map()
let availableMonthsCache = null

const SUMMARY_CELL_FIELDS = {
  B2: 'checking',
  B3: 'credit',
  B4: 'trackingStartDate',
  B5: 'essential',
  B6: 'discretionary',
  B7: 'previousCharges',
  B8: 'wallet',
}

function cloneTransactions(items) {
  return items ? items.map(item => ({ ...item })) : null
}

function cloneMonth(value) {
  if (!value) return null
  return {
    summary: value.summary ? { ...value.summary } : null,
    transactions: cloneTransactions(value.transactions) ?? [],
    availableMonths: Array.isArray(value.availableMonths) ? [...value.availableMonths] : [],
  }
}

function cacheFor(monthKey) {
  return monthCache.get(monthKey) ?? null
}

function setMonthCache(monthKey, value) {
  const cached = cloneMonth(value)
  monthCache.set(monthKey, cached)
  if (cached.availableMonths.length) availableMonthsCache = [...cached.availableMonths]
  return cloneMonth(cached)
}

function clearMonthCache(monthKey) {
  monthCache.delete(monthKey)
  monthPromises.delete(monthKey)
}

function clearAllFinancialViewCache() {
  monthCache.clear()
  monthPromises.clear()
  availableMonthsCache = null
}

async function apiRequest(action, payload = {}, monthKey = getMonthKey()) {
  const response = await fetch('/api/data', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      monthKey,
      ...payload,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (response.status === 401) {
    clearAllFinancialViewCache()
    window.location.assign('/')
    throw new Error('Not signed in')
  }

  if (!response.ok) {
    throw new Error(data.error || `Data request failed (${response.status})`)
  }

  return data.result
}

async function loadMonth(monthKey = getMonthKey()) {
  const cached = cacheFor(monthKey)
  if (cached) return cloneMonth(cached)

  if (monthPromises.has(monthKey)) return monthPromises.get(monthKey)

  const promise = apiRequest('loadMonth', {}, monthKey)
    .then(result => setMonthCache(monthKey, {
      summary: result?.summary ? { ...result.summary } : null,
      transactions: cloneTransactions(result?.transactions ?? []) ?? [],
      availableMonths: Array.isArray(result?.availableMonths) ? result.availableMonths : [],
    }))
    .finally(() => {
      monthPromises.delete(monthKey)
    })

  monthPromises.set(monthKey, promise)
  return promise
}

function rowIndexFromAppendResult(result) {
  const range = String(result?.updates?.updatedRange ?? '')
  const match = range.match(/!A(\d+):H\d+$/)
  const row = Number(match?.[1])
  return Number.isInteger(row) && row >= 2 ? row : null
}

function patchCachedTransactions(monthKey, updater) {
  const cached = cacheFor(monthKey)
  if (!cached) return false

  const nextTransactions = updater(cloneTransactions(cached.transactions) ?? [])
  setMonthCache(monthKey, {
    ...cached,
    transactions: nextTransactions,
  })
  return true
}

export function getCachedTransactions(monthKey = getMonthKey()) {
  return cloneTransactions(cacheFor(monthKey)?.transactions)
}

export function getCachedSummary(monthKey = getMonthKey()) {
  const summary = cacheFor(monthKey)?.summary
  return summary ? { ...summary } : null
}

export async function fetchTransactions(monthKey = getMonthKey()) {
  const result = await loadMonth(monthKey)
  return cloneTransactions(result.transactions) ?? []
}

export async function fetchSummary(monthKey = getMonthKey()) {
  const result = await loadMonth(monthKey)
  return result.summary ? { ...result.summary } : null
}

export async function preloadFinancialData(monthKey = getMonthKey()) {
  return loadMonth(monthKey)
}

export async function refreshFinancialData(monthKey = getMonthKey()) {
  clearAllFinancialViewCache()
  return loadMonth(monthKey)
}

export async function fetchAvailableMonths() {
  if (availableMonthsCache?.length) return [...availableMonthsCache]

  const result = await apiRequest('listMonths', {}, getMonthKey())
  availableMonthsCache = Array.isArray(result) ? [...result] : []
  return [...availableMonthsCache]
}

export async function fetchCustomCategories(monthKey = getMonthKey()) {
  const result = await apiRequest('listCustomCategories', {}, monthKey)
  return Array.isArray(result) ? result : []
}

export async function addCustomCategory(category, monthKey = getMonthKey()) {
  const result = await apiRequest('addCustomCategory', { category }, monthKey)
  return Array.isArray(result) ? result : []
}

export async function deleteCustomCategory(category, monthKey = getMonthKey()) {
  const result = await apiRequest('deleteCustomCategory', { category }, monthKey)
  return Array.isArray(result) ? result : []
}

export async function appendTransaction(transaction, monthKey = getMonthKey()) {
  const result = await apiRequest('appendTransaction', { transaction }, monthKey)
  const rowIndex = rowIndexFromAppendResult(result)

  if (rowIndex) {
    patchCachedTransactions(monthKey, current => [
      ...current,
      { ...transaction, rowIndex },
    ])
  } else {
    // Fall back to a real read only if Google did not return the appended row.
    clearMonthCache(monthKey)
  }

  return result
}

export async function updateTransaction(transaction, monthKey = getMonthKey()) {
  const result = await apiRequest('updateTransaction', { transaction }, monthKey)
  const row = Number(transaction?.rowIndex)

  if (Number.isInteger(row) && row >= 2) {
    patchCachedTransactions(monthKey, current => current.map(item =>
      Number(item.rowIndex) === row ? { ...transaction, rowIndex: row } : item
    ))
  } else {
    clearMonthCache(monthKey)
  }

  return result
}

export async function deleteTransaction(rowIndex, monthKey = getMonthKey()) {
  const result = await apiRequest('deleteTransaction', { rowIndex }, monthKey)
  const row = Number(rowIndex)

  if (Number.isInteger(row) && row >= 2) {
    patchCachedTransactions(monthKey, current => current
      .filter(item => Number(item.rowIndex) !== row)
      .map(item => {
        const itemRow = Number(item.rowIndex)
        return Number.isInteger(itemRow) && itemRow > row
          ? { ...item, rowIndex: itemRow - 1 }
          : item
      }))
  } else {
    clearMonthCache(monthKey)
  }

  return result
}

export async function updateSummaryCell(cell, value, monthKey = getMonthKey()) {
  return updateSummaryCells([[cell, value]], monthKey)
}

export async function updateSummaryCells(updates, monthKey = getMonthKey()) {
  const cleanUpdates = (updates ?? []).filter(
    item => Array.isArray(item) && item.length >= 2 && item[0]
  )
  if (!cleanUpdates.length) return null

  const result = await apiRequest('updateSummaryCells', { updates: cleanUpdates }, monthKey)
  const cached = cacheFor(monthKey)

  if (cached?.summary) {
    const nextSummary = { ...cached.summary }
    for (const [cell, value] of cleanUpdates) {
      const field = SUMMARY_CELL_FIELDS[String(cell)]
      if (field) nextSummary[field] = value
    }
    setMonthCache(monthKey, { ...cached, summary: nextSummary })
  } else {
    clearMonthCache(monthKey)
  }

  return result
}

export async function ensureCurrentMonth(monthKey = getMonthKey()) {
  return apiRequest('ensureMonth', {}, monthKey)
}

export async function ensureSpreadsheet() {
  const result = await apiRequest('ensureMonth', {}, getMonthKey())
  return result?.spreadsheetId ?? null
}

export function getSpreadsheetId() {
  return null
}
