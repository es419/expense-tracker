import { useState, useEffect } from 'react'
import { deleteTransaction, fetchTransactions, getCachedTransactions } from '../services/sheetsApi'
import { formatHebrewDate, formatHebrewMonth, getCreditChargeDate, parseDate } from '../utils/billing'

export default function Transactions() {
  const cached = getCachedTransactions()
  const [transactions, setTransactions] = useState(() => cached ? [...cached].reverse() : [])
  const [loading, setLoading] = useState(() => !cached)
  const [error, setError] = useState(null)
  const [deletingRow, setDeletingRow] = useState(null)

  useEffect(() => {
    load({ showLoader: !cached })
  }, [])

  async function load({ showLoader = false } = {}) {
    try {
      if (showLoader) setLoading(true)
      setError(null)
      const data = await fetchTransactions()
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
      await deleteTransaction(t.rowIndex)
      await load()
    } catch (e) {
      window.alert(`לא הצלחתי למחוק את התנועה: ${e.message}`)
    } finally {
      setDeletingRow(null)
    }
  }

  if (loading) return <div style={styles.center}>טוען...</div>
  if (error) return <div style={styles.center}>שגיאה: {error}</div>

  const totalExpenses = transactions
    .filter(t => t.type === 'הוצאה')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0)

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>תנועות · {formatHebrewMonth()}</h2>
      <button onClick={() => load()} style={styles.refresh}>רענן</button>
      {transactions.length === 0 && (
        <p style={styles.empty}>אין תנועות עדיין</p>
      )}
      {transactions.map((t, i) => (
        <div key={t.rowIndex ?? i} style={styles.row}>
          <div style={styles.details}>
            <div style={styles.category}>{t.category}</div>
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
        <span style={styles.totalLabel}>סך הכול הוצאות</span>
        <strong style={styles.totalValue}>{totalExpenses.toFixed(0)} ₪</strong>
      </div>
    </div>
  )
}

const styles = {
  container: { padding: '16px', paddingBottom: '80px', direction: 'rtl' },
  title: { marginBottom: '8px' },
  refresh: { marginBottom: '16px', padding: '8px 16px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', color: 'var(--text)' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid var(--border)', gap: '10px', background: 'var(--surface)' },
  details: { minWidth: 0, flex: 1 },
  actions: { display: 'flex', alignItems: 'center', gap: '10px' },
  category: { fontWeight: '600', fontSize: '16px' },
  meta: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' },
  income: { color: 'var(--income)', fontWeight: '600', whiteSpace: 'nowrap' },
  expense: { color: 'var(--expense)', fontWeight: '600', whiteSpace: 'nowrap' },
  transfer: { color: 'var(--text-muted)', fontWeight: '600', whiteSpace: 'nowrap' },
  deleteBtn: { padding: '6px 9px', border: '1px solid color-mix(in srgb, var(--expense) 35%, transparent)', borderRadius: '7px', background: 'var(--danger-bg)', color: 'var(--expense)', cursor: 'pointer', fontSize: '12px' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' },
  empty: { textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' },
  totalBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '18px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)' },
  totalLabel: { fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 },
  totalValue: { fontSize: '20px', whiteSpace: 'nowrap' },
}
