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
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
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

const tabs = [
  { path: '/transactions', label: 'תנועות', icon: <ListIcon /> },
  { path: '/add', label: 'הוסף', icon: <PlusIcon /> },
  { path: '/summary', label: 'סיכום', icon: <ChartIcon /> },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const activeIndex = Math.max(0, tabs.findIndex(tab => tab.path === location.pathname))

  function navigateTo(path) {
    if (path === location.pathname) return

    if (document.startViewTransition) {
      document.startViewTransition(() => navigate(path))
      return
    }

    navigate(path)
  }

  return (
    <nav style={styles.nav} aria-label="תפריט ניווט תחתון">
      <div style={styles.topReflection} />
      <div
        aria-hidden="true"
        style={{
          ...styles.activePill,
          transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
        }}
      />

      {tabs.map((tab, index) => {
        const active = index === activeIndex
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigateTo(tab.path)}
            style={{
              ...styles.tab,
              ...(active ? styles.tabActive : null),
            }}
            aria-current={active ? 'page' : undefined}
          >
            <span
              style={{
                ...styles.icon,
                transform: active ? 'translateY(-1px) scale(1.04)' : 'translateY(0) scale(1)',
              }}
            >
              {tab.icon}
            </span>
            <span style={styles.label}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

const iosEase = 'cubic-bezier(0.16, 1, 0.3, 1)'

const styles = {
  nav: {
    position: 'fixed',
    zIndex: 30,
    right: '50%',
    bottom: 'max(14px, env(safe-area-inset-bottom))',
    transform: 'translateX(50%)',
    width: 'min(410px, calc(100% - 28px))',
    minHeight: '70px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    alignItems: 'stretch',
    padding: '8px',
    border: '1px solid var(--border)',
    borderRadius: '26px',
    background: 'linear-gradient(180deg, color-mix(in srgb, var(--nav-bg) 94%, white 3%), color-mix(in srgb, var(--nav-bg) 88%, transparent))',
    boxShadow: 'var(--nav-shadow)',
    backdropFilter: 'blur(38px) saturate(205%)',
    WebkitBackdropFilter: 'blur(38px) saturate(205%)',
    overflow: 'hidden',
  },
  topReflection: {
    position: 'absolute',
    zIndex: 0,
    top: 0,
    left: '10%',
    right: '10%',
    height: '1px',
    background: 'linear-gradient(90deg, transparent, var(--glass-highlight), transparent)',
    pointerEvents: 'none',
  },
  activePill: {
    position: 'absolute',
    zIndex: 0,
    top: '8px',
    bottom: '8px',
    left: '8px',
    width: 'calc((100% - 16px) / 3)',
    borderRadius: '19px',
    border: '1px solid color-mix(in srgb, var(--primary) 26%, var(--border))',
    background: 'linear-gradient(180deg, color-mix(in srgb, var(--nav-active-bg) 92%, white 5%), color-mix(in srgb, var(--nav-active-bg) 82%, transparent))',
    boxShadow: '0 10px 28px color-mix(in srgb, var(--primary) 17%, transparent), inset 0 1px 0 var(--glass-highlight), inset 0 -1px 0 color-mix(in srgb, var(--primary) 8%, transparent)',
    backdropFilter: 'blur(28px) saturate(190%)',
    WebkitBackdropFilter: 'blur(28px) saturate(190%)',
    transition: `transform 520ms ${iosEase}`,
    willChange: 'transform',
    pointerEvents: 'none',
  },
  tab: {
    position: 'relative',
    zIndex: 1,
    minWidth: 0,
    minHeight: '54px',
    border: 0,
    borderRadius: '19px',
    background: 'transparent',
    color: 'var(--text-muted)',
    padding: '8px 6px 7px',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'center',
    gap: '4px',
    cursor: 'pointer',
    fontWeight: 740,
    transition: `color 300ms ${iosEase}, transform 360ms ${iosEase}, opacity 260ms ${iosEase}`,
  },
  tabActive: {
    color: 'var(--nav-active-text)',
  },
  icon: {
    display: 'grid',
    placeItems: 'center',
    height: '22px',
    transition: `transform 360ms ${iosEase}`,
    willChange: 'transform',
  },
  label: {
    fontSize: '11px',
    lineHeight: 1.05,
    fontWeight: 780,
  },
}
