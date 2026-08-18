import { useState, useEffect } from 'react'
import { deleteTransaction, fetchTransactions, getCachedTransactions } from '../services/sheetsApi'
import { formatHebrewDate, getCreditChargeDate, parseDate } from '../utils/billing'
import { useSelectedMonth } from '../context/MonthContext'

export default function Transactions() {
  const { selectedMonthKey, refreshVersion } = useSelectedMonth()
  const cached = getCachedTransactions(selectedMonthKey)
  const [transactions, setTransactions] = useState(() => cached ? [...cached].reverse() : [])
  const [loading, setLoading] = useState(() => !cached)
  const [error, setError] = useState(null)
  const [deletingRow, setDeletingRow] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('')

  useEffect(() => {
    const monthCached = getCachedTransactions(selectedMonthKey)
    if (monthCached) {
      setTransactions([...monthCached].reverse())
      setLoading(false)
    }
    load({ showLoader: !monthCached })
  }, [selectedMonthKey, refreshVersion])

  async function load({ showLoader = false } = {}) {
    try {
      if (showLoader) setLoading(true)
      setError(null)
      const data = await fetchTransactions(selectedMonthKey)
      setTransactions([...data].reverse())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function transactionMeta(t) {
    const parts = [formatHebrewDate(t.date) || t.date, t.budget, t.paymentMethod]
    if (t.type === 'הוצאה' && t.paymentMethod === 'אשראי') {
      const chargeDate = parseDate(t.chargeDate) ?? getCreditChargeDate(t.date)
      parts.push(`חיוב ${formatHebrewDate(chargeDate)}`)
    }
    return parts.filter(Boolean).join(' · ')
  }

  async function handleDelete(t) {
    const label = t.category || 'התנועה הזאת'
    const approved = window.confirm(`למחוק את ${label} בסך ${t.amount} ₪?
המחיקה תתבצע גם ב-Google Sheets.`)
    if (!approved) return

    try {
      setDeletingRow(t.rowIndex)
      setError(null)
      await deleteTransaction(t.rowIndex, selectedMonthKey)
      await load()
    } catch (e) {
      window.alert(`לא הצלחתי למחוק את התנועה: ${e.message}`)
    } finally {
      setDeletingRow(null)
    }
  }

  if (loading) return <div style={styles.center} />
  if (error) return <div style={styles.center}>שגיאה: {error}</div>

  const categories = [...new Set(
    transactions
      .map(t => String(t.category || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'he'))

  const filteredTransactions = categoryFilter
    ? transactions.filter(t => t.category === categoryFilter)
    : transactions

  const filteredExpenses = filteredTransactions.filter(t => t.type === 'הוצאה')
  const totalExpenses = filteredExpenses
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0)

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <label style={styles.filterField}>
          <span style={styles.filterLabel}>סינון לפי קטגוריה</span>
          <select
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
            style={styles.filterSelect}
            aria-label="סינון רשומות לפי קטגוריה"
          >
            <option value="">כל הקטגוריות</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <button onClick={() => load()} style={styles.refresh}>רענן</button>
      </div>

      {filteredTransactions.length === 0 && (
        <p style={styles.empty}>
          {transactions.length === 0 ? 'אין תנועות עדיין' : 'אין תנועות בקטגוריה הזאת'}
        </p>
      )}
      {filteredTransactions.map((t, i) => (
        <div key={t.rowIndex ?? i} style={styles.row}>
          <div style={styles.details}>
            <div style={styles.categoryLine}>
              <div style={styles.category}>{t.category}</div>
              {String(t.description || '').includes('אוטומטי') ? (
                <span style={styles.autoBadge}>אוטומטי</span>
              ) : null}
            </div>
            {t.description ? <div style={styles.description}>{t.description}</div> : null}
            <div style={styles.meta}>{transactionMeta(t)}</div>
          </div>
          <div style={styles.actions}>
            <div
              style={
                t.type === 'הכנסה'
                  ? styles.income
                  : t.type === 'העברה לארנק'
                    ? styles.transfer
                    : styles.expense
              }
            >
              {t.type === 'הכנסה'
                ? `+${t.amount} ₪`
                : t.type === 'העברה לארנק'
                  ? `↔ ${t.amount} ₪`
                  : `${t.amount} ₪`}
            </div>
            <button
              type="button"
              onClick={() => handleDelete(t)}
              disabled={deletingRow !== null}
              style={{
                ...styles.deleteBtn,
                opacity: deletingRow !== null && deletingRow !== t.rowIndex ? 0.45 : 1,
              }}
              aria-label={`מחק ${t.category || 'תנועה'}`}
            >
              {deletingRow === t.rowIndex ? 'מוחק…' : 'מחק'}
            </button>
          </div>
        </div>
      ))}

      <div style={styles.totalBox}>
        <div style={styles.totalText}>
          <span style={styles.totalLabel}>
            {categoryFilter ? `סיכום · ${categoryFilter}` : 'סך הכול הוצאות'}
          </span>
          {categoryFilter ? (
            <span style={styles.totalCount}>
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'הוצאה' : 'הוצאות'}
            </span>
          ) : null}
        </div>
        <strong style={styles.totalValue}>{totalExpenses.toFixed(0)} ₪</strong>
      </div>
    </div>
  )
}

const styles = {
  container: { padding: '14px 16px 96px', direction: 'rtl', maxWidth: '480px', margin: '0 auto' },
  title: {
    marginBottom: '8px',
    padding: '0 54px',
    boxSizing: 'border-box',
    width: '100%',
    textAlign: 'center',
    fontSize: '22px',
  },
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'end',
    gap: '10px',
    marginBottom: '12px',
  },
  filterField: { display: 'grid', gap: '5px', minWidth: 0 },
  filterLabel: {
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 700,
    paddingInline: '2px',
  },
  filterSelect: {
    width: '100%',
    minWidth: 0,
    height: '42px',
    padding: '0 12px',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '15px',
    fontWeight: 700,
    outline: 'none',
    direction: 'rtl',
    boxSizing: 'border-box',
  },
  refresh: {
    minHeight: '42px',
    padding: '10px 16px',
    cursor: 'pointer',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontWeight: 700,
    boxShadow: 'var(--shadow)',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '13px 14px',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    gap: '10px',
    background: 'var(--surface)',
    boxShadow: 'var(--shadow)',
    marginBottom: '8px',
  },
  details: { minWidth: 0, flex: 1 },
  actions: { display: 'flex', alignItems: 'center', gap: '10px' },
  categoryLine: { display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' },
  category: { fontWeight: '600', fontSize: '16px' },
  autoBadge: {
    padding: '3px 7px',
    borderRadius: '999px',
    background: 'var(--surface-strong)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: '10px',
    fontWeight: 800,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  description: { fontSize: '13px', color: 'var(--text)', marginTop: '3px', lineHeight: 1.35 },
  meta: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' },
  income: { color: 'var(--income)', fontWeight: '600', whiteSpace: 'nowrap' },
  expense: { color: 'var(--expense)', fontWeight: '600', whiteSpace: 'nowrap' },
  transfer: { color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap' },
  deleteBtn: {
    minHeight: '36px',
    padding: '8px 12px',
    border: '1px solid color-mix(in srgb, var(--expense) 35%, transparent)',
    borderRadius: '12px',
    background: 'var(--danger-bg)',
    color: 'var(--expense)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 700,
  },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' },
  empty: { textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' },
  totalBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginTop: '14px',
    padding: '16px 18px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    boxShadow: 'var(--shadow)',
  },
  totalText: { display: 'grid', gap: '3px', minWidth: 0 },
  totalLabel: { fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 },
  totalCount: { fontSize: '12px', color: 'var(--text-muted)' },
  totalValue: { fontSize: '20px', whiteSpace: 'nowrap' },
}
