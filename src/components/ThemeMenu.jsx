import { useEffect, useState } from 'react'

const OPTIONS = [
  { value: 'system', label: 'מערכת', description: 'לפי הגדרת המכשיר' },
  { value: 'light', label: 'בהיר', description: 'מצב בהיר תמיד' },
  { value: 'dark', label: 'כהה', description: 'מצב כהה תמיד' },
]

export default function ThemeMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [showThemeOptions, setShowThemeOptions] = useState(false)

  useEffect(() => {
    if (!open) {
      setShowThemeOptions(false)
      return undefined
    }

    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const currentLabel = OPTIONS.find(option => option.value === value)?.label || 'מערכת'

  return (
    <>
      <button
        type="button"
        aria-label="פתח תפריט"
        title="תפריט"
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
            aria-label="תפריט הגדרות"
            style={styles.drawer}
            onClick={event => event.stopPropagation()}
          >
            <div style={styles.header}>
              <div style={styles.headerText}>
                <div style={styles.title}>הגדרות</div>
                <div style={styles.subtitle}>התאמה אישית של המראה</div>
              </div>
              <button
                type="button"
                aria-label="סגור תפריט"
                style={styles.closeButton}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.section}>
              <button
                type="button"
                style={styles.sectionButton}
                onClick={() => setShowThemeOptions(current => !current)}
                aria-expanded={showThemeOptions}
              >
                <span style={styles.sectionMain}>
                  <strong style={styles.sectionTitle}>הגדרת תצוגה</strong>
                  <span style={styles.sectionValue}>{currentLabel}</span>
                </span>
                <span aria-hidden="true" style={{ ...styles.chevron, transform: showThemeOptions ? 'rotate(180deg)' : 'rotate(0deg)' }}>⌄</span>
              </button>

              {showThemeOptions && (
                <div style={styles.optionsWrap}>
                  {OPTIONS.map(option => {
                    const selected = option.value === value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        style={selected ? styles.optionSelected : styles.option}
                        onClick={() => onChange(option.value)}
                      >
                        <span style={styles.optionText}>
                          <strong style={styles.optionLabel}>{option.label}</strong>
                          <span style={styles.optionDescription}>{option.description}</span>
                        </span>
                        <span aria-hidden="true" style={styles.check}>{selected ? '✓' : ''}</span>
                      </button>
                    )
                  })}
                </div>
              )}
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
    right: 'max(12px, calc((100vw - 480px) / 2 + 12px))',
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
    right: 0,
    bottom: 0,
    width: 'min(82vw, 320px)',
    padding: 'max(18px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom))',
    background: 'var(--surface)',
    color: 'var(--text)',
    borderLeft: '1px solid var(--border)',
    boxShadow: '-18px 0 45px rgba(0, 0, 0, 0.24)',
    direction: 'rtl',
    textAlign: 'right',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '22px',
  },
  headerText: {
    display: 'grid',
    gap: '4px',
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
    flexShrink: 0,
  },
  title: {
    fontSize: '20px',
    fontWeight: 800,
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
  section: {
    display: 'grid',
    gap: '10px',
  },
  sectionButton: {
    width: '100%',
    minHeight: '62px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: 'var(--surface-soft)',
    color: 'var(--text)',
    textAlign: 'right',
    cursor: 'pointer',
  },
  sectionMain: {
    display: 'grid',
    gap: '4px',
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 700,
  },
  sectionValue: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  chevron: {
    fontSize: '16px',
    color: 'var(--text-muted)',
    transition: 'transform 0.18s ease',
    flexShrink: 0,
  },
  optionsWrap: {
    display: 'grid',
    gap: '8px',
    paddingTop: '2px',
  },
  option: {
    width: '100%',
    minHeight: '58px',
    display: 'grid',
    gridTemplateColumns: '1fr 24px',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    textAlign: 'right',
    cursor: 'pointer',
  },
  optionSelected: {
    width: '100%',
    minHeight: '58px',
    display: 'grid',
    gridTemplateColumns: '1fr 24px',
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
  optionText: {
    display: 'grid',
    gap: '3px',
    textAlign: 'right',
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
