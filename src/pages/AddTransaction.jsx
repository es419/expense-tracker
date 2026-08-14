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
      const chargeDate = type === 'הוצאה' && paymentMethod === 'אשראי'
        ? automaticChargeDate
        : date

      await appendTransaction({
        date,
        type,
        amount: Number(amount),
        category,
        budget,
        paymentMethod,
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
        <input style={styles.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>סכום (₪)</label>
        <input style={styles.input} type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
      </div>

      <ChipRow label="סוג" options={TRANSACTION_TYPES} value={type} onChange={setType} />
      <ChipRow label="קטגוריה" options={CATEGORIES} value={category} onChange={setCategory} />
      <ChipRow label="תקציב" options={BUDGET_TYPES} value={budget} onChange={setBudget} />
      <ChipRow label="אמצעי תשלום" options={PAYMENT_METHODS} value={paymentMethod} onChange={setPaymentMethod} />

      {type === 'הוצאה' && (
        <div style={styles.billingInfo}>
          {paymentMethod === 'אשראי'
            ? `יתווסף לאשראי ויירד מהעו״ש ב־${formatHebrewDate(automaticChargeDate)}`
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
  container: { padding: '16px', paddingBottom: '80px', direction: 'rtl' },
  title: { marginBottom: '16px' },
  field: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', color: '#777', marginBottom: '6px' },
  input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #555', fontSize: '16px', boxSizing: 'border-box', background: 'transparent' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  chip: { padding: '6px 14px', borderRadius: '20px', border: '1px solid #555', background: 'transparent', cursor: 'pointer', fontSize: '14px' },
  chipSelected: { padding: '6px 14px', borderRadius: '20px', border: '1px solid #888', background: '#333', color: 'white', cursor: 'pointer', fontSize: '14px' },
  billingInfo: { padding: '12px', marginBottom: '12px', borderRadius: '8px', background: 'rgba(127,127,127,0.12)', fontSize: '14px' },
  saveBtn: { width: '100%', padding: '14px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', marginTop: '8px' },
}
