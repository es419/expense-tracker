import { useNavigate, useLocation } from 'react-router-dom'

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { path: '/transactions', label: 'תנועות', icon: '📋' },
    { path: '/add', label: 'הוסף', icon: '➕' },
    { path: '/summary', label: 'סיכום', icon: '📊' },
  ]

  return (
    <div style={styles.nav}>
      {tabs.map(tab => (
        <button
          key={tab.path}
          onClick={() => navigate(tab.path)}
          style={location.pathname === tab.path ? styles.tabActive : styles.tab}
        >
          <div style={styles.icon}>{tab.icon}</div>
          <div style={styles.label}>{tab.label}</div>
        </button>
      ))}
    </div>
  )
}

const styles = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    right: 'auto',
    width: 'min(100%, 480px)',
    transform: 'translateX(-50%)',
    display: 'flex',
    background: 'var(--nav-bg)',
    borderTop: '1px solid var(--border)',
    padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: '4px',
  },
  tabActive: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text)',
    fontWeight: 'bold',
    padding: '4px',
  },
  icon: { fontSize: '20px' },
  label: { fontSize: '11px' },
}