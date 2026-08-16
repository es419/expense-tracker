import { getMonthKey } from '../utils/billing'

// In-memory view cache only. Financial data is never written to browser storage.
const monthCache = new Map()
const monthPromises = new Map()

function cloneTransactions(items) {
  return items ? items.map(item => ({ ...item })) : null
}

function cacheFor(monthKey) {
  return monthCache.get(monthKey) ?? null
}

function clearMonthCache(monthKey) {
  monthCache.delete(monthKey)
  monthPromises.delete(monthKey)
}

function clearAllFinancialViewCache() {
  monthCache.clear()
  monthPromises.clear()
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
  if (cached) {
    return {
      summary: cached.summary ? { ...cached.summary } : null,
      transactions: cloneTransactions(cached.transactions) ?? [],
    }
  }

  if (monthPromises.has(monthKey)) return monthPromises.get(monthKey)

  const promise = apiRequest('loadMonth', {}, monthKey)
    .then(result => {
      const value = {
        summary: result?.summary ? { ...result.summary } : null,
        transactions: cloneTransactions(result?.transactions ?? []) ?? [],
      }
      monthCache.set(monthKey, value)
      return {
        summary: value.summary ? { ...value.summary } : null,
        transactions: cloneTransactions(value.transactions) ?? [],
      }
    })
    .finally(() => {
      monthPromises.delete(monthKey)
    })

  monthPromises.set(monthKey, promise)
  return promise
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
  await loadMonth(monthKey)
}

export async function fetchAvailableMonths() {
  const result = await apiRequest('listMonths', {}, getMonthKey())
  return Array.isArray(result) ? result : []
}

export async function appendTransaction(transaction, monthKey = getMonthKey()) {
  const result = await apiRequest('appendTransaction', { transaction }, monthKey)
  clearMonthCache(monthKey)
  return result
}

export async function updateTransaction(transaction, monthKey = getMonthKey()) {
  const result = await apiRequest('updateTransaction', { transaction }, monthKey)
  clearMonthCache(monthKey)
  return result
}

export async function deleteTransaction(rowIndex, monthKey = getMonthKey()) {
  const result = await apiRequest('deleteTransaction', { rowIndex }, monthKey)
  clearMonthCache(monthKey)
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
  clearMonthCache(monthKey)
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
