import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addBudget,
  fetchBudgets,
  fetchSummary,
  fetchTransactions,
  getCachedSummary,
  getCachedTransactions,
  updateBudgetAmount,
  updateSummaryCells,
} from '../services/sheetsApi'
import { signOut } from '../services/googleAuth'
import { computeFinancialState, formatHebrewDate, getMonthKey, getMonthStart } from '../utils/billing'
import { useSelectedMonth } from '../context/MonthContext'

export default function Summary() {
  const { selectedMonthKey, refreshVersion } = useSelectedMonth()
  const cachedSummary = getCachedSummary(selectedMonthKey)
  const cachedTransactions = getCachedTransactions(selectedMonthKey)
  const [summary, setSummary] = useState(() => cachedSummary)
  const [transactions, setTransactions] = useState(() => cachedTransactions ?? [])
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(() => !(cachedSummary && cachedTransactions))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ checking: '', credit: '', wallet: '' })
  const [budgetDrafts, setBudgetDrafts] = useState({})
  const [newBudgetName, setNewBudgetName] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsDirty, setSettingsDirty] = useState(false)

  useEffect(() => {
    const monthSummary = getCachedSummary(selectedMonthKey)
    const monthTransactions = getCachedTransactions(selectedMonthKey)
    if (monthSummary && monthTransactions) {
      setSummary(monthSummary)
      setTransactions(monthTransactions)
      setLoading(false)
    }
    load({ showLoader: !(monthSummary && monthTransactions) })
  }, [selectedMonthKey, refreshVersion])

  async function load({ showLoader = false } = {}) {
    try {
      if (showLoader) setLoading(true)
      const [s, t, b] = await Promise.all([
        fetchSummary(selectedMonthKey),
        fetchTransactions(selectedMonthKey),
        fetchBudgets(selectedMonthKey),
      ])
      setSummary(s)
      setTransactions(t)
      setBudgets(b)
      setBudgetDrafts(Object.fromEntries(b.map(item => [item.name, String(item.amount ?? 0)])))
      setSettingsDirty(false)
    } finally {
      setLoading(false)
    }
  }

  function updateForm(field, value) {
    setSettingsForm(current => ({ ...current, [field]: value }))
    setSettingsDirty(true)
  }

  function updateBudgetDraft(name, value) {
    setBudgetDrafts(current => ({ ...current, [name]: value }))
    setSettingsDirty(true)
  }

  async function handleAddBudget(event) {
    event.preventDefault()
    const name = newBudgetName.trim().replace(/\s+/g, ' ')
    if (!name || savingSettings) return
    try {
      setSavingSettings(true)
      const items = await addBudget(name, selectedMonthKey)
      setBudgets(items)
      setBudgetDrafts(Object.fromEntries(items.map(item => [item.name, String(item.amount ?? 0)])))
      setNewBudgetName('')
    } catch (error) {
      alert('לא הצלחתי להוסיף את התקציב: ' + error.message)
    } finally {
      setSavingSettings(false)
    }
  }

  async function saveMonthSettings() {
    if (savingSettings || !settingsDirty) return
    const summaryUpdates = [
      ['B2', settingsForm.checking],
      ['B3', settingsForm.credit],
      ['B8', settingsForm.wallet],
    ].filter(([, value]) => value !== '')

    try {
      setSavingSettings(true)
      await Promise.all([
        summaryUpdates.length ? updateSummaryCells(summaryUpdates, selectedMonthKey) : Promise.resolve(),
        ...budgets.map(item => updateBudgetAmount(item.name, budgetDrafts[item.name] ?? item.amount, selectedMonthKey)),
      ])
      setSettingsForm({ checking: '', credit: '', wallet: '' })
      await load()
    } catch (error) {
      alert('לא הצלחתי לשמור את הגדרות החודש: ' + error.message)
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) return <div style={styles.center} />

  const now = new Date()
  const selectedStart = getMonthStart(selectedMonthKey)
  const isCurrentMonth = selectedMonthKey === getMonthKey(now)
  const referenceDate = isCurrentMonth
    ? now
    : new Date(selectedStart.getFullYear(), selectedStart.getMonth() + 1, 0, 23, 59, 59)
  const state = computeFinancialState(summary, transactions, referenceDate)
  const { checking, wallet, credit, budgetSpent = {}, nextCreditCharge } = state
  const estimatedAfterAllCharges = checking - credit
  const previousCharges = Number(summary?.previousCharges) || 0

  return (
    <>
      <div style={{ ...styles.container, paddingBottom: settingsOpen ? '170px' : styles.container.paddingBottom }}>
        <section style={styles.balanceCard} aria-label="מצב עו״ש">
          <div style={styles.balanceLabel}>יתרת עו״ש</div>
          <div style={styles.balanceValue}>{checking.toFixed(0)} ₪</div>
          <div style={styles.estimatedRow}>
            <span style={styles.estimatedLabel}>אחרי כל החיובים</span>
            <strong style={styles.estimatedValue}>{estimatedAfterAllCharges.toFixed(0)} ₪</strong>
          </div>
        </section>

        <div style={styles.quickStats}>
          <QuickStat label="ארנק" value={`${wallet.toFixed(0)} ₪`} hint="מזומן זמין" />
          <QuickStat
            label="אשראי"
            value={`${credit.toFixed(0)} ₪`}
            hint={credit > 0 && nextCreditCharge ? `יורד ${formatHebrewDate(nextCreditCharge)}` : 'אין חיוב ממתין'}
          />
        </div>

        <section style={styles.budgetsSection}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionHeading}>תקציב החודש</h3>
          </div>
          {budgets.length ? (
            <div style={styles.budgetCard}>
              {budgets.map((item, index) => (
                <div key={item.name}>
                  {index > 0 && <div style={styles.divider} />}
                  <BudgetRow title={item.name} spent={budgetSpent[item.name] || 0} budget={Number(item.amount) || 0} />
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyBudgetCard}>אין תקציבים פעילים בחודש הזה.</div>
          )}
        </section>

        <button
          type="button"
          style={styles.settingsToggle}
          onClick={() => setSettingsOpen(open => !open)}
          aria-expanded={settingsOpen}
        >
          <span>הגדרות החודש</span>
          <span aria-hidden="true" style={{ ...styles.chevron, transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
        </button>

        <div style={{ ...styles.settingsWrap, ...(settingsOpen ? styles.settingsWrapOpen : styles.settingsWrapClosed) }}>
          <div style={styles.settingsInner}>
            <div style={styles.settingsPanel}>
              {previousCharges > 0 && (
                <ReadOnlyRow
                  label="חיובים מחודש קודם"
                  value={previousCharges}
                  hint="הועבר אוטומטית מהאשראי שטרם ירד בחודש הקודם"
                />
              )}

              <ManualRow label='יתרת עו״ש בתחילת המעקב' value={settingsForm.checking} onChange={value => updateForm('checking', value)} />
              <ManualRow label="אשראי שכבר היה קיים בתחילת המעקב" value={settingsForm.credit} onChange={value => updateForm('credit', value)} />
              <ManualRow label="יתרת מזומן בארנק בתחילת המעקב" value={settingsForm.wallet} onChange={value => updateForm('wallet', value)} />

              <div style={styles.settingsSectionTitle}>תקציבים</div>
              {budgets.map(item => (
                <ManualRow
                  key={item.name}
                  label={item.name}
                  value={budgetDrafts[item.name] ?? ''}
                  onChange={value => updateBudgetDraft(item.name, value)}
                />
              ))}

              <form style={styles.addBudgetForm} onSubmit={handleAddBudget}>
                <input
                  style={styles.addBudgetInput}
                  value={newBudgetName}
                  onChange={event => setNewBudgetName(event.target.value)}
                  placeholder="שם תקציב חדש"
                  maxLength={40}
                />
                <button style={styles.addBudgetButton} disabled={!newBudgetName.trim() || savingSettings}>+ הוסף</button>
              </form>
              <div style={styles.settingsHint}>מחיקת תקציב נעשית בלחיצה ארוכה עליו במסך ההוספה.</div>

              <button style={styles.logoutBtn} onClick={signOut}>התנתק</button>
            </div>
          </div>
        </div>
      </div>

      {settingsOpen && createPortal(
        <div style={styles.settingsSaveBar}>
          <button style={styles.saveAllBtn} onClick={saveMonthSettings} disabled={savingSettings || !settingsDirty}>
            {savingSettings ? 'שומר…' : 'שמור שינויים'}
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

function QuickStat({ label, value, hint }) {
  return <div style={styles.quickStat}><div style={styles.quickStatLabel}>{label}</div><div style={styles.quickStatValue}>{value}</div><div style={styles.quickStatHint}>{hint}</div></div>
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
        <div style={{ ...styles.barFill, width: `${pct * 100}%`, background: over ? 'var(--expense)' : 'var(--primary)' }} />
      </div>
    </div>
  )
}

function ReadOnlyRow({ label, value, hint }) {
  return (
    <div style={styles.readOnlyRow}>
      <div style={styles.readOnlyText}><span style={styles.fieldLabel}>{label}</span>{hint ? <span style={styles.readOnlyHint}>{hint}</span> : null}</div>
      <strong style={styles.readOnlyValue}>{value.toFixed(0)} ₪</strong>
    </div>
  )
}

function ManualRow({ label, value, onChange }) {
  return (
    <label style={styles.fieldCard}>
      <span style={styles.fieldLabel}>{label}</span>
      <div style={styles.inputShell}>
        <input style={styles.manualInput} value={value} onChange={event => onChange(event.target.value)} type="number" inputMode="decimal" placeholder="הזן ערך" />
        <span style={styles.currencySuffix}>₪</span>
      </div>
    </label>
  )
}

const styles = {
  container: { padding: '14px 16px 92px', direction: 'rtl', maxWidth: '480px', margin: '0 auto' },
  center: { minHeight: '180px' },
  balanceCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 16px 12px', boxShadow: 'var(--shadow)' },
  balanceLabel: { color: 'var(--text-muted)', fontSize: '13px', fontWeight: 650 },
  balanceValue: { marginTop: '2px', fontSize: '34px', lineHeight: 1.12, fontWeight: 800, letterSpacing: '-0.02em' },
  estimatedRow: { marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' },
  estimatedLabel: { color: 'var(--text-muted)', fontSize: '12px' },
  estimatedValue: { fontSize: '14px', fontWeight: 800, whiteSpace: 'nowrap' },
  quickStats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' },
  quickStat: { minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '11px 12px' },
  quickStatLabel: { color: 'var(--text-muted)', fontSize: '12px', fontWeight: 650 },
  quickStatValue: { marginTop: '2px', fontSize: '20px', lineHeight: 1.2, fontWeight: 780, whiteSpace: 'nowrap' },
  quickStatHint: { marginTop: '4px', minHeight: '14px', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.35 },
  budgetsSection: { marginTop: '16px' },
  sectionHeader: { marginBottom: '6px' },
  sectionHeading: { margin: 0, fontSize: '15px' },
  budgetCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '0 12px' },
  emptyBudgetCard: { padding: '14px', border: '1px dashed var(--border)', borderRadius: '14px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' },
  budgetRow: { padding: '10px 0' },
  budgetTopLine: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' },
  budgetTitle: { fontSize: '13px', fontWeight: 700 },
  budgetValue: { fontSize: '13px', fontWeight: 700, direction: 'ltr', unicodeBidi: 'embed', whiteSpace: 'nowrap', color: 'var(--text-muted)' },
  barBg: { height: '5px', background: 'var(--surface-strong)', borderRadius: '999px', marginTop: '7px', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: '999px', transition: 'width 260ms cubic-bezier(.2,.8,.2,1)' },
  divider: { height: '1px', background: 'var(--border)' },
  settingsToggle: { width: '100%', marginTop: '14px', minHeight: '46px', padding: '12px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', color: 'var(--text)', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontWeight: 750, fontSize: '14px' },
  chevron: { color: 'var(--text-muted)', fontSize: '17px', lineHeight: 1, transition: 'transform 220ms cubic-bezier(.2,.82,.22,1)' },
  settingsWrap: { display: 'grid', overflow: 'hidden', transition: 'grid-template-rows 280ms cubic-bezier(.2,.82,.22,1), opacity 180ms ease' },
  settingsWrapOpen: { gridTemplateRows: '1fr', opacity: 1 },
  settingsWrapClosed: { gridTemplateRows: '0fr', opacity: 0 },
  settingsInner: { minHeight: 0 },
  settingsPanel: { marginTop: '4px', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px' },
  settingsSectionTitle: { margin: '14px 2px 8px', fontSize: '13px', fontWeight: 800 },
  fieldCard: { display: 'block', padding: '11px', marginBottom: '9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px' },
  fieldLabel: { display: 'block', marginBottom: '7px', fontSize: '12px', fontWeight: 650, color: 'var(--text)' },
  inputShell: { position: 'relative', display: 'flex', alignItems: 'center' },
  manualInput: { width: '100%', minHeight: '46px', padding: '11px 38px 11px 13px', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'right', background: 'var(--surface)', color: 'var(--text)', fontSize: '16px', outline: 'none', WebkitAppearance: 'none' },
  currencySuffix: { position: 'absolute', right: '14px', color: 'var(--text-muted)', fontSize: '13px' },
  readOnlyRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 2px 12px', marginBottom: '8px', borderBottom: '1px solid var(--border)' },
  readOnlyText: { minWidth: 0 },
  readOnlyHint: { display: 'block', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.35 },
  readOnlyValue: { whiteSpace: 'nowrap', fontSize: '14px' },
  addBudgetForm: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 82px', gap: '7px', marginTop: '4px' },
  addBudgetInput: { width: '100%', minWidth: 0, height: '42px', padding: '0 11px', border: '1px solid var(--border)', borderRadius: '11px', background: 'var(--bg)', color: 'var(--text)', outline: 'none', fontSize: '14px', textAlign: 'right' },
  addBudgetButton: { border: '1px solid var(--primary)', borderRadius: '11px', background: 'color-mix(in srgb, var(--primary) 12%, var(--surface))', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer' },
  settingsHint: { marginTop: '7px', color: 'var(--text-muted)', fontSize: '10px' },
  logoutBtn: { width: '100%', marginTop: '14px', minHeight: '44px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--expense)', fontWeight: 750, cursor: 'pointer' },
  settingsSaveBar: { position: 'fixed', zIndex: 45, left: '50%', bottom: 'calc(94px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', width: 'min(448px, calc(100% - 32px))', padding: '6px 0', background: 'var(--bg)' },
  saveAllBtn: { width: '100%', minHeight: '52px', border: 0, borderRadius: '16px', background: 'var(--button)', color: 'var(--button-text)', fontSize: '15px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 24px rgba(16, 24, 40, 0.12)' },
}
