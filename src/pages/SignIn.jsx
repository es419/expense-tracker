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
      height: '100vh',
      gap: '24px',
      padding: '24px',
      background: 'var(--bg)'
    }}>
      <div style={{ fontSize: '48px' }}>💰</div>
      <h1 style={{ margin: 0, fontSize: '24px' }}>ניהול הוצאות</h1>
      <p style={{ margin: 0, color: 'var(--text-muted)', textAlign: 'center' }}>
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
          padding: '12px 32px',
          fontSize: '16px',
          background: 'var(--primary)',
          color: 'var(--primary-text)',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        התחבר עם Google
      </button>
    </div>
  )
}
