import { useNavigate, useLocation } from 'react-router-dom'

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 6h11" />
      <path d="M8 12h11" />
      <path d="M8 18h11" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 15l3-4 3 2 4-6" />
    </svg>
  )
}

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const transactionsActive = location.pathname === '/transactions'
  const addActive = location.pathname === '/add'
  const summaryActive = location.pathname === '/summary'

  return (
    <nav style={styles.shell} aria-label="תפריט ניווט תחתון">
      <div style={styles.glassBar}>
        <div style={styles.topReflection} />
        <div style={styles.bottomGlow} />

        <button
          type="button"
          onClick={() => navigate('/transactions')}
          style={transactionsActive ? styles.sideTabActive : styles.sideTab}
          aria-current={transactionsActive ? 'page' : undefined}
        >
          <span style={styles.sideIcon}><ListIcon /></span>
          <span style={styles.sideLabel}>תנועות</span>
        </button>

        <div style={styles.centerSlot} aria-hidden="true" />

        <button
          type="button"
          onClick={() => navigate('/summary')}
          style={summaryActive ? styles.sideTabActive : styles.sideTab}
          aria-current={summaryActive ? 'page' : undefined}
        >
          <span style={styles.sideIcon}><ChartIcon /></span>
          <span style={styles.sideLabel}>סיכום</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate('/add')}
        style={addActive ? styles.addButtonActive : styles.addButton}
        aria-current={addActive ? 'page' : undefined}
        aria-label="הוסף תנועה"
      >
        <span style={styles.addReflection} />
        <span style={styles.addIcon}><PlusIcon /></span>
        <span style={styles.addLabel}>הוסף</span>
      </button>
    </nav>
  )
}

const glassTabBase = {
  border: 0,
  minHeight: '52px',
  borderRadius: '18px',
  padding: '7px 12px 6px',
  display: 'grid',
  justifyItems: 'center',
  alignContent: 'center',
  gap: '3px',
  cursor: 'pointer',
  transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
}

const styles = {
  shell: {
    position: 'fixed',
    zIndex: 30,
    right: '50%',
    bottom: 'max(16px, env(safe-area-inset-bottom))',
    transform: 'translateX(50%)',
    width: 'min(388px, calc(100% - 28px))',
    height: '72px',
    pointerEvents: 'none',
  },
  glassBar: {
    position: 'absolute',
    inset: '8px 0 0',
    display: 'grid',
    gridTemplateColumns: '1fr 82px 1fr',
    alignItems: 'center',
    gap: '4px',
    padding: '7px',
    border: '1px solid var(--border)',
    borderRadius: '29px',
    background: 'color-mix(in srgb, var(--nav-bg) 90%, transparent)',
    boxShadow: '0 22px 58px rgba(15, 32, 54, 0.25), inset 0 1px 0 var(--glass-highlight)',
    backdropFilter: 'blur(36px) saturate(195%)',
    WebkitBackdropFilter: 'blur(36px) saturate(195%)',
    overflow: 'hidden',
    pointerEvents: 'auto',
  },
  topReflection: {
    position: 'absolute',
    top: 0,
    left: '10%',
    right: '10%',
    height: '1px',
    background: 'linear-gradient(90deg, transparent, var(--glass-highlight), transparent)',
    opacity: 0.95,
    pointerEvents: 'none',
  },
  bottomGlow: {
    position: 'absolute',
    left: '30%',
    right: '30%',
    bottom: '-18px',
    height: '30px',
    borderRadius: '50%',
    background: 'color-mix(in srgb, var(--primary) 18%, transparent)',
    filter: 'blur(18px)',
    pointerEvents: 'none',
  },
  sideTab: {
    ...glassTabBase,
    color: 'var(--text-muted)',
    background: 'transparent',
    boxShadow: 'none',
  },
  sideTabActive: {
    ...glassTabBase,
    color: 'var(--nav-active-text)',
    background: 'color-mix(in srgb, var(--nav-active-bg) 86%, transparent)',
    boxShadow: 'inset 0 1px 0 var(--glass-highlight), 0 8px 20px color-mix(in srgb, var(--primary) 12%, transparent)',
    transform: 'translateY(-1px)',
  },
  sideIcon: {
    display: 'grid',
    placeItems: 'center',
    height: '21px',
  },
  sideLabel: {
    fontSize: '11px',
    lineHeight: 1.05,
    fontWeight: 760,
  },
  centerSlot: {
    width: '82px',
    height: '48px',
  },
  addButton: {
    position: 'absolute',
    zIndex: 2,
    top: '-2px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '68px',
    height: '68px',
    border: '1px solid var(--border)',
    borderRadius: '24px',
    background: 'color-mix(in srgb, var(--surface-strong) 82%, transparent)',
    color: 'var(--text)',
    boxShadow: '0 18px 42px rgba(13, 29, 51, 0.25), inset 0 1px 0 var(--glass-highlight)',
    backdropFilter: 'blur(30px) saturate(190%)',
    WebkitBackdropFilter: 'blur(30px) saturate(190%)',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '1px',
    cursor: 'pointer',
    overflow: 'hidden',
    pointerEvents: 'auto',
    transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease, color 160ms ease',
  },
  addButtonActive: {
    position: 'absolute',
    zIndex: 2,
    top: '-4px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '70px',
    height: '70px',
    border: '1px solid color-mix(in srgb, var(--primary) 72%, white 28%)',
    borderRadius: '25px',
    background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary) 88%, white 12%), var(--primary))',
    color: '#ffffff',
    boxShadow: '0 20px 46px color-mix(in srgb, var(--primary) 34%, transparent), inset 0 1px 0 rgba(255,255,255,0.48)',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '1px',
    cursor: 'pointer',
    overflow: 'hidden',
    pointerEvents: 'auto',
    transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease, color 160ms ease',
  },
  addReflection: {
    position: 'absolute',
    top: '2px',
    left: '16%',
    right: '16%',
    height: '14px',
    borderRadius: '50%',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)',
    filter: 'blur(3px)',
    pointerEvents: 'none',
  },
  addIcon: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    placeItems: 'center',
    height: '26px',
  },
  addLabel: {
    position: 'relative',
    zIndex: 1,
    fontSize: '10px',
    lineHeight: 1,
    fontWeight: 820,
  },
}
