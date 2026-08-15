import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { appendTransaction } from '../services/sheetsApi'
import { TRANSACTION_TYPES, BUDGET_TYPES, PAYMENT_METHODS, CATEGORIES } from '../config/sheetsConfig'
import { formatHebrewDate, formatHebrewMonth, formatIsoDate, getCreditChargeDate, toIsoDate } from '../utils/billing'

function ChipRow({ label, options, value, onChange }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div style={styles.chipRow}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
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
  const today = toIsoDate()

  const [date, setDate] = useState(today)
  const [type, setType] = useState('הוצאה')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [budget, setBudget] = useState(BUDGET_TYPES[0])
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0])
  const [saving, setSaving] = useState(false)

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
      })
      navigate('/transactions')
    } catch (e) {
      alert('שגיאה בשמירה: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>תנועה חדשה · {formatHebrewMonth()}</h2>

      <div style={styles.field}>
        <label style={styles.label}>תאריך</label>
        <div style={styles.dateInputWrap}>
          <input
            style={{ ...styles.input, ...styles.dateInput }}
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>סכום (₪)</label>
        <input
          style={{ ...styles.input, ...styles.amountInput }}
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0"
        />
      </div>

      <ChipRow label="סוג" options={TRANSACTION_TYPES} value={type} onChange={setType} />

      {type !== 'העברה לארנק' && (
        <>
          <ChipRow label="קטגוריה" options={CATEGORIES} value={category} onChange={setCategory} />
          <ChipRow label="תקציב" options={BUDGET_TYPES} value={budget} onChange={setBudget} />
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

      <button onClick={save} disabled={saving} style={styles.saveBtn}>
        {saving ? 'שומר...' : 'שמור'}
      </button>
    </div>
  )
}

const styles = {
  container: {
    padding: '16px',
    paddingBottom: '80px',
    direction: 'rtl',
    maxWidth: '480px',
    margin: '0 auto',
  },
  title: {
    marginBottom: '18px',
    fontSize: '28px',
    lineHeight: 1.2,
  },
  field: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    minHeight: '64px',
    padding: '0 18px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    fontSize: '17px',
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
  dateInputWrap: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    borderRadius: '14px',
  },
  dateInput: {
    minWidth: 0,
    maxWidth: '100%',
    direction: 'rtl',
    textAlign: 'center',
    letterSpacing: '0.2px',
  },
  amountInput: {
    textAlign: 'center',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  chip: {
    minHeight: '46px',
    padding: '0 18px',
    borderRadius: '24px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '15px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    minHeight: '46px',
    padding: '0 18px',
    borderRadius: '24px',
    border: '1px solid var(--primary)',
    background: 'var(--primary)',
    color: 'var(--primary-text)',
    cursor: 'pointer',
    fontSize: '15px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingInfo: {
    padding: '14px 16px',
    marginBottom: '14px',
    borderRadius: '12px',
    background: 'var(--surface-soft)',
    fontSize: '15px',
    textAlign: 'center',
  },
  saveBtn: {
    width: '100%',
    minHeight: '56px',
    padding: '14px',
    background: 'var(--button)',
    color: 'var(--button-text)',
    border: 'none',
    borderRadius: '12px',
    fontSize: '17px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '8px',
  },
}

