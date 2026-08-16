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
        <div>
          <h2 style={styles.title}>סיכום</h2>
          <div style={styles.month}>{formatHebrewMonth()}</div>
        </div>
      </div>

      <section style={styles.balanceCard} aria-label="מצב עו״ש">
        <div style={styles.balanceLabel}>יתרת עו״ש</div>
        <div style={styles.balanceValue}>{checking.toFixed(0)} ₪</div>

        <div style={styles.estimatedRow}>
          <span style={styles.estimatedLabel}>אחרי כל החיובים</span>
          <strong style={styles.estimatedValue}>{estimatedAfterAllCharges.toFixed(0)} ₪</strong>
        </div>
      </section>

      <div style={styles.quickStats}>
        <QuickStat
          label="ארנק"
          value={`${wallet.toFixed(0)} ₪`}
          hint="מזומן זמין"
        />
        <QuickStat
          label="אשראי"
          value={`${credit.toFixed(0)} ₪`}
          hint={
            credit > 0 && nextCreditCharge
              ? `יורד ${formatHebrewDate(nextCreditCharge)}`
              : 'אין חיוב ממתין'
          }
        />
      </div>

      <section style={styles.budgetsSection}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionHeading}>תקציב החודש</h3>
        </div>

        <div style={styles.budgetCard}>
          <BudgetRow title="הכרחי" spent={essentialSpent} budget={essentialBudget} />
          <div style={styles.divider} />
          <BudgetRow title="מותרות" spent={discretionarySpent} budget={discretionaryBudget} />
        </div>
      </section>

      <button
        type="button"
        style={styles.settingsToggle}
        onClick={() => setSettingsOpen(open => !open)}
        aria-expanded={settingsOpen}
      >
        <span>הגדרות החודש</span>
        <span
          aria-hidden="true"
          style={{
            ...styles.chevron,
            transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
         ⌄
        </span>
      </button>

      <div
        style={{
          ...styles.settingsWrap,
          ...(settingsOpen ? styles.settingsWrapOpen : styles.settingsWrapClosed),
        }}
      >
        <div style={styles.settingsInner}>
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
        </div>
      </div>
    </div>
  )
}

function QuickStat({ label, value, hint }) {
  return (
    <div style={styles.quickStat}>
      <div style={styles.quickStatLabel}>{label}</div>
      <div style={styles.quickStatValue}>{value}</div>
      <div style={styles.quickStatHint}>{hint}</div>
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
    marginBottom: '14px',
    paddingLeft: '54px',
    paddingRight: '54px',
    boxSizing: 'border-box',
    width: '100%',
    textAlign: 'center',
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

  balanceCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '18px 18px 14px',
    boxShadow: 'var(--shadow)',
  },
  balanceLabel: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: 650,
  },
  balanceValue: {
    marginTop: '2px',
    fontSize: '34px',
    lineHeight: 1.12,
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  estimatedRow: {
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px',
  },
  estimatedLabel: {
    color: 'var(--text-muted)',
    fontSize: '12px',
  },
  estimatedValue: {
    fontSize: '15px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  quickStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginTop: '10px',
  },
  quickStat: {
    minWidth: 0,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '12px 13px',
  },
  quickStatLabel: {
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 650,
  },
  quickStatValue: {
    marginTop: '2px',
    fontSize: '20px',
    lineHeight: 1.2,
    fontWeight: 780,
    whiteSpace: 'nowrap',
  },
  quickStatHint: {
    marginTop: '4px',
    minHeight: '14px',
    color: 'var(--text-muted)',
    fontSize: '10px',
    lineHeight: 1.35,
  },

  budgetsSection: {
    marginTop: '20px',
  },
  sectionHeader: {
    marginBottom: '8px',
  },
  sectionHeading: {
    margin: 0,
    fontSize: '15px',
  },
  budgetCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '2px 14px',
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
    fontSize: '13px',
    fontWeight: 700,
  },
  budgetValue: {
    fontSize: '13px',
    fontWeight: 700,
    textAlign: 'right',
    direction: 'ltr',
    unicodeBidi: 'embed',
    whiteSpace: 'nowrap',
    color: 'var(--text-muted)',
  },
  barBg: {
    height: '5px',
    background: 'var(--surface-strong)',
    borderRadius: '999px',
    marginTop: '7px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '999px',
    transition: 'width 260ms cubic-bezier(.2,.8,.2,1)',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
  },

  settingsToggle: {
    width: '100%',
    marginTop: '14px',
    minHeight: '46px',
    padding: '12px 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'transparent',
    color: 'var(--text)',
    border: 'none',
    borderTop: '1px solid var(--border)',
    cursor: 'pointer',
    fontWeight: 750,
    fontSize: '14px',
  },
  chevron: {
    color: 'var(--text-muted)',
    fontSize: '17px',
    lineHeight: 1,
    transition: 'transform 220ms cubic-bezier(.2,.82,.22,1)',
  },
  settingsWrap: {
    display: 'grid',
    overflow: 'hidden',
    transition: 'grid-template-rows 280ms cubic-bezier(.2,.82,.22,1), opacity 180ms ease',
  },
  settingsWrapOpen: {
    gridTemplateRows: '1fr',
    opacity: 1,
  },
  settingsWrapClosed: {
    gridTemplateRows: '0fr',
    opacity: 0,
  },
  settingsInner: {
    minHeight: 0,
  },
  settingsPanel: {
    marginTop: '4px',
    padding: '12px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
  },

  fieldCard: {
    display: 'block',
    padding: '11px',
    marginBottom: '9px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
  },
  fieldLabel: {
    display: 'block',
    marginBottom: '7px',
    fontSize: '12px',
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
    minHeight: '46px',
    padding: '11px 38px 11px 13px',
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
    marginTop: '12px',
    padding: '12px 16px',
    background: 'var(--button)',
    color: 'var(--button-text)',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '14px',
    boxShadow: '0 8px 18px rgba(16, 24, 40, 0.10)',
  },
  logoutBtn: {
    width: '100%',
    minHeight: '42px',
    marginTop: '14px',
    padding: '10px 12px',
    background: 'transparent',
    color: 'var(--expense)',
    border: '1px solid color-mix(in srgb, var(--expense) 28%, transparent)',
    borderRadius: '14px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 700,
  },
  center: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh',
  },
}
