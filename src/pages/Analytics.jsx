import { useEffect, useMemo, useState } from 'react'
import { fetchTransactions, getCachedTransactions } from '../services/sheetsApi'

import { useSelectedMonth } from '../context/MonthContext'

export default function Analytics() {
  const { selectedMonthKey } = useSelectedMonth()
  const cached = getCachedTransactions(selectedMonthKey)
  const [transactions, setTransactions] = useState(() => cached ?? [])
  const [loading, setLoading] = useState(() => !cached)

  useEffect(() => {
    const monthCached = getCachedTransactions(selectedMonthKey)
    if (monthCached) {
      setTransactions(monthCached)
      setLoading(false)
    }

    fetchTransactions(selectedMonthKey)
      .then(data => setTransactions(data))
      .finally(() => setLoading(false))
  }, [selectedMonthKey])

  const expenses = useMemo(
    () => transactions.filter(item => item.type === 'הוצאה'),
    [transactions]
  )

  const categoryTotals = useMemo(
    () => aggregateBy(expenses, item => item.category || 'ללא קטגוריה'),
    [expenses]
  )

  const paymentTotals = useMemo(
    () => aggregateBy(expenses, item => item.paymentMethod || 'אחר'),
    [expenses]
  )

  const totalExpenses = expenses.reduce((sum, item) => sum + Math.abs(Number(item.amount) || 0), 0)

  return (
    <div style={styles.container}>
      {loading ? (
        <div style={styles.center} />
      ) : (
        <>
          <section style={styles.totalCard}>
            <div style={styles.totalLabel}>סה״כ הוצאות בחודש</div>
            <div style={styles.totalValue}>{totalExpenses.toFixed(0)} ₪</div>
          </section>

          <section style={styles.section}>
            <div style={styles.sectionTitle}>לפי קטגוריות</div>
            <div style={styles.card}>
              <CategoryBars data={categoryTotals} />
            </div>
          </section>

          <section style={styles.section}>
            <div style={styles.sectionTitle}>התפלגות קטגוריות</div>
            <div style={styles.card}>
              <CategoryDonut data={categoryTotals} />
            </div>
          </section>

          <section style={styles.section}>
            <div style={styles.sectionTitle}>לפי אמצעי תשלום</div>
            <div style={styles.card}>
              <PaymentDonut data={paymentTotals} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function aggregateBy(items, getKey) {
  const totals = new Map()

  for (const item of items) {
    const amount = Math.abs(Number(item.amount) || 0)
    if (!amount) continue
    const key = getKey(item)
    totals.set(key, (totals.get(key) || 0) + amount)
  }

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

function CategoryBars({ data }) {
  if (!data.length) {
    return <div style={styles.empty}>אין הוצאות בחודש הזה</div>
  }

  const max = Math.max(...data.map(item => item.value), 1)

  return (
    <div style={styles.categoryList}>
      {data.map(item => (
        <div key={item.label} style={styles.categoryItem}>
          <div style={styles.categoryLine}>
            <span style={styles.categoryName}>{item.label}</span>
            <strong style={styles.categoryAmount}>{item.value.toFixed(0)} ₪</strong>
          </div>
          <div style={styles.track}>
            <div
              style={{
                ...styles.fill,
                width: `${Math.max(4, (item.value / max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}


const CATEGORY_COLORS = [
  '#5b7cfa',
  '#2ea56f',
  '#d88b2a',
  '#b967d9',
  '#e35d6a',
  '#3aa6b9',
  '#8b7cf6',
  '#9a7b4f',
  '#6f8f72',
  '#8993a4',
]

function CategoryDonut({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (!total) {
    return <div style={styles.empty}>אין הוצאות בחודש הזה</div>
  }

  const normalized = data.map((item, index) => ({
    ...item,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }))

  const circumference = 2 * Math.PI * 42
  let offset = 0

  return (
    <div style={styles.paymentLayout}>
      <div style={styles.donutWrap}>
        <svg viewBox="0 0 100 100" width="132" height="132" aria-label="התפלגות הוצאות לפי קטגוריה">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--surface-strong)"
            strokeWidth="12"
          />
          {normalized.map(item => {
            const length = (item.value / total) * circumference
            const currentOffset = offset
            offset += length

            return (
              <circle
                key={item.label}
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={item.color}
                strokeWidth="12"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-currentOffset}
                transform="rotate(-90 50 50)"
              />
            )
          })}
        </svg>

        <div style={styles.donutCenter}>
          <strong style={styles.donutTotal}>{total.toFixed(0)} ₪</strong>
          <span style={styles.donutCaption}>קטגוריות</span>
        </div>
      </div>

      <div style={styles.legend}>
        {normalized.slice(0, 8).map(item => (
          <div key={item.label} style={styles.legendRow}>
            <span style={{ ...styles.dot, background: item.color }} />
            <span style={styles.legendName}>{item.label}</span>
            <strong style={styles.legendPercent}>
              {Math.round((item.value / total) * 100)}%
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

const PAYMENT_COLORS = {
  'אשראי': '#5b7cfa',
  'מזומן': '#2ea56f',
  'עו״ש': '#d88b2a',
  'אחר': '#8993a4',
}

function PaymentDonut({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (!total) {
    return <div style={styles.empty}>אין הוצאות בחודש הזה</div>
  }

  const normalized = data.map(item => ({
    ...item,
    color: PAYMENT_COLORS[item.label] || PAYMENT_COLORS['אחר'],
  }))

  const circumference = 2 * Math.PI * 42
  let offset = 0

  return (
    <div style={styles.paymentLayout}>
      <div style={styles.donutWrap}>
        <svg viewBox="0 0 100 100" width="132" height="132" aria-label="התפלגות לפי אמצעי תשלום">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--surface-strong)"
            strokeWidth="12"
          />
          {normalized.map(item => {
            const length = (item.value / total) * circumference
            const currentOffset = offset
            offset += length

            return (
              <circle
                key={item.label}
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={item.color}
                strokeWidth="12"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-currentOffset}
                transform="rotate(-90 50 50)"
              />
            )
          })}
        </svg>

        <div style={styles.donutCenter}>
          <strong style={styles.donutTotal}>{total.toFixed(0)} ₪</strong>
          <span style={styles.donutCaption}>הוצאות</span>
        </div>
      </div>

      <div style={styles.legend}>
        {normalized.map(item => (
          <div key={item.label} style={styles.legendRow}>
            <span style={{ ...styles.dot, background: item.color }} />
            <span style={styles.legendName}>{item.label}</span>
            <strong style={styles.legendPercent}>
              {Math.round((item.value / total) * 100)}%
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    padding: '14px 16px 100px',
    direction: 'rtl',
    maxWidth: '480px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '10px',
    paddingLeft: '54px',
    paddingRight: '54px',
    boxSizing: 'border-box',
    width: '100%',
    textAlign: 'center',
  },
  title: {
    margin: 0,
    fontSize: '22px',
  },
  totalCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '14px 16px',
    boxShadow: 'var(--shadow)',
  },
  totalLabel: {
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 650,
  },
  totalValue: {
    marginTop: '3px',
    fontSize: '29px',
    lineHeight: 1.1,
    fontWeight: 820,
  },
  section: {
    marginTop: '14px',
  },
  sectionTitle: {
    marginBottom: '6px',
    fontSize: '15px',
    fontWeight: 800,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '12px',
  },
  empty: {
    padding: '20px 0',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '12px',
  },
  categoryList: {
    display: 'grid',
    gap: '10px',
  },
  categoryItem: {
    display: 'grid',
    gap: '6px',
  },
  categoryLine: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '10px',
  },
  categoryName: {
    minWidth: 0,
    fontSize: '12px',
    fontWeight: 650,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  categoryAmount: {
    flexShrink: 0,
    fontSize: '12px',
    direction: 'ltr',
  },
  track: {
    height: '7px',
    overflow: 'hidden',
    borderRadius: '999px',
    background: 'var(--surface-strong)',
  },
  fill: {
    height: '100%',
    borderRadius: '999px',
    background: 'var(--primary)',
    transition: 'width 260ms cubic-bezier(.2,.8,.2,1)',
  },
  paymentLayout: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: '12px',
    alignItems: 'center',
  },
  donutWrap: {
    position: 'relative',
    width: '132px',
    height: '132px',
    display: 'grid',
    placeItems: 'center',
  },
  donutCenter: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeContent: 'center',
    justifyItems: 'center',
    pointerEvents: 'none',
  },
  donutTotal: {
    fontSize: '15px',
    direction: 'ltr',
  },
  donutCaption: {
    marginTop: '2px',
    color: 'var(--text-muted)',
    fontSize: '10px',
  },
  legend: {
    display: 'grid',
    gap: '10px',
    minWidth: 0,
  },
  legendRow: {
    display: 'grid',
    gridTemplateColumns: '10px 1fr auto',
    gap: '7px',
    alignItems: 'center',
  },
  dot: {
    width: '9px',
    height: '9px',
    borderRadius: '50%',
  },
  legendName: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  legendPercent: {
    fontSize: '12px',
  },
  center: {
    height: '45vh',
  },
}
