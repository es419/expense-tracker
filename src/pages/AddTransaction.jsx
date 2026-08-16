import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { appendTransaction } from '../services/sheetsApi'
import { TRANSACTION_TYPES, BUDGET_TYPES, PAYMENT_METHODS, CATEGORIES } from '../config/sheetsConfig'
import { formatHebrewDate, formatIsoDate, getCreditChargeDate, toIsoDate } from '../utils/billing'
import { useSelectedMonth } from '../context/MonthContext'

function ChipRow({ label, options, value, onChange, allowClear = false }) {
  return (
    <div style={{ ...styles.field, ...styles.choiceField }}>
      <label style={styles.label}>{label}</label>
      <div style={styles.chipRow}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (allowClear && value === opt) onChange('')
              else onChange(opt)
            }}
            style={value === opt ? styles.chipSelected : styles.chip}
          >
            {opt}
          </button>
        ))}
      </div>
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
  const [category, setCategory] = useState(CATEGORIES[0])
  const [budget, setBudget] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!date.startsWith(`${selectedMonthKey}-`)) {
      setDate(initialDateForMonth(selectedMonthKey))
    }
  }, [selectedMonthKey])

  const automaticChargeDate = useMemo(() => {
    if (paymentMethod !== 'אשראי' || type !== 'הוצאה') return date
    return formatIsoDate(getCreditChargeDate(date))
  }, [date, paymentMethod, type])

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
    } catch (e) {
      alert('שגיאה בשמירה: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>הוספה</h2>

      <div style={styles.field}>
        <label style={styles.label}>תאריך</label>
        <button
          type="button"
          style={styles.dateButton}
          onClick={() => {
            if (dateInputRef.current?.showPicker) dateInputRef.current.showPicker()
            else dateInputRef.current?.click()
          }}
        >
          <span style={styles.dateButtonValue}>{formatHebrewDate(date)}</span>
          <input
            ref={dateInputRef}
            style={styles.hiddenDateInput}
            type="date"
            min={`${selectedMonthKey}-01`}
            max={formatIsoDate(new Date(Number(selectedMonthKey.slice(0, 4)), Number(selectedMonthKey.slice(5, 7)), 0))}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </button>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>סכום (₪)</label>
        <input
          style={{ ...styles.input, ...styles.amountInput }}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          value={amount}
          onChange={e => {
            const normalized = e.target.value.replace(',', '.')
            if (/^\d*(\.\d{0,2})?$/.test(normalized)) {
              setAmount(normalized)
            }
          }}
          placeholder="0"
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>תיאור (אופציונלי)</label>
        <input
          style={styles.input}
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="למשל: תיקון, החזר, הערה"
          maxLength={120}
        />
      </div>

      <ChipRow label="סוג" options={TRANSACTION_TYPES} value={type} onChange={setType} />

      {type !== 'העברה לארנק' && (
        <>
          <ChipRow label="קטגוריה" options={CATEGORIES} value={category} onChange={setCategory} />
          <ChipRow
            label="תקציב"
            options={BUDGET_TYPES}
            value={budget}
            onChange={setBudget}
            allowClear
          />
          <ChipRow label="אמצעי תשלום" options={PAYMENT_METHODS} value={paymentMethod} onChange={setPaymentMethod} />
        </>
      )}

      {type === 'העברה לארנק' && (
        <div style={styles.billingInfo}>
          הסכום יירד מיד מהעו״ש ויתווסף ליתרת הארנק
        </div>
      )}

      {type === 'הוצאה' && (
        <div style={styles.billingInfo}>
          {paymentMethod === 'אשראי'
            ? `יתווסף לאשראי ויירד מהעו״ש ב־${formatHebrewDate(automaticChargeDate)}`
            : paymentMethod === 'מזומן'
              ? 'יירד מיתרת הארנק מיד'
              : 'יירד מיתרת העו״ש מיד'}
        </div>
      )}

      <div style={styles.saveBar}>
        <button onClick={save} disabled={saving} style={styles.saveBtn}>
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '10px 16px 160px',
    direction: 'rtl',
    maxWidth: '480px',
    margin: '0 auto',
  },
  title: {
    marginBottom: '8px',
    padding: '0 54px',
    boxSizing: 'border-box',
    width: '100%',
    textAlign: 'center',
    fontSize: '18px',
    lineHeight: 1.2,
  },
  field: {
    marginBottom: '8px',
  },
  choiceField: {
    marginBottom: '6px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '3px',
  },
  input: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    minHeight: '48px',
    padding: '0 16px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    fontSize: '16px',
    fontWeight: 500,
    lineHeight: 1.2,
    boxSizing: 'border-box',
    background: 'var(--surface)',
    color: 'var(--text)',
    outline: 'none',
    display: 'block',
    textAlign: 'center',
    WebkitAppearance: 'none',
  },
  dateButton: {
    width: '100%',
    minHeight: '50px',
    padding: '0 14px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    boxSizing: 'border-box',
    background: 'var(--surface)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  dateButtonValue: {
    fontSize: '16px',
    fontWeight: 500,
    lineHeight: 1.2,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  hiddenDateInput: {
    position: 'absolute',
    inset: 0,
    opacity: 0,
    width: '100%',
    height: '100%',
    cursor: 'pointer',
  },
  amountInput: {
    textAlign: 'center',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    alignItems: 'center',
  },
  chip: {
    minHeight: '36px',
    padding: '0 13px',
    borderRadius: '999px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset',
  },
  chipSelected: {
    minHeight: '40px',
    padding: '0 15px',
    borderRadius: '999px',
    border: '1px solid var(--primary)',
    background: 'var(--primary)',
    color: 'var(--primary-text)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    boxShadow: '0 6px 16px rgba(37, 99, 235, 0.18)',
  },
  billingInfo: {
    padding: '7px 10px',
    marginBottom: '6px',
    borderRadius: '12px',
    background: 'var(--surface-soft)',
    fontSize: '14px',
    textAlign: 'center',
  },
  saveBar: {
    position: 'fixed',
    zIndex: 24,
    left: '50%',
    bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
    transform: 'translateX(-50%)',
    width: 'min(448px, calc(100% - 32px))',
    padding: '8px 0',
    background: 'var(--bg)',
  },
  saveBtn: {
    width: '100%',
    minHeight: '52px',
    padding: '14px 18px',
    background: 'var(--button)',
    color: 'var(--button-text)',
    border: 'none',
    borderRadius: '16px',
    fontSize: '16px',
    fontWeight: 800,
    cursor: 'pointer',
    marginTop: 0,
    boxShadow: '0 10px 24px rgba(16, 24, 40, 0.12)',
  },
}

