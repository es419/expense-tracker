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
      <div style={styles.fields}>
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
      </div>
    </section>
  )
}

const styles = {
  section: {
    width: '100%',
    margin: '8px auto 0',
    padding: '0',
    direction: 'rtl',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  fields: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    alignItems: 'end',
    gap: '12px',
  },
  field: {
    display: 'grid',
    gap: '6px',
    minWidth: 0,
  },
  label: {
    display: 'block',
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 700,
    lineHeight: 1.2,
    textAlign: 'right',
    paddingInline: '2px',
  },
  select: {
    width: '100%',
    minWidth: 0,
    height: '46px',
    minHeight: '46px',
    padding: '0 12px',
    border: '1px solid var(--border)',
    borderRadius: '15px',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: '17px',
    fontWeight: 700,
    lineHeight: 1.2,
    outline: 'none',
    direction: 'rtl',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
}
