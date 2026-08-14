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
    left: 0,
    right: 0,
    display: 'flex',
    background: 'white',
    borderTop: '1px solid #eee',
    padding: '8px 0',
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
    color: '#999',
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
    color: '#333',
    fontWeight: 'bold',
    padding: '4px',
  },
  icon: { fontSize: '20px' },
  label: { fontSize: '11px' },
}