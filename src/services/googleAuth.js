export function signIn() {
  window.location.assign('/api/auth/start')
}

export async function restoreSession() {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) return false
    const data = await response.json()
    return Boolean(data.authenticated)
  } catch (error) {
    console.error('Session restore failed:', error)
    return false
  }
}

export async function signOut() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    })
  } finally {
    window.location.assign('/')
  }
}
