export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'עבור למצב בהיר' : 'עבור למצב חשוך'}
      title={isDark ? 'מצב בהיר' : 'מצב חשוך'}
      style={styles.button}
    >
      <span aria-hidden="true" style={styles.icon}>{isDark ? '☀️' : '🌙'}</span>
    </button>
  )
}

const styles = {
  button: {
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
  icon: {
    fontSize: '19px',
    lineHeight: 1,
  },
}
