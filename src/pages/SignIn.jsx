import { signIn } from '../services/googleAuth'

const ERROR_MESSAGES = {
  access_denied: 'ההרשאה ל-Google בוטלה.',
  invalid_state: 'החיבור ל-Google לא הושלם בצורה תקינה. נסה שוב.',
  missing_refresh_token: 'Google לא החזירה הרשאת התחברות מתמשכת. נסה להתחבר שוב.',
  token_exchange_failed: 'לא הצלחנו להשלים את ההתחברות ל-Google.',
}

export default function SignIn() {
  const authError = new URLSearchParams(window.location.search).get('auth_error')
  const errorMessage = authError
    ? (ERROR_MESSAGES[authError] || 'אירעה שגיאה בהתחברות ל-Google. נסה שוב.')
    : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: '18px',
      padding: '24px',
      background: 'transparent'
    }}>
      <div style={{
        width: '82px',
        height: '82px',
        display: 'grid',
        placeItems: 'center',
        fontSize: '42px',
        borderRadius: '26px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
      }}>💰</div>
      <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 860, letterSpacing: '-0.02em' }}>ניהול הוצאות</h1>
      <p style={{ margin: 0, color: 'var(--text-muted)', textAlign: 'center', maxWidth: '340px', lineHeight: 1.55 }}>
        התחבר פעם אחת עם Google כדי לסנכרן עם הגיליון שלך
      </p>
      {errorMessage && (
        <p style={{
          margin: 0,
          color: 'var(--danger, #d93025)',
          textAlign: 'center',
          maxWidth: '360px',
        }}>
          {errorMessage}
        </p>
      )}
      <button
        onClick={signIn}
        style={{
          minWidth: '220px',
          minHeight: '52px',
          padding: '13px 26px',
          fontSize: '16px',
          fontWeight: 800,
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary) 90%, white 10%), var(--primary))',
          color: 'var(--primary-text)',
          border: '1px solid color-mix(in srgb, var(--primary) 70%, white 30%)',
          borderRadius: '18px',
          cursor: 'pointer',
          boxShadow: '0 14px 34px color-mix(in srgb, var(--primary) 26%, transparent), inset 0 1px 0 rgba(255,255,255,0.38)',
        }}
      >
        התחבר עם Google
      </button>
    </div>
  )
}
