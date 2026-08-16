import { useMemo } from 'react'
import { useSelectedMonth } from '../context/MonthContext'

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

function padMonth(value) {
  return String(value).padStart(2, '0')
}

export default function MonthFilter() {
  const {
    selectedMonthKey,
    setSelectedMonthKey,
  } = useSelectedMonth()

  const [selectedYear, selectedMonth] = selectedMonthKey.split('-')
  const currentYear = new Date().getFullYear()

  const years = useMemo(() => {
    const start = currentYear - 5
    const end = currentYear + 5
    const values = []

    for (let year = end; year >= start; year -= 1) {
      values.push(String(year))
    }

    // Always preserve an already-selected year, even if it falls outside
    // the normal range.
    if (!values.includes(selectedYear)) {
      values.push(selectedYear)
      values.sort((a, b) => Number(b) - Number(a))
    }

    return values
  }, [currentYear, selectedYear])

  function changeYear(year) {
    setSelectedMonthKey(`${year}-${selectedMonth}`)
  }

  function changeMonth(month) {
    setSelectedMonthKey(`${selectedYear}-${month}`)
  }

  return (
    <section style={styles.section} aria-label="ניהול חודש">
      <h2 style={styles.heading}>ניהול חודש</h2>

      <div style={styles.fields}>
        <label style={styles.field}>
          <span style={styles.label}>שנה</span>
          <select
            style={styles.select}
            value={selectedYear}
            onChange={event => changeYear(event.target.value)}
            aria-label="שנה"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>חודש</span>
          <select
            style={styles.select}
            value={selectedMonth}
            onChange={event => changeMonth(event.target.value)}
            aria-label="חודש"
          >
            {MONTHS.map((monthName, index) => {
              const value = padMonth(index + 1)
              return (
                <option key={value} value={value}>
                  {monthName}
                </option>
              )
            })}
          </select>
        </label>
      </div>
    </section>
  )
}

const styles = {
  section: {
    width: 'min(480px, calc(100% - 32px))',
    margin: '10px auto 2px',
    padding: '0',
    direction: 'rtl',
    boxSizing: 'border-box',
  },
  heading: {
    margin: '0 0 14px',
    textAlign: 'center',
    color: 'var(--text)',
    fontSize: '22px',
    lineHeight: 1.2,
    fontWeight: 800,
  },
  fields: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  field: {
    display: 'grid',
    gap: '7px',
    minWidth: 0,
  },
  label: {
    paddingRight: '4px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 750,
  },
  select: {
    width: '100%',
    minWidth: 0,
    minHeight: '54px',
    padding: '0 14px',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '18px',
    fontWeight: 780,
    outline: 'none',
    direction: 'rtl',
    boxSizing: 'border-box',
  },
}
