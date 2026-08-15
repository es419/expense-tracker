import { useEffect, useState } from 'react'

const OPTIONS = [
  { value: 'system', label: 'מערכת', icon: '◐', description: 'לפי הגדרת המכשיר' },
  { value: 'light', label: 'בהיר', icon: '☀️', description: 'מצב בהיר תמיד' },
  { value: 'dark', label: 'כהה', icon: '🌙', description: 'מצב כהה תמיד' },
]

export default function ThemeMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <button
        type="button"
        aria-label="פתח תפריט תצוגה"
        title="תצוגה"
        style={styles.menuButton}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true" style={styles.menuIcon}>
          <span style={styles.menuBar} />
          <span style={styles.menuBar} />
          <span style={styles.menuBar} />
        </span>
      </button>

      {open && (
        <div style={styles.overlay} onClick={() => setOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="הגדרות תצוגה"
            style={styles.drawer}
            onClick={event => event.stopPropagation()}
          >
            <div style={styles.header}>
              <button
                type="button"
                aria-label="סגור תפריט"
                style={styles.closeButton}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
              <div>
                <div style={styles.title}>תצוגה</div>
                <div style={styles.subtitle}>בחר מצב מראה</div>
              </div>
            </div>

            <div style={styles.options}>
              {OPTIONS.map(option => {
                const selected = value === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    style={selected ? styles.optionSelected : styles.option}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                  >
                    <span aria-hidden="true" style={styles.optionIcon}>{option.icon}</span>
                    <span style={styles.optionText}>
                      <strong style={styles.optionLabel}>{option.label}</strong>
                      <span style={styles.optionDescription}>{option.description}</span>
                    </span>
                    <span aria-hidden="true" style={styles.check}>{selected ? '✓' : ''}</span>
                  </button>
                )
              })}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

const styles = {
  menuButton: {
    position: 'fixed',
    zIndex: 1000,
    top: 'max(12px, env(safe-area-inset-top))',
    left: 'max(12px, calc((100vw - 480px) / 2 + 12px))',
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: 'var(--theme-toggle-bg)',
    color: 'var(--text)',
    boxShadow: 'var(--shadow)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },
  menuIcon: {
    width: '18px',
    height: '14px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  menuBar: {
    width: '100%',
    height: '2px',
    borderRadius: '999px',
    background: 'currentColor',
  },
  overlay: {
    position: 'fixed',
    zIndex: 2000,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.38)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 'min(82vw, 320px)',
    padding: 'max(18px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom))',
    background: 'var(--surface)',
    color: 'var(--text)',
    borderRight: '1px solid var(--border)',
    boxShadow: '18px 0 45px rgba(0, 0, 0, 0.24)',
    direction: 'rtl',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '22px',
  },
  closeButton: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--surface-soft)',
    color: 'var(--text)',
    fontSize: '24px',
    lineHeight: 1,
    cursor: 'pointer',
  },
  title: {
    fontSize: '20px',
    fontWeight: 800,
  },
  subtitle: {
    marginTop: '3px',
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
  options: {
    display: 'grid',
    gap: '10px',
  },
  option: {
    width: '100%',
    minHeight: '64px',
    display: 'grid',
    gridTemplateColumns: '32px 1fr 24px',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: 'var(--surface-soft)',
    color: 'var(--text)',
    textAlign: 'right',
    cursor: 'pointer',
  },
  optionSelected: {
    width: '100%',
    minHeight: '64px',
    display: 'grid',
    gridTemplateColumns: '32px 1fr 24px',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '14px',
    border: '1px solid var(--primary)',
    background: 'color-mix(in srgb, var(--primary) 12%, var(--surface))',
    color: 'var(--text)',
    textAlign: 'right',
    cursor: 'pointer',
  },
  optionIcon: {
    fontSize: '19px',
    textAlign: 'center',
  },
  optionText: {
    display: 'grid',
    gap: '3px',
  },
  optionLabel: {
    fontSize: '15px',
  },
  optionDescription: {
    color: 'var(--text-muted)',
    fontSize: '12px',
  },
  check: {
    color: 'var(--primary)',
    fontSize: '18px',
    fontWeight: 800,
    textAlign: 'center',
  },
}
