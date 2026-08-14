import { useEffect } from 'react'
import { signIn, handleCallback } from '../services/googleAuth'

export default function SignIn({ onSignIn }) {
  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      const success = handleCallback()
      if (success) {
        // Remove the OAuth access token from the address bar before rendering the app.
        window.history.replaceState(null, '', '/transactions')
        onSignIn()
      }
    }
  }, [onSignIn])

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
        התחבר עם Google כדי לסנכרן עם הגיליון שלך
      </p>
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
