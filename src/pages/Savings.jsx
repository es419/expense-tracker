import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { deleteSaving, fetchSavings, upsertSaving } from '../services/sheetsApi'
import { useSelectedMonth } from '../context/MonthContext'

const SAVING_TYPES = ['פנסיה', 'קרן השתלמות', 'חיסכון בנקאי', 'קופת גמל', 'השקעה', 'אחר']

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `saving-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function projectOneYear(item) {
  const balance = Math.max(Number(item.balance) || 0, 0)
  const deposit = Math.max(Number(item.monthlyDeposit) || 0, 0)
  const annualReturn = Math.max(Number(item.annualReturn) || 0, -99.9)
  const fee = Math.max(Number(item.managementFee) || 0, 0)
  const netAnnual = Math.max(annualReturn - fee, -99.9)
  const monthlyRate = Math.pow(1 + netAnnual / 100, 1 / 12) - 1
  let value = balance
  for (let month = 0; month < 12; month += 1) {
    value *= 1 + monthlyRate
    value += deposit
  }
  return value
}

function money(value) {
  return `${(Number(value) || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })} ₪`
}

function emptyForm() {
  return {
    id: createId(),
    name: '',
    type: SAVING_TYPES[0],
    balance: '',
    monthlyDeposit: '',
    annualReturn: '',
    managementFee: '',
  }
}

export default function Savings() {
  const { selectedMonthKey, refreshVersion } = useSelectedMonth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSavings(selectedMonthKey)
      .then(result => { if (!cancelled) setItems(result) })
      .catch(error => console.error('Failed to load savings:', error))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedMonthKey, refreshVersion])

  const totals = useMemo(() => {
    return items.reduce((acc, item) => ({
      balance: acc.balance + (Number(item.balance) || 0),
      monthlyDeposit: acc.monthlyDeposit + (Number(item.monthlyDeposit) || 0),
      projected: acc.projected + projectOneYear(item),
    }), { balance: 0, monthlyDeposit: 0, projected: 0 })
  }, [items])

  function openNew() {
    setForm(emptyForm())
    setEditorOpen(true)
  }

  function openEdit(item) {
    setForm({
      id: item.id,
      name: item.name,
      type: item.type || SAVING_TYPES[0],
      balance: String(item.balance ?? ''),
      monthlyDeposit: String(item.monthlyDeposit ?? ''),
      annualReturn: String(item.annualReturn ?? ''),
      managementFee: String(item.managementFee ?? ''),
    })
    setEditorOpen(true)
  }

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function saveItem(event) {
    event.preventDefault()
    if (!form.name.trim() || saving) return
    try {
      setSaving(true)
      const result = await upsertSaving({
        ...form,
        name: form.name.trim(),
        balance: Number(form.balance) || 0,
        monthlyDeposit: Number(form.monthlyDeposit) || 0,
        annualReturn: Number(form.annualReturn) || 0,
        managementFee: Number(form.managementFee) || 0,
      }, selectedMonthKey)
      setItems(result)
      setEditorOpen(false)
    } catch (error) {
      alert('לא הצלחתי לשמור את החיסכון: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeItem() {
    if (saving || !items.some(item => item.id === form.id)) return
    if (!confirm(`למחוק את "${form.name}"?`)) return
    try {
      setSaving(true)
      const result = await deleteSaving(form.id, selectedMonthKey)
      setItems(result)
      setEditorOpen(false)
    } catch (error) {
      alert('לא הצלחתי למחוק: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={styles.container}>
        <section style={styles.heroCard}>
          <div style={styles.heroLabel}>סה״כ חסכונות ונכסים פיננסיים</div>
          <div style={styles.heroValue}>{money(totals.balance)}</div>
          <div style={styles.heroGrid}>
            <div><span style={styles.miniLabel}>הפקדה חודשית</span><strong style={styles.miniValue}>{money(totals.monthlyDeposit)}</strong></div>
            <div><span style={styles.miniLabel}>תחזית לעוד שנה</span><strong style={styles.miniValue}>{money(totals.projected)}</strong></div>
          </div>
        </section>

        <div style={styles.notice}>
          היתרה הנוכחית היא הנתון האמיתי. התשואה ודמי הניהול משמשים רק לתחזית, ותשואה יכולה להיות גם שלילית.
        </div>

        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>החסכונות שלי</h3>
          <button type="button" style={styles.addButton} onClick={openNew}>+ הוסף</button>
        </div>

        {loading ? (
          <div style={styles.empty}>טוען...</div>
        ) : items.length ? (
          <div style={styles.list}>
            {items.map(item => {
              const projected = projectOneYear(item)
              const netReturn = (Number(item.annualReturn) || 0) - (Number(item.managementFee) || 0)
              return (
                <button key={item.id} type="button" style={styles.card} onClick={() => openEdit(item)}>
                  <div style={styles.cardTop}>
                    <div style={styles.cardTitleWrap}>
                      <strong style={styles.cardTitle}>{item.name}</strong>
                      <span style={styles.cardType}>{item.type}</span>
                    </div>
                    <strong style={styles.cardBalance}>{money(item.balance)}</strong>
                  </div>
                  <div style={styles.cardStats}>
                    <span>הפקדה {money(item.monthlyDeposit)} / חודש</span>
                    <span>נטו משוער {netReturn.toFixed(2)}%</span>
                  </div>
                  <div style={styles.projectionLine}>
                    <span>תחזית 12 חודשים</span>
                    <strong>{money(projected)}</strong>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div style={styles.empty}>אין עדיין חסכונות. הוסף פנסיה, קרן השתלמות, חיסכון בנקאי או כל נכס אחר.</div>
        )}
      </div>

      {editorOpen && createPortal(
        <div style={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false) }}>
          <form style={styles.modal} onSubmit={saveItem}>
            <div style={styles.modalHeader}>
              <strong>{items.some(item => item.id === form.id) ? 'עריכת חיסכון' : 'חיסכון חדש'}</strong>
              <button type="button" style={styles.closeButton} onClick={() => setEditorOpen(false)}>×</button>
            </div>

            <Field label="שם">
              <input style={styles.input} value={form.name} onChange={event => update('name', event.target.value)} placeholder="למשל: פנסיה מנורה" maxLength={60} />
            </Field>

            <Field label="סוג">
              <select style={styles.input} value={form.type} onChange={event => update('type', event.target.value)}>
                {SAVING_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </Field>

            <div style={styles.twoCols}>
              <Field label="יתרה נוכחית (₪)"><NumberInput value={form.balance} onChange={value => update('balance', value)} /></Field>
              <Field label="הפקדה חודשית (₪)"><NumberInput value={form.monthlyDeposit} onChange={value => update('monthlyDeposit', value)} /></Field>
            </div>

            <div style={styles.twoCols}>
              <Field label="תשואה שנתית משוערת (%)"><NumberInput value={form.annualReturn} onChange={value => update('annualReturn', value)} allowNegative /></Field>
              <Field label="דמי ניהול שנתיים (%)"><NumberInput value={form.managementFee} onChange={value => update('managementFee', value)} /></Field>
            </div>

            <div style={styles.previewBox}>
              <span>תחזית לעוד 12 חודשים</span>
              <strong>{money(projectOneYear(form))}</strong>
            </div>

            <button style={styles.saveButton} disabled={saving || !form.name.trim()}>{saving ? 'שומר...' : 'שמור'}</button>
            {items.some(item => item.id === form.id) && (
              <button type="button" style={styles.deleteButton} onClick={removeItem} disabled={saving}>מחק חיסכון</button>
            )}
          </form>
        </div>,
        document.body
      )}
    </>
  )
}

function Field({ label, children }) {
  return <label style={styles.field}><span style={styles.label}>{label}</span>{children}</label>
}

function NumberInput({ value, onChange, allowNegative = false }) {
  return (
    <input
      style={styles.input}
      type="number"
      inputMode="decimal"
      step="0.01"
      min={allowNegative ? '-99.9' : '0'}
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder="0"
    />
  )
}

const styles = {
  container: { padding: '4px 16px 110px', direction: 'rtl', maxWidth: '480px', margin: '0 auto' },
  heroCard: { padding: '16px', borderRadius: '18px', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow)' },
  heroLabel: { color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 },
  heroValue: { marginTop: '3px', fontSize: '32px', fontWeight: 850, lineHeight: 1.15 },
  heroGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' },
  miniLabel: { display: 'block', color: 'var(--text-muted)', fontSize: '10px', marginBottom: '3px' },
  miniValue: { fontSize: '14px' },
  notice: { marginTop: '9px', padding: '10px 11px', borderRadius: '13px', background: 'var(--surface-soft)', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.45 },
  sectionHeader: { marginTop: '18px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  sectionTitle: { margin: 0, fontSize: '15px' },
  addButton: { minHeight: '36px', padding: '0 12px', borderRadius: '11px', border: '1px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, var(--surface))', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer' },
  list: { display: 'grid', gap: '8px' },
  card: { width: '100%', padding: '13px', borderRadius: '15px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textAlign: 'right', cursor: 'pointer' },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
  cardTitleWrap: { minWidth: 0 },
  cardTitle: { display: 'block', fontSize: '14px' },
  cardType: { display: 'block', marginTop: '3px', color: 'var(--text-muted)', fontSize: '10px' },
  cardBalance: { fontSize: '18px', whiteSpace: 'nowrap' },
  cardStats: { display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '10px', color: 'var(--text-muted)', fontSize: '10px' },
  projectionLine: { display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '9px', paddingTop: '9px', borderTop: '1px solid var(--border)', fontSize: '11px' },
  empty: { padding: '20px 12px', border: '1px dashed var(--border)', borderRadius: '14px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px', lineHeight: 1.5 },
  modalBackdrop: { position: 'fixed', zIndex: 70, inset: 0, padding: 'max(18px, env(safe-area-inset-top)) 14px max(18px, env(safe-area-inset-bottom))', background: 'rgba(0,0,0,.42)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { width: 'min(452px, 100%)', maxHeight: '88dvh', overflowY: 'auto', padding: '14px', borderRadius: '20px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', boxShadow: '0 22px 55px rgba(0,0,0,.28)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', fontSize: '16px' },
  closeButton: { width: '34px', height: '34px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '24px', lineHeight: 1, cursor: 'pointer' },
  field: { display: 'block', marginBottom: '9px' },
  label: { display: 'block', marginBottom: '5px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700 },
  input: { width: '100%', minWidth: 0, minHeight: '44px', padding: '0 11px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontSize: '16px', textAlign: 'right' },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  previewBox: { display: 'flex', justifyContent: 'space-between', gap: '10px', margin: '4px 0 11px', padding: '11px', borderRadius: '12px', background: 'var(--surface-soft)', fontSize: '12px' },
  saveButton: { width: '100%', minHeight: '50px', border: 0, borderRadius: '14px', background: 'var(--button)', color: 'var(--button-text)', fontSize: '15px', fontWeight: 800, cursor: 'pointer' },
  deleteButton: { width: '100%', minHeight: '42px', marginTop: '8px', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--expense) 45%, var(--border))', background: 'transparent', color: 'var(--expense)', fontWeight: 750, cursor: 'pointer' },
}
