let accessToken = null
let accessTokenExpiresAt = 0
let tokenPromise = null

function clearLegacyTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('token_expires_at')
}

clearLegacyTokens()

export function signIn() {
  window.location.assign('/api/auth/start')
}

export function invalidateAccessToken() {
  accessToken = null
  accessTokenExpiresAt = 0
}

export async function getToken({ forceRefresh = false } = {}) {
  const hasFreshToken = accessToken && Date.now() < accessTokenExpiresAt - 60_000
  if (!forceRefresh && hasFreshToken) return accessToken

  if (tokenPromise) return tokenPromise

  tokenPromise = fetch('/api/auth/token', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  })
    .then(async response => {
      if (response.status === 401) {
        invalidateAccessToken()
        return null
      }
      if (!response.ok) throw new Error(`Session token request failed (${response.status})`)

      const data = await response.json()
      accessToken = data.access_token
      accessTokenExpiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000
      return accessToken
    })
    .finally(() => {
      tokenPromise = null
    })

  return tokenPromise
}

export async function restoreSession() {
  try {
    return Boolean(await getToken())
  } catch (error) {
    console.error('Session restore failed:', error)
    return false
  }
}

export async function signOut() {
  invalidateAccessToken()
  clearLegacyTokens()

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
