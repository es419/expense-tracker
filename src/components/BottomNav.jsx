import { useNavigate, useLocation } from 'react-router-dom'

function ListIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h11"/><path d="M8 12h11"/><path d="M8 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></svg>
}
function PlusIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
}
function ChartIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 2 4-6"/></svg>
}
function AnalyticsIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V10"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19V8"/></svg>
}
function SavingsIcon() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14v12H5z"/><path d="M8 7V5h8v2"/><path d="M8 12h8"/><path d="M12 10v4"/></svg>
}

const tabs = [
  { path: '/transactions', label: 'תנועות', icon: <ListIcon /> },
  { path: '/add', label: 'הוסף', icon: <PlusIcon /> },
  { path: '/summary', label: 'סיכום', icon: <ChartIcon /> },
  { path: '/analytics', label: 'ניתוח', icon: <AnalyticsIcon /> },
  { path: '/savings', label: 'חסכונות', icon: <SavingsIcon /> },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeIndex = Math.max(0, tabs.findIndex(tab => tab.path === location.pathname))

  return (
    <nav style={styles.nav} aria-label="תפריט ניווט תחתון">
      <div aria-hidden="true" style={{ ...styles.activePill, transform: `translate3d(${activeIndex * 100}%, 0, 0)` }} />
      {tabs.map((tab, index) => {
        const active = index === activeIndex
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => tab.path !== location.pathname && navigate(tab.path)}
            style={{ ...styles.tab, ...(active ? styles.tabActive : null) }}
            aria-current={active ? 'page' : undefined}
          >
            <span style={{ ...styles.icon, transform: active ? 'translateY(-1px) scale(1.05)' : 'translateY(0) scale(1)' }}>{tab.icon}</span>
            <span style={styles.label}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

const iosEase = 'cubic-bezier(.16, 1.02, .30, 1)'
const styles = {
  nav: {
    position: 'fixed', zIndex: 30, right: '50%', bottom: 'max(14px, env(safe-area-inset-bottom))', transform: 'translateX(50%)',
    width: 'min(430px, calc(100% - 24px))', minHeight: '68px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'stretch', gap: 0,
    padding: '8px', border: '1px solid var(--border)', borderRadius: '22px', background: 'var(--nav-bg)', boxShadow: 'var(--nav-shadow)', overflow: 'hidden',
  },
  activePill: {
    position: 'absolute', zIndex: 0, top: '8px', bottom: '8px', left: '8px', width: 'calc((100% - 16px) / 5)', borderRadius: '16px',
    background: 'var(--nav-active-bg)', transition: `transform 380ms ${iosEase}`, willChange: 'transform', pointerEvents: 'none',
  },
  tab: {
    position: 'relative', zIndex: 1, minWidth: 0, minHeight: '52px', border: 0, borderRadius: '16px', background: 'transparent', color: 'var(--text-muted)',
    padding: '7px 2px 6px', display: 'grid', justifyItems: 'center', alignContent: 'center', gap: '4px', cursor: 'pointer', fontWeight: 700, fontSize: '10.5px',
    transition: 'color 170ms ease, transform 150ms cubic-bezier(.2,.8,.2,1)',
  },
  tabActive: { color: 'var(--nav-active-text)' },
  icon: { display: 'grid', placeItems: 'center', minHeight: '20px', transition: 'transform 260ms cubic-bezier(.2,.8,.2,1)', willChange: 'transform' },
  label: { lineHeight: 1.1, whiteSpace: 'nowrap' },
}
