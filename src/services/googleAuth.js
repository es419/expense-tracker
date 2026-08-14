import { GOOGLE_CLIENT_ID, REDIRECT_URI, SCOPES } from '../config/sheetsConfig'

export function signIn() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: SCOPES,
    prompt: 'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export function handleCallback() {
  const hash = window.location.hash.substring(1)
  const params = new URLSearchParams(hash)
  const token = params.get('access_token')
  const expiresIn = params.get('expires_in')

  if (token) {
    const expiresAt = Date.now() + Number(expiresIn) * 1000
    localStorage.setItem('access_token', token)
    localStorage.setItem('token_expires_at', String(expiresAt))
    return true
  }
  return false
}

export function getToken() {
  const token = localStorage.getItem('access_token')
  const expiresAt = Number(localStorage.getItem('token_expires_at'))

  if (!token || Date.now() > expiresAt) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token_expires_at')
    return null
  }
  return token
}

export function signOut() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('token_expires_at')
  window.location.reload()
}
