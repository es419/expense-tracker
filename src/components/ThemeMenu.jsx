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
      const timer = window.setTimeout(() => setShowThemeOptions(false), 340)
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
          <div style={styles.drawerGlow} />

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

const glassBase = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  boxShadow: 'var(--shadow-soft)',
  backdropFilter: 'var(--glass-blur)',
  WebkitBackdropFilter: 'var(--glass-blur)',
}

const iosEase = 'cubic-bezier(0.22, 1, 0.36, 1)'

const styles = {
  menuButton: {
    position: 'fixed',
    zIndex: 1000,
    top: 'max(8px, env(safe-area-inset-top))',
    right: 'max(8px, calc((100vw - 480px) / 2 - 54px))',
    width: '46px',
    height: '46px',
    borderRadius: '16px',
    ...glassBase,
    background: 'var(--theme-toggle-bg)',
    color: 'var(--text)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  menuIcon: {
    width: '19px',
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
    background: 'rgba(3, 10, 20, 0.28)',
    transition: `opacity 280ms ${iosEase}, backdrop-filter 340ms ${iosEase}, -webkit-backdrop-filter 340ms ${iosEase}`,
    willChange: 'opacity, backdrop-filter',
  },
  overlayOpen: {
    opacity: 1,
    pointerEvents: 'auto',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  overlayClosed: {
    opacity: 0,
    pointerEvents: 'none',
    backdropFilter: 'blur(0px)',
    WebkitBackdropFilter: 'blur(0px)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 'min(84vw, 330px)',
    padding: 'max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))',
    background: 'color-mix(in srgb, var(--surface) 84%, transparent)',
    color: 'var(--text)',
    borderLeft: '1px solid var(--border)',
    boxShadow: '-28px 0 70px rgba(0, 0, 0, 0.24), inset 1px 0 0 var(--glass-highlight)',
    backdropFilter: 'blur(34px) saturate(185%)',
    WebkitBackdropFilter: 'blur(34px) saturate(185%)',
    direction: 'rtl',
    textAlign: 'right',
    overflow: 'hidden',
    transformOrigin: 'right center',
    transition: `transform 420ms ${iosEase}, opacity 260ms ${iosEase}`,
    willChange: 'transform, opacity',
  },
  drawerOpen: {
    transform: 'translate3d(0, 0, 0) scale(1)',
    opacity: 1,
  },
  drawerClosed: {
    transform: 'translate3d(104%, 0, 0) scale(0.985)',
    opacity: 0.72,
  },
  drawerGlow: {
    position: 'absolute',
    width: '220px',
    height: '220px',
    top: '-90px',
    right: '-80px',
    borderRadius: '50%',
    background: 'color-mix(in srgb, var(--primary) 26%, transparent)',
    filter: 'blur(28px)',
    pointerEvents: 'none',
  },
  header: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '24px',
  },
  headerText: {
    display: 'grid',
    gap: '4px',
  },
  closeButton: {
    width: '38px',
    height: '38px',
    borderRadius: '14px',
    ...glassBase,
    background: 'var(--surface-soft)',
    color: 'var(--text)',
    fontSize: '24px',
    lineHeight: 1,
    cursor: 'pointer',
    flexShrink: 0,
  },
  title: {
    fontSize: '22px',
    fontWeight: 850,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
  section: {
    position: 'relative',
    display: 'grid',
    gap: '10px',
  },
  sectionButton: {
    width: '100%',
    minHeight: '66px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '13px 15px',
    borderRadius: '18px',
    ...glassBase,
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
    fontWeight: 760,
  },
  sectionValue: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  chevron: {
    fontSize: '17px',
    color: 'var(--text-muted)',
    transition: `transform 320ms ${iosEase}`,
    flexShrink: 0,
  },
  optionsWrap: {
    display: 'grid',
    gridTemplateRows: '0fr',
    opacity: 0,
    transform: 'translateY(-6px)',
    overflow: 'hidden',
    transition: `grid-template-rows 340ms ${iosEase}, opacity 220ms ${iosEase}, transform 340ms ${iosEase}`,
  },
  optionsWrapOpen: {
    gridTemplateRows: '1fr',
    opacity: 1,
    transform: 'translateY(0)',
    pointerEvents: 'auto',
  },
  optionsWrapClosed: {
    gridTemplateRows: '0fr',
    opacity: 0,
    transform: 'translateY(-6px)',
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
    borderRadius: '17px',
    ...glassBase,
    background: 'var(--surface-soft)',
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
    borderRadius: '17px',
    border: '1px solid color-mix(in srgb, var(--primary) 62%, var(--border))',
    background: 'color-mix(in srgb, var(--primary) 18%, var(--surface))',
    color: 'var(--text)',
    textAlign: 'right',
    cursor: 'pointer',
    boxShadow: '0 12px 30px color-mix(in srgb, var(--primary) 14%, transparent), inset 0 1px 0 var(--glass-highlight)',
    backdropFilter: 'var(--glass-blur)',
    WebkitBackdropFilter: 'var(--glass-blur)',
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
    fontWeight: 850,
    textAlign: 'center',
  },
}
