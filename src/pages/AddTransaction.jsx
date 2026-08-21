import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  addBudget,
  addCategory,
  appendTransaction,
  deleteBudget,
  deleteCategory,
  fetchBudgets,
  fetchCategories,
} from '../services/sheetsApi'
import { PAYMENT_METHODS, TRANSACTION_TYPES } from '../config/sheetsConfig'
import { formatHebrewDate, formatIsoDate, getCreditChargeDate, toIsoDate } from '../utils/billing'
import { useSelectedMonth } from '../context/MonthContext'

function ChipRow({ label, options, value, onChange, allowClear = false }) {
  return (
    <div style={{ ...styles.field, ...styles.choiceField }}>
      <label style={styles.label}>{label}</label>
      <div style={{ ...styles.segmentedRow, gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => allowClear && value === opt ? onChange('') : onChange(opt)}
            style={{ ...(value === opt ? styles.chipSelected : styles.chip), ...styles.gridChip }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function HoldChip({ name, selected, onSelect, onDelete }) {
  const timerRef = useRef(null)
  const startRef = useRef(null)
  const suppressClickRef = useRef(false)

  function clearPress() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    startRef.current = null
  }

  function startPress(event) {
    clearPress()
    startRef.current = { x: event.clientX, y: event.clientY }
    timerRef.current = setTimeout(() => {
      suppressClickRef.current = true
      clearPress()
      onDelete(name)
    }, 650)
  }

  function movePress(event) {
    if (!startRef.current) return
    if (Math.abs(event.clientX - startRef.current.x) > 10 || Math.abs(event.clientY - startRef.current.y) > 10) {
      clearPress()
    }
  }

  return (
    <button
      type="button"
      title="לחיצה ארוכה למחיקה"
      aria-label={`${name}. לחיצה ארוכה למחיקה`}
      onPointerDown={startPress}
      onPointerMove={movePress}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onPointerLeave={clearPress}
      onContextMenu={event => {
        event.preventDefault()
        clearPress()
        suppressClickRef.current = true
        onDelete(name)
      }}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        onSelect(name)
      }}
      style={{
        ...(selected ? styles.chipSelected : styles.chip),
        ...styles.managedChip,
      }}
    >
      {name}
    </button>
  )
}

function CompactManagedPicker({
  label,
  options,
  value,
  onChange,
  onAdd,
  onDelete,
  busy,
  emptyLabel,
}) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (adding) requestAnimationFrame(() => inputRef.current?.focus())
  }, [adding])

  async function submit(event) {
    event.preventDefault()
    const clean = draft.trim().replace(/\s+/g, ' ')
    if (!clean || busy) return
    const ok = await onAdd(clean)
    if (ok !== false) {
      setDraft('')
      setAdding(false)
    }
  }

  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <button
        type="button"
        style={{ ...styles.pickerButton, ...(open ? styles.pickerButtonOpen : null) }}
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
      >
        <span style={{ color: value ? 'var(--text)' : 'var(--text-muted)' }}>
          {value || emptyLabel}
        </span>
        <span style={{ ...styles.pickerChevron, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
      </button>

      {open && (
        <div style={styles.pickerPanel}>
          <div style={styles.pickerActions}>
            <button
              type="button"
              style={styles.addManagedButton}
              onClick={() => {
                setAdding(current => !current)
                setDraft('')
              }}
            >
              + הוסף
            </button>
            {value && (
              <button type="button" style={styles.clearChoiceButton} onClick={() => onChange('')}>
                ללא
              </button>
            )}
            <span style={styles.holdHint}>לחיצה ארוכה למחיקה</span>
          </div>

          {adding && (
            <form style={styles.addManagedForm} onSubmit={submit}>
              <input
                ref={inputRef}
                style={styles.addManagedInput}
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder="שם חדש"
                maxLength={40}
                autoComplete="off"
              />
              <button type="submit" style={styles.addManagedSubmit} disabled={!draft.trim() || busy}>
                {busy ? '...' : 'שמור'}
              </button>
            </form>
          )}

          {options.length ? (
            <div style={styles.managedGrid}>
              {options.map(name => (
                <HoldChip
                  key={name}
                  name={name}
                  selected={value === name}
                  onSelect={selected => {
                    onChange(selected)
                    setOpen(false)
                  }}
                  onDelete={onDelete}
                />
              ))}
            </div>
          ) : (
            <div style={styles.emptyManaged}>אין פריטים. אפשר להוסיף עם הכפתור למעלה.</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AddTransaction() {
  const navigate = useNavigate()
  const { selectedMonthKey } = useSelectedMonth()
  const dateInputRef = useRef(null)
  const today = toIsoDate()

  function initialDateForMonth(monthKey) {
    return today.startsWith(`${monthKey}-`) ? today : `${monthKey}-01`
  }

  const [date, setDate] = useState(() => initialDateForMonth(selectedMonthKey))
  const [type, setType] = useState('הוצאה')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [budget, setBudget] = useState('')
  const [budgets, setBudgets] = useState([])
  const [managedBusy, setManagedBusy] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!date.startsWith(`${selectedMonthKey}-`)) setDate(initialDateForMonth(selectedMonthKey))
  }, [selectedMonthKey])

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchCategories(selectedMonthKey), fetchBudgets(selectedMonthKey)])
      .then(([categoryItems, budgetItems]) => {
        if (cancelled) return
        setCategories(categoryItems)
        setBudgets(budgetItems)
        setCategory(current => categoryItems.includes(current) ? current : (categoryItems[0] || ''))
        setBudget(current => budgetItems.some(item => item.name === current) ? current : '')
      })
      .catch(error => console.error('Failed to load managed lists:', error))
    return () => { cancelled = true }
  }, [selectedMonthKey])

  const automaticChargeDate = useMemo(() => {
    if (paymentMethod !== 'אשראי' || type !== 'הוצאה') return date
    return formatIsoDate(getCreditChargeDate(date))
  }, [date, paymentMethod, type])

  async function addManagedCategory(name) {
    if (managedBusy) return false
    setManagedBusy(true)
    try {
      const items = await addCategory(name, selectedMonthKey)
      setCategories(items)
      const selected = items.find(item => item.toLocaleLowerCase('he') === name.toLocaleLowerCase('he')) || name
      setCategory(selected)
      return true
    } catch (error) {
      alert('לא הצלחתי להוסיף את הקטגוריה: ' + error.message)
      return false
    } finally {
      setManagedBusy(false)
    }
  }

  async function removeManagedCategory(name) {
    if (managedBusy || !confirm(`למחוק את הקטגוריה "${name}"?`)) return
    setManagedBusy(true)
    try {
      const items = await deleteCategory(name, selectedMonthKey)
      setCategories(items)
      if (category === name) setCategory(items[0] || '')
    } catch (error) {
      alert('לא הצלחתי למחוק את הקטגוריה: ' + error.message)
    } finally {
      setManagedBusy(false)
    }
  }

  async function addManagedBudget(name) {
    if (managedBusy) return false
    setManagedBusy(true)
    try {
      const items = await addBudget(name, selectedMonthKey)
      setBudgets(items)
      const selected = items.find(item => item.name.toLocaleLowerCase('he') === name.toLocaleLowerCase('he'))?.name || name
      setBudget(selected)
      return true
    } catch (error) {
      alert('לא הצלחתי להוסיף את התקציב: ' + error.message)
      return false
    } finally {
      setManagedBusy(false)
    }
  }

  async function removeManagedBudget(name) {
    if (managedBusy || !confirm(`למחוק את התקציב "${name}" מהחודש הזה?`)) return
    setManagedBusy(true)
    try {
      const items = await deleteBudget(name, selectedMonthKey)
      setBudgets(items)
      if (budget === name) setBudget('')
    } catch (error) {
      alert('לא הצלחתי למחוק את התקציב: ' + error.message)
    } finally {
      setManagedBusy(false)
    }
  }

  async function save() {
    if (!amount || Number(amount) <= 0) return alert('נא להכניס סכום תקין')
    setSaving(true)
    try {
      const isWalletTransfer = type === 'העברה לארנק'
      const chargeDate = type === 'הוצאה' && paymentMethod === 'אשראי'
        ? automaticChargeDate
        : date

      await appendTransaction({
        date,
        type,
        amount: Number(amount),
        category: isWalletTransfer ? 'העברה לארנק' : category,
        budget: isWalletTransfer ? '' : budget,
        paymentMethod: isWalletTransfer ? 'עו״ש' : paymentMethod,
        chargeDate,
        description: description.trim(),
      }, selectedMonthKey)
      navigate('/transactions')
    } catch (error) {
      alert('שגיאה בשמירה: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={styles.container}>
        <div style={styles.topGrid}>
          <div style={{ ...styles.field, marginBottom: 0 }}>
            <label style={styles.label}>תאריך</label>
            <button
              type="button"
              style={styles.dateButton}
              onClick={() => dateInputRef.current?.showPicker ? dateInputRef.current.showPicker() : dateInputRef.current?.click()}
            >
              <span style={styles.dateButtonValue}>{formatHebrewDate(date)}</span>
              <input
                ref={dateInputRef}
                style={styles.hiddenDateInput}
                type="date"
                min={`${selectedMonthKey}-01`}
                max={formatIsoDate(new Date(Number(selectedMonthKey.slice(0, 4)), Number(selectedMonthKey.slice(5, 7)), 0))}
                value={date}
                onChange={event => setDate(event.target.value)}
              />
            </button>
          </div>

          <div style={{ ...styles.field, marginBottom: 0 }}>
            <label style={styles.label}>סכום (₪)</label>
            <input
              style={{ ...styles.input, ...styles.amountInput }}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={event => {
                const normalized = event.target.value.replace(',', '.')
                if (/^\d*(\.\d{0,2})?$/.test(normalized)) setAmount(normalized)
              }}
              placeholder="0"
            />
          </div>
        </div>

        <ChipRow label="סוג" options={TRANSACTION_TYPES} value={type} onChange={setType} />

        {type !== 'העברה לארנק' && (
          <>
            <CompactManagedPicker
              label="קטגוריה"
              options={categories}
              value={category}
              onChange={setCategory}
              onAdd={addManagedCategory}
              onDelete={removeManagedCategory}
              busy={managedBusy}
              emptyLabel="בחר קטגוריה"
            />

            <CompactManagedPicker
              label="תקציב"
              options={budgets.map(item => item.name)}
              value={budget}
              onChange={setBudget}
              onAdd={addManagedBudget}
              onDelete={removeManagedBudget}
              busy={managedBusy}
              emptyLabel="ללא תקציב"
            />

            <ChipRow label="אמצעי תשלום" options={PAYMENT_METHODS} value={paymentMethod} onChange={setPaymentMethod} />
          </>
        )}

        <div style={styles.field}>
          <label style={styles.label}>תיאור <span style={styles.optionalLabel}>אופציונלי</span></label>
          <input
            style={styles.input}
            type="text"
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="הערה קצרה"
            maxLength={120}
          />
        </div>

        {type === 'העברה לארנק' && <div style={styles.billingInfo}>הסכום יירד מיד מהעו״ש ויתווסף ליתרת הארנק</div>}
        {type === 'הוצאה' && (
          <div style={styles.billingInfo}>
            {paymentMethod === 'אשראי'
              ? `יתווסף לאשראי ויירד מהעו״ש ב־${formatHebrewDate(automaticChargeDate)}`
              : paymentMethod === 'מזומן'
                ? 'יירד מיתרת הארנק מיד'
                : 'יירד מיתרת העו״ש מיד'}
          </div>
        )}
      </div>

      {createPortal(
        <div style={styles.saveBar}>
          <button onClick={save} disabled={saving} style={styles.saveBtn}>
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

const styles = {
  container: { padding: '4px 16px 160px', direction: 'rtl', maxWidth: '480px', margin: '0 auto' },
  topGrid: { display: 'grid', gridTemplateColumns: '1.08fr .92fr', gap: '10px', marginBottom: '12px' },
  field: { minWidth: 0, marginBottom: '10px' },
  choiceField: { marginBottom: '10px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' },
  optionalLabel: { fontWeight: 500, opacity: .72 },
  input: {
    width: '100%', minWidth: 0, maxWidth: '100%', minHeight: '46px', padding: '0 14px', borderRadius: '14px',
    border: '1px solid var(--border)', fontSize: '16px', fontWeight: 500, lineHeight: 1.2, boxSizing: 'border-box',
    background: 'var(--surface)', color: 'var(--text)', outline: 'none', display: 'block', textAlign: 'center', WebkitAppearance: 'none',
  },
  dateButton: {
    width: '100%', minHeight: '46px', padding: '0 10px', borderRadius: '14px', border: '1px solid var(--border)', boxSizing: 'border-box',
    background: 'var(--surface)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', cursor: 'pointer',
  },
  dateButtonValue: { fontSize: '15px', fontWeight: 600, lineHeight: 1.2, textAlign: 'center', whiteSpace: 'nowrap' },
  hiddenDateInput: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' },
  amountInput: { textAlign: 'center', fontWeight: 700 },
  segmentedRow: { display: 'grid', gap: '6px', width: '100%' },
  chip: {
    minHeight: '38px', padding: '0 12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
    cursor: 'pointer', fontSize: '13px', fontWeight: 600, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', boxShadow: 'none',
  },
  chipSelected: {
    minHeight: '38px', padding: '0 12px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 14%, var(--surface))', color: 'var(--primary)',
    cursor: 'pointer', fontSize: '13px', fontWeight: 800, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
  },
  gridChip: { width: '100%', minWidth: 0, paddingInline: '6px' },
  pickerButton: {
    width: '100%', minHeight: '46px', padding: '0 14px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', textAlign: 'right',
  },
  pickerButtonOpen: { borderColor: 'color-mix(in srgb, var(--primary) 55%, var(--border))' },
  pickerChevron: { color: 'var(--text-muted)', fontSize: '18px', transition: 'transform 180ms ease' },
  pickerPanel: {
    marginTop: '6px', padding: '9px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--surface-soft)', boxShadow: 'var(--shadow)',
  },
  pickerActions: { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', minHeight: '32px' },
  addManagedButton: {
    minHeight: '32px', padding: '0 10px', borderRadius: '10px', border: '1px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, var(--surface))', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer',
  },
  clearChoiceButton: {
    minHeight: '32px', padding: '0 10px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer',
  },
  holdHint: { marginInlineStart: 'auto', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 650 },
  addManagedForm: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 68px', gap: '6px', marginBottom: '8px' },
  addManagedInput: {
    width: '100%', minWidth: 0, height: '40px', padding: '0 12px', borderRadius: '11px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontSize: '14px', textAlign: 'right',
  },
  addManagedSubmit: {
    height: '40px', borderRadius: '11px', border: '1px solid var(--primary)', background: 'var(--button)', color: 'var(--button-text)', fontWeight: 800, cursor: 'pointer',
  },
  managedGrid: { display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '166px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '1px' },
  managedChip: { minWidth: 'calc(33.333% - 4px)', flex: '1 0 auto', WebkitTouchCallout: 'none', userSelect: 'none' },
  emptyManaged: { padding: '10px 4px 6px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '12px' },
  billingInfo: { padding: '8px 10px', marginTop: '2px', marginBottom: '4px', borderRadius: '12px', background: 'var(--surface-soft)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, lineHeight: 1.35, textAlign: 'center' },
  saveBar: { position: 'fixed', zIndex: 40, left: '50%', bottom: 'calc(94px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', width: 'min(448px, calc(100% - 32px))', padding: '6px 0', background: 'var(--bg)' },
  saveBtn: { width: '100%', minHeight: '52px', padding: '14px 18px', background: 'var(--button)', color: 'var(--button-text)', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 24px rgba(16, 24, 40, 0.12)' },
}
