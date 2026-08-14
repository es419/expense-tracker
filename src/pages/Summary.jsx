import { useState, useEffect } from 'react'
import { fetchTransactions, fetchSummary, updateSummaryCell } from '../services/sheetsApi'
import { computeFinancialState, formatHebrewDate, formatHebrewMonth } from '../utils/billing'

export default function Summary() {
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setLoading(true)
      const [s, t] = await Promise.all([fetchSummary(), fetchTransactions()])
      setSummary(s)
      setTransactions(t)
    } finally {
      setLoading(false)
    }
  }

  function compute() {
    return computeFinancialState(summary, transactions, new Date())
  }

  async function saveCell(cell, value) {
    await updateSummaryCell(cell, value)
    await load()
  }

  if (loading) return <div style={styles.center}>טוען...</div>

  const { checking, credit, essentialSpent, discretionarySpent, nextCreditCharge } = compute()
  const essentialBudget = Number(summary.essential) || 0
  const discretionaryBudget = Number(summary.discretionary) || 0

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>סיכום · {formatHebrewMonth()}</h2>

      <div style={styles.card}>
        <div style={styles.cardLabel}>יתרת עו״ש</div>
        <div style={styles.cardValue}>{checking.toFixed(0)} ₪</div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardLabel}>אשראי שטרם ירד מהעו״ש</div>
        <div style={styles.cardValue}>{credit.toFixed(0)} ₪</div>
        <div style={styles.cardHint}>
          {credit > 0 && nextCreditCharge
            ? `החיוב הקרוב: ${formatHebrewDate(nextCreditCharge)}`
            : 'אין כרגע חיובי אשראי ממתינים'}
        </div>
      </div>

      <BudgetBar title="תקציב הכרחי" spent={essentialSpent} budget={essentialBudget} />
      <BudgetBar title="תקציב מותרות" spent={discretionarySpent} budget={discretionaryBudget} />

      <h3 style={styles.sectionTitle}>ערכי פתיחה</h3>

      <ManualRow label='יתרת עו״ש בתחילת המעקב' value={summary.checking} onSave={v => saveCell('B2', v)} />
      <ManualRow label="אשראי שכבר היה קיים בתחילת המעקב" value={summary.credit} onSave={v => saveCell('B3', v)} />
      <ManualRow label="תקציב הכרחי" value={summary.essential} onSave={v => saveCell('B5', v)} />
      <ManualRow label="תקציב מותרות" value={summary.discretionary} onSave={v => saveCell('B6', v)} />
    </div>
  )
}

function BudgetBar({ title, spent, budget }) {
  const pct = budget > 0 ? Math.min(spent / budget, 1) : 0
  const over = budget > 0 && spent > budget
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{title}</div>
      <div style={styles.cardValue}>{spent.toFixed(0)} / {budget.toFixed(0)} ₪</div>
      <div style={styles.barBg}>
        <div style={{ ...styles.barFill, width: `${pct * 100}%`, background: over ? '#c62828' : '#555' }} />
      </div>
    </div>
  )
}

function ManualRow({ label, value, onSave }) {
  const [local, setLocal] = useState(value ?? '')
  return (
    <div style={styles.manualRow}>
      <span style={styles.manualLabel}>{label}</span>
      <input style={styles.manualInput} value={local} onChange={e => setLocal(e.target.value)} type="number" />
      <button style={styles.saveBtn} onClick={() => onSave(local)}>שמור</button>
    </div>
  )
}

const styles = {
  container: { padding: '16px', paddingBottom: '80px', direction: 'rtl' },
  title: { marginBottom: '16px' },
  card: { background: 'rgba(127,127,127,0.10)', borderRadius: '12px', padding: '16px', marginBottom: '12px' },
  cardLabel: { fontSize: '13px', color: '#888' },
  cardValue: { fontSize: '22px', fontWeight: 'bold', marginTop: '4px' },
  cardHint: { fontSize: '12px', color: '#888', marginTop: '6px' },
  barBg: { height: '8px', background: 'rgba(127,127,127,0.2)', borderRadius: '4px', marginTop: '8px', overflow: 'hidden' },
  barFill: { height: '8px', borderRadius: '4px' },
  sectionTitle: { marginTop: '24px', marginBottom: '12px' },
  manualRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' },
  manualLabel: { flex: 1, fontSize: '13px' },
  manualInput: { width: '90px', padding: '6px', borderRadius: '6px', border: '1px solid #555', textAlign: 'right', background: 'transparent' },
  saveBtn: { padding: '6px 12px', background: '#333', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' },
}
