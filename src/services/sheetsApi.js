import { getMonthKey } from '../utils/billing'

// Temporary in-memory view cache only. Nothing financial is written to
// localStorage/IndexedDB. A reload starts from Google Sheets again.
let cachedTransactions = null
let cachedSummary = null
let monthFetchPromise = null

function cloneTransactions(items) {
  return items ? items.map(item => ({ ...item })) : null
}

function clearFinancialViewCache() {
  cachedTransactions = null
  cachedSummary = null
  monthFetchPromise = null
}

async function apiRequest(action, payload = {}) {
  const response = await fetch('/api/data', {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      monthKey: getMonthKey(),
      ...payload,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (response.status === 401) {
    clearFinancialViewCache()
    window.location.assign('/')
    throw new Error('Not signed in')
  }

  if (!response.ok) {
    throw new Error(data.error || `Data request failed (${response.status})`)
  }

  return data.result
}

async function loadMonth() {
  // Summary + transactions share ONE browser request. Concurrent callers use
  // the same promise, so a Summary render never fires two requests.
  if (monthFetchPromise) return monthFetchPromise

  monthFetchPromise = apiRequest('loadMonth')
    .then(result => {
      cachedSummary = result?.summary ? { ...result.summary } : null
      cachedTransactions = cloneTransactions(result?.transactions ?? [])
      return {
        summary: cachedSummary ? { ...cachedSummary } : null,
        transactions: cloneTransactions(cachedTransactions) ?? [],
      }
    })
    .finally(() => {
      monthFetchPromise = null
    })

  return monthFetchPromise
}

export function getCachedTransactions() {
  return cloneTransactions(cachedTransactions)
}

export function getCachedSummary() {
  return cachedSummary ? { ...cachedSummary } : null
}

export async function fetchTransactions() {
  const result = await loadMonth()
  return cloneTransactions(result.transactions) ?? []
}

export async function fetchSummary() {
  const result = await loadMonth()
  return result.summary ? { ...result.summary } : null
}

export async function preloadFinancialData() {
  await loadMonth()
}

export async function appendTransaction(transaction) {
  const result = await apiRequest('appendTransaction', { transaction })
  clearFinancialViewCache()
  return result
}

export async function updateTransaction(transaction) {
  const result = await apiRequest('updateTransaction', { transaction })
  clearFinancialViewCache()
  return result
}

export async function deleteTransaction(rowIndex) {
  const result = await apiRequest('deleteTransaction', { rowIndex })
  clearFinancialViewCache()
  return result
}

export async function updateSummaryCell(cell, value) {
  return updateSummaryCells([[cell, value]])
}

export async function updateSummaryCells(updates) {
  const cleanUpdates = (updates ?? []).filter(
    item => Array.isArray(item) && item.length >= 2 && item[0]
  )
  if (!cleanUpdates.length) return null

  const result = await apiRequest('updateSummaryCells', { updates: cleanUpdates })
  cachedSummary = null
  monthFetchPromise = null
  return result
}

export async function ensureCurrentMonth() {
  return apiRequest('ensureMonth')
}

export async function ensureSpreadsheet() {
  const result = await apiRequest('ensureMonth')
  return result?.spreadsheetId ?? null
}

export function getSpreadsheetId() {
  return null
}
