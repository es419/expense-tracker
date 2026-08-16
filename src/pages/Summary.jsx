import { useState, useEffect } from 'react'
import { fetchTransactions, fetchSummary, getCachedTransactions, getCachedSummary, updateSummaryCells } from '../services/sheetsApi'
import { signOut } from '../services/googleAuth'
import { computeFinancialState, formatHebrewDate, formatHebrewMonth } from '../utils/billing'

export default function Summary() {
  const cachedSummary = getCachedSummary()
  const cachedTransactions = getCachedTransactions()
  const [summary, setSummary] = useState(() => cachedSummary)
  const [transactions, setTransactions] = useState(() => cachedTransactions ?? [])
  const [loading, setLoading] = useState(() => !(cachedSummary && cachedTransactions))
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
    load({ showLoader: !(cachedSummary && cachedTransactions) })
  }, [])

  async function load({ showLoader = false } = {}) {
    try {
      if (showLoader) setLoading(true)
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

  if (loading) return <div style={styles.center} />

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
    padding: '18px 16px 112px',
    direction: 'rtl',
    maxWidth: '480px',
    margin: '0 auto',
  },
  header: {
    margin: '6px 0 18px',
    paddingRight: '62px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 880,
    letterSpacing: '-0.025em',
  },
  month: {
    marginTop: '3px',
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: 580,
  },
  primaryGrid: {
    display: 'grid',
    gap: '11px',
  },
  summaryCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '22px',
    padding: '16px 17px',
    boxShadow: 'var(--shadow)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
  },
  featuredCard: {
    paddingTop: '18px',
    paddingBottom: '18px',
    background: 'linear-gradient(145deg, color-mix(in srgb, var(--primary) 12%, var(--surface)), var(--surface))',
  },
  cardLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: 650,
  },
  cardValue: {
    fontSize: '28px',
    lineHeight: 1.15,
    fontWeight: 850,
    marginTop: '4px',
    letterSpacing: '-0.025em',
  },
  cardHint: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '6px',
    lineHeight: 1.4,
  },
  sectionHeader: {
    marginTop: '24px',
    marginBottom: '9px',
  },
  sectionHeading: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 820,
  },
  budgetCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '22px',
    padding: '5px 15px',
    boxShadow: 'var(--shadow)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
  },
  budgetRow: {
    padding: '14px 0',
  },
  budgetTopLine: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px',
  },
  budgetTitle: {
    fontSize: '14px',
    fontWeight: 720,
  },
  budgetValue: {
    fontSize: '15px',
    fontWeight: 780,
    textAlign: 'right',
    direction: 'ltr',
    unicodeBidi: 'embed',
    whiteSpace: 'nowrap',
  },
  barBg: {
    height: '7px',
    background: 'color-mix(in srgb, var(--surface-strong) 80%, transparent)',
    borderRadius: '999px',
    marginTop: '9px',
    overflow: 'hidden',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.10)',
  },
  barFill: {
    height: '100%',
    borderRadius: '999px',
    boxShadow: '0 2px 8px color-mix(in srgb, var(--primary) 28%, transparent)',
  },
  divider: {
    height: '1px',
    background: 'var(--border-subtle)',
  },
  settingsToggle: {
    width: '100%',
    marginTop: '17px',
    minHeight: '50px',
    padding: '13px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '18px',
    cursor: 'pointer',
    fontWeight: 760,
    fontSize: '14px',
    boxShadow: 'var(--shadow-soft)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
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
    borderRadius: '22px',
    boxShadow: 'var(--shadow)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
  },
  fieldCard: {
    display: 'block',
    padding: '12px',
    marginBottom: '10px',
    background: 'var(--surface-soft)',
    border: '1px solid var(--border)',
    borderRadius: '17px',
    boxShadow: 'var(--shadow-soft)',
  },
  fieldLabel: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    fontWeight: 700,
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
    borderRadius: '15px',
    border: '1px solid var(--border)',
    textAlign: 'right',
    background: 'var(--glass-field)',
    color: 'var(--text)',
    fontSize: '16px',
    outline: 'none',
    WebkitAppearance: 'none',
    boxShadow: 'inset 0 1px 0 var(--glass-highlight)',
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
    padding: '12px',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    background: 'var(--surface-soft)',
    boxShadow: 'var(--shadow-soft)',
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
    minHeight: '52px',
    marginTop: '14px',
    padding: '13px 16px',
    background: 'linear-gradient(180deg, color-mix(in srgb, var(--button) 92%, white 8%), var(--button))',
    color: 'var(--button-text)',
    border: '1px solid color-mix(in srgb, var(--border) 65%, transparent)',
    borderRadius: '18px',
    cursor: 'pointer',
    fontWeight: 820,
    fontSize: '14px',
    boxShadow: '0 14px 34px rgba(16,24,40,0.16), inset 0 1px 0 rgba(255,255,255,0.26)',
  },
  logoutBtn: {
    width: '100%',
    minHeight: '44px',
    marginTop: '14px',
    padding: '10px 12px',
    background: 'var(--danger-bg)',
    color: 'var(--expense)',
    border: '1px solid color-mix(in srgb, var(--expense) 26%, var(--border))',
    borderRadius: '16px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 740,
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh',
  },
}
