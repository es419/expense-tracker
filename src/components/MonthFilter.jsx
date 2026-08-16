import { useMemo } from 'react'
import { useSelectedMonth } from '../context/MonthContext'

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export default function MonthFilter() {
  const {
    selectedMonthKey,
    setSelectedMonthKey,
    availableMonthKeys,
  } = useSelectedMonth()

  const [selectedYear, selectedMonth] = selectedMonthKey.split('-')
  const years = useMemo(
    () => [...new Set(availableMonthKeys.map(key => key.slice(0, 4)))].sort((a, b) => Number(b) - Number(a)),
    [availableMonthKeys]
  )

  const monthsForYear = useMemo(
    () => availableMonthKeys
      .filter(key => key.startsWith(`${selectedYear}-`))
      .sort((a, b) => b.localeCompare(a)),
    [availableMonthKeys, selectedYear]
  )

  function changeYear(year) {
    const keys = availableMonthKeys
      .filter(key => key.startsWith(`${year}-`))
      .sort((a, b) => b.localeCompare(a))
    if (keys[0]) setSelectedMonthKey(keys[0])
  }

  function changeMonth(month) {
    const key = `${selectedYear}-${month}`
    if (availableMonthKeys.includes(key)) setSelectedMonthKey(key)
  }

  return (
    <div style={styles.shell} aria-label="בחירת חודש ושנה">
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

      <select
        style={{ ...styles.select, ...styles.monthSelect }}
        value={selectedMonth}
        onChange={event => changeMonth(event.target.value)}
        aria-label="חודש"
      >
        {monthsForYear.map(key => {
          const month = key.slice(5, 7)
          return (
            <option key={key} value={month}>
              {MONTHS[Number(month) - 1]}
            </option>
          )
        })}
      </select>
    </div>
  )
}

const styles = {
  shell: {
    position: 'fixed',
    zIndex: 40,
    top: 'max(10px, env(safe-area-inset-top))',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(300px, calc(100% - 126px))',
    minHeight: '44px',
    display: 'grid',
    gridTemplateColumns: '0.88fr 1.12fr',
    gap: '6px',
    padding: '5px',
    boxSizing: 'border-box',
    border: '1px solid var(--border)',
    borderRadius: '15px',
    background: 'var(--surface)',
    boxShadow: 'var(--shadow)',
  },
  select: {
    width: '100%',
    minWidth: 0,
    minHeight: '34px',
    border: 0,
    borderRadius: '10px',
    padding: '0 9px',
    background: 'var(--surface-soft)',
    color: 'var(--text)',
    fontSize: '13px',
    fontWeight: 700,
    outline: 'none',
    direction: 'rtl',
  },
  monthSelect: {
    textAlign: 'right',
  },
}
