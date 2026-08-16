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
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round">
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

  const tabs = [
    { path: '/transactions', label: 'תנועות', icon: <ListIcon /> },
    { path: '/add', label: 'הוסף', icon: <PlusIcon /> },
    { path: '/summary', label: 'סיכום', icon: <ChartIcon /> },
  ]

  return (
    <nav style={styles.nav} aria-label="תפריט ניווט תחתון">
      <div style={styles.topShine} />
      {tabs.map(tab => {
        const active = location.pathname === tab.path
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
            style={active ? styles.tabActive : styles.tab}
            aria-current={active ? 'page' : undefined}
          >
            <span style={styles.icon}>{tab.icon}</span>
            <span style={styles.label}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

const tabBase = {
  position: 'relative',
  border: 0,
  borderRadius: '18px',
  background: 'transparent',
  padding: '10px 8px 8px',
  display: 'grid',
  justifyItems: 'center',
  gap: '4px',
  cursor: 'pointer',
  fontWeight: 750,
  fontSize: '12px',
  transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
}

const styles = {
  nav: {
    position: 'fixed',
    zIndex: 20,
    right: '50%',
    bottom: 'max(12px, env(safe-area-inset-bottom))',
    transform: 'translateX(50%)',
    width: 'min(430px, calc(100% - 24px))',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px',
    padding: '8px',
    border: '1px solid var(--border)',
    borderRadius: '26px',
    background: 'var(--nav-bg)',
    boxShadow: 'var(--nav-shadow)',
    backdropFilter: 'blur(30px) saturate(185%)',
    WebkitBackdropFilter: 'blur(30px) saturate(185%)',
    overflow: 'hidden',
  },
  topShine: {
    position: 'absolute',
    top: 0,
    left: '9%',
    right: '9%',
    height: '1px',
    background: 'linear-gradient(90deg, transparent, var(--glass-highlight), transparent)',
    pointerEvents: 'none',
  },
  tab: {
    ...tabBase,
    color: 'var(--text-muted)',
  },
  tabActive: {
    ...tabBase,
    color: 'var(--nav-active-text)',
    background: 'var(--nav-active-bg)',
    boxShadow: 'inset 0 1px 0 var(--glass-highlight), 0 8px 24px color-mix(in srgb, var(--primary) 16%, transparent)',
    transform: 'translateY(-1px)',
  },
  icon: {
    display: 'inline-grid',
    placeItems: 'center',
    minHeight: '21px',
  },
  label: {
    lineHeight: 1.1,
  },
}
