import { useState, useEffect } from 'react'
import { fetchTransactions, fetchSummary, updateSummaryCells } from '../services/sheetsApi'
import { signOut } from '../services/googleAuth'
import { computeFinancialState, formatHebrewDate, formatHebrewMonth } from '../utils/billing'

export default function Summary() {
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    checking: '',
    credit: '',
    essential: '',
    discretionary: '',
    wallet: '',
  })
  const [savingSettings, setSavingSettings] = useState(false)

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

  function compute(referenceDate = new Date()) {
    return computeFinancialState(summary, transactions, referenceDate)
  }

  function updateForm(field, value) {
    setSettingsForm(current => ({ ...current, [field]: value }))
  }

  async function saveMonthSettings() {
    if (savingSettings) return

    const updates = [
      ['B2', settingsForm.checking],
      ['B3', settingsForm.credit],
      ['B5', settingsForm.essential],
      ['B6', settingsForm.discretionary],
      ['B8', settingsForm.wallet],
    ].filter(([, value]) => value !== '')

    if (updates.length === 0) return

    try {
      setSavingSettings(true)

      // One Google Sheets batch write instead of one network request per field.
      await updateSummaryCells(updates)

      setSettingsForm({
        checking: '',
        credit: '',
        essential: '',
        discretionary: '',
        wallet: '',
      })

      await load()
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) return <div style={styles.center}>טוען...</div>

  const now = new Date()
  const { checking, wallet, credit, essentialSpent, discretionarySpent, nextCreditCharge } = compute(now)
  const estimatedAfterAllCharges = checking - credit
  const essentialBudget = Number(summary.essential) || 0
  const discretionaryBudget = Number(summary.discretionary) || 0
  const previousCharges = Number(summary.previousCharges) || 0

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>סיכום</h2>
        <div style={styles.month}>{formatHebrewMonth()}</div>
      </div>

      <div style={styles.primaryGrid}>
        <SummaryCard label="יתרת עו״ש" value={`${checking.toFixed(0)} ₪`} />
        <SummaryCard
          label="יתרת ארנק"
          value={`${wallet.toFixed(0)} ₪`}
          hint="המזומן שנמצא בארנק כרגע"
        />

        <SummaryCard
          label="אשראי שטרם ירד"
          value={`${credit.toFixed(0)} ₪`}
          hint={
            credit > 0 && nextCreditCharge
              ? `חיוב קרוב: ${formatHebrewDate(nextCreditCharge)}`
              : 'אין חיובים ממתינים'
          }
        />

        <SummaryCard
          label="עו״ש משוער לאחר כל החיובים"
          value={`${estimatedAfterAllCharges.toFixed(0)} ₪`}
          hint="לאחר הפחתת כל האשראי שטרם ירד"
          featured
        />
      </div>

      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionHeading}>תקציבים</h3>
      </div>

      <div style={styles.budgetCard}>
        <BudgetRow title="הכרחי" spent={essentialSpent} budget={essentialBudget} />
        <div style={styles.divider} />
        <BudgetRow title="מותרות" spent={discretionarySpent} budget={discretionaryBudget} />
      </div>

      <button
        type="button"
        style={styles.settingsToggle}
        onClick={() => setSettingsOpen(open => !open)}
        aria-expanded={settingsOpen}
      >
        <span>הגדרות חודש</span>
        <span style={styles.chevron}>{settingsOpen ? '▲' : '▼'}</span>
      </button>

      {settingsOpen && (
        <div style={styles.settingsPanel}>
          {previousCharges > 0 && (
            <ReadOnlyRow
              label="חיובים מחודש קודם"
              value={previousCharges}
              hint="הועבר אוטומטית מהאשראי שטרם ירד בחודש הקודם"
            />
          )}

          <ManualRow
            label='יתרת עו״ש בתחילת המעקב'
            value={settingsForm.checking}
            onChange={value => updateForm('checking', value)}
          />
          <ManualRow
            label="אשראי שכבר היה קיים בתחילת המעקב"
            value={settingsForm.credit}
            onChange={value => updateForm('credit', value)}
          />
          <ManualRow
            label="תקציב הכרחי"
            value={settingsForm.essential}
            onChange={value => updateForm('essential', value)}
          />
          <ManualRow
            label="תקציב מותרות"
            value={settingsForm.discretionary}
            onChange={value => updateForm('discretionary', value)}
          />
          <ManualRow
            label="יתרת מזומן בארנק בתחילת המעקב"
            value={settingsForm.wallet}
            onChange={value => updateForm('wallet', value)}
          />

          <button
            style={styles.saveAllBtn}
            onClick={saveMonthSettings}
            disabled={savingSettings || !Object.values(settingsForm).some(value => value !== '')}
          >
            {savingSettings ? 'שומר…' : 'שמור שינויים'}
          </button>

          <button style={styles.logoutBtn} onClick={signOut}>התנתק</button>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, hint, featured = false }) {
  return (
    <div style={{ ...styles.summaryCard, ...(featured ? styles.featuredCard : {}) }}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{value}</div>
      {hint ? <div style={styles.cardHint}>{hint}</div> : null}
    </div>
  )
}

function BudgetRow({ title, spent, budget }) {
  const pct = budget > 0 ? Math.min(spent / budget, 1) : 0
  const over = budget > 0 && spent > budget

  return (
    <div style={styles.budgetRow}>
      <div style={styles.budgetTopLine}>
        <span style={styles.budgetTitle}>{title}</span>
        <span style={styles.budgetValue}>{spent.toFixed(0)} / {budget.toFixed(0)} ₪</span>
      </div>
      <div style={styles.barBg}>
        <div
          style={{
            ...styles.barFill,
            width: `${pct * 100}%`,
            background: over ? 'var(--expense)' : 'var(--primary)',
          }}
        />
      </div>
    </div>
  )
}

function ReadOnlyRow({ label, value, hint }) {
  return (
    <div style={styles.readOnlyRow}>
      <div style={styles.readOnlyText}>
        <span style={styles.fieldLabel}>{label}</span>
        {hint ? <span style={styles.readOnlyHint}>{hint}</span> : null}
      </div>
      <strong style={styles.readOnlyValue}>{value.toFixed(0)} ₪</strong>
    </div>
  )
}

function ManualRow({ label, value, onChange }) {
  return (
    <label style={styles.fieldCard}>
      <span style={styles.fieldLabel}>{label}</span>
      <div style={styles.inputShell}>
        <input
          style={styles.manualInput}
          value={value}
          onChange={e => onChange(e.target.value)}
          type="number"
          inputMode="decimal"
          placeholder="הזן ערך"
        />
        <span style={styles.currencySuffix}>₪</span>
      </div>
    </label>
  )
}

const styles = {
  container: {
    padding: '18px 16px 92px',
    direction: 'rtl',
    maxWidth: '480px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '26px',
  },
  month: {
    marginTop: '2px',
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
  primaryGrid: {
    display: 'grid',
    gap: '10px',
  },
  summaryCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '14px 16px',
    boxShadow: 'var(--shadow)',
  },
  featuredCard: {
    paddingTop: '16px',
    paddingBottom: '16px',
  },
  cardLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  cardValue: {
    fontSize: '25px',
    lineHeight: 1.2,
    fontWeight: 750,
    marginTop: '3px',
  },
  cardHint: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '5px',
  },
  sectionHeader: {
    marginTop: '22px',
    marginBottom: '8px',
  },
  sectionHeading: {
    margin: 0,
    fontSize: '16px',
  },
  budgetCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '4px 14px',
    boxShadow: 'var(--shadow)',
  },
  budgetRow: {
    padding: '12px 0',
  },
  budgetTopLine: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px',
  },
  budgetTitle: {
    fontSize: '14px',
    fontWeight: 650,
  },
  budgetValue: {
    fontSize: '15px',
    fontWeight: 700,
    textAlign: 'right',
    direction: 'ltr',
    unicodeBidi: 'embed',
    whiteSpace: 'nowrap',
  },
  barBg: {
    height: '6px',
    background: 'var(--surface-strong)',
    borderRadius: '999px',
    marginTop: '8px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '999px',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
  },
  settingsToggle: {
    width: '100%',
    marginTop: '16px',
    padding: '13px 15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 650,
    fontSize: '14px',
  },
  chevron: {
    color: 'var(--text-muted)',
    fontSize: '10px',
  },
  settingsPanel: {
    marginTop: '10px',
    padding: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    boxShadow: 'var(--shadow)',
  },
  fieldCard: {
    display: 'block',
    padding: '12px',
    marginBottom: '10px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
  },
  fieldLabel: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 650,
    color: 'var(--text)',
  },
  inputShell: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  manualInput: {
    width: '100%',
    minHeight: '48px',
    padding: '12px 38px 12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    textAlign: 'right',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '16px',
    outline: 'none',
    WebkitAppearance: 'none',
  },
  currencySuffix: {
    position: 'absolute',
    right: '14px',
    color: 'var(--text-muted)',
    fontSize: '14px',
    pointerEvents: 'none',
  },
  readOnlyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '8px',
    padding: '11px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'var(--bg)',
  },
  readOnlyText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
  },
  readOnlyHint: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  readOnlyValue: {
    whiteSpace: 'nowrap',
    fontSize: '14px',
  },
  saveAllBtn: {
    width: '100%',
    minHeight: '48px',
    marginTop: '14px',
    padding: '12px 14px',
    background: 'var(--button)',
    color: 'var(--button-text)',
    border: 'none',
    borderRadius: '9px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
  },
  logoutBtn: {
    width: '100%',
    marginTop: '16px',
    padding: '9px 12px',
    background: 'transparent',
    color: 'var(--expense)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh',
  },
}
