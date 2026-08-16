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
      const timer = window.setTimeout(() => setShowThemeOptions(false), 300)
      return () => window.clearTimeout(timer)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
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

      <div
        aria-hidden={!open}
        style={{
          ...styles.overlay,
          ...(open ? styles.overlayOpen : styles.overlayClosed),
        }}
        onClick={() => open && setOpen(false)}
      >
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="תפריט הגדרות"
          style={{
            ...styles.drawer,
            ...(open ? styles.drawerOpen : styles.drawerClosed),
          }}
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
              <span
                aria-hidden="true"
                style={{
                  ...styles.chevron,
                  transform: showThemeOptions ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ⌄
              </span>
            </button>

            <div
              style={{
                ...styles.optionsWrap,
                ...(showThemeOptions ? styles.optionsWrapOpen : styles.optionsWrapClosed),
              }}
            >
              <div style={styles.optionsInner}>
                {OPTIONS.map(option => {
                  const selected = option.value === value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      style={selected ? styles.optionSelected : styles.option}
                      onClick={() => onChange(option.value)}
                      tabIndex={showThemeOptions && open ? 0 : -1}
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
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

const iosEase = 'cubic-bezier(.2, .82, .22, 1)'

const styles = {
  menuButton: {
    position: 'fixed',
    zIndex: 1000,
    top: 'max(12px, env(safe-area-inset-top))',
    right: 'max(10px, calc((100vw - 480px) / 2 - 52px))',
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
    transition: `opacity 220ms ${iosEase}`,
  },
  overlayOpen: {
    opacity: 1,
    pointerEvents: 'auto',
  },
  overlayClosed: {
    opacity: 0,
    pointerEvents: 'none',
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
    transition: `transform 350ms ${iosEase}, opacity 220ms ${iosEase}`,
    willChange: 'transform, opacity',
  },
  drawerOpen: {
    transform: 'translate3d(0, 0, 0)',
    opacity: 1,
  },
  drawerClosed: {
    transform: 'translate3d(102%, 0, 0)',
    opacity: 0.96,
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
    transition: `transform 220ms ${iosEase}`,
    flexShrink: 0,
  },
  optionsWrap: {
    display: 'grid',
    gridTemplateRows: '0fr',
    opacity: 0,
    overflow: 'hidden',
    transition: `grid-template-rows 280ms ${iosEase}, opacity 180ms ${iosEase}`,
  },
  optionsWrapOpen: {
    gridTemplateRows: '1fr',
    opacity: 1,
    pointerEvents: 'auto',
  },
  optionsWrapClosed: {
    gridTemplateRows: '0fr',
    opacity: 0,
    pointerEvents: 'none',
  },
  optionsInner: {
    minHeight: 0,
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
    background: 'var(--nav-active-bg)',
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
