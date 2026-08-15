import { createHash } from 'node:crypto'
import {
  REFRESH_COOKIE,
  clearCookie,
  decryptRefreshToken,
  parseCookies,
  refreshAccessToken,
  serializeCookie,
} from './oauth.js'

const accessTokenCache = new Map()
const refreshPromises = new Map()

function sessionKey(refreshToken) {
  return createHash('sha256').update(refreshToken).digest('hex')
}

export class AuthenticationError extends Error {
  constructor(message = 'Not signed in') {
    super(message)
    this.name = 'AuthenticationError'
    this.status = 401
  }
}

export async function getGoogleSession(request) {
  const cookies = parseCookies(request)
  const encryptedRefreshToken = cookies[REFRESH_COOKIE]
  const refreshToken = decryptRefreshToken(encryptedRefreshToken)

  if (!refreshToken) throw new AuthenticationError()

  const key = sessionKey(refreshToken)
  const cached = accessTokenCache.get(key)
  if (cached?.accessToken && Date.now() < cached.expiresAt - 60_000) {
    return {
      accessToken: cached.accessToken,
      cacheKey: key,
      sessionCookie: serializeCookie(REFRESH_COOKIE, encryptedRefreshToken, request, {
        maxAge: 365 * 24 * 60 * 60,
      }),
    }
  }

  if (!refreshPromises.has(key)) {
    refreshPromises.set(
      key,
      refreshAccessToken(refreshToken)
        .then(tokens => {
          const value = {
            accessToken: tokens.access_token,
            expiresAt: Date.now() + (Number(tokens.expires_in) || 3600) * 1000,
          }
          accessTokenCache.set(key, value)
          return value
        })
        .finally(() => refreshPromises.delete(key))
    )
  }

  try {
    const value = await refreshPromises.get(key)
    return {
      accessToken: value.accessToken,
      cacheKey: key,
      sessionCookie: serializeCookie(REFRESH_COOKIE, encryptedRefreshToken, request, {
        maxAge: 365 * 24 * 60 * 60,
      }),
    }
  } catch (error) {
    accessTokenCache.delete(key)
    const authError = new AuthenticationError(error?.message || 'Google session refresh failed')
    authError.code = error?.code || 'refresh_failed'
    authError.clearCookie = clearCookie(REFRESH_COOKIE, request)
    throw authError
  }
}

export function hasSessionCookie(request) {
  const cookies = parseCookies(request)
  return Boolean(decryptRefreshToken(cookies[REFRESH_COOKIE]))
}

export function clearServerSessionCache(cacheKey) {
  if (!cacheKey) return
  accessTokenCache.delete(cacheKey)
  refreshPromises.delete(cacheKey)
}
