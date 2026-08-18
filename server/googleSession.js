import { createHash } from 'node:crypto'
import {
  REFRESH_COOKIE,
  clearCookie,
  decryptAutomationToken,
  decryptSessionTokens,
  encryptSessionTokens,
  parseCookies,
  refreshAccessToken,
  serializeCookie,
} from './oauth.js'

const accessTokenCache = new Map()
const refreshPromises = new Map()

function sessionKey(refreshToken) {
  return createHash('sha256').update(refreshToken).digest('hex')
}

function makeSessionCookie(request, state) {
  const encrypted = encryptSessionTokens({
    refreshToken: state.refreshToken,
    accessToken: state.accessToken,
    accessTokenExpiresAt: state.expiresAt,
    spreadsheetId: state.spreadsheetId,
  })

  return serializeCookie(REFRESH_COOKIE, encrypted, request, {
    maxAge: 365 * 24 * 60 * 60,
  })
}

export class AuthenticationError extends Error {
  constructor(message = 'Not signed in') {
    super(message)
    this.name = 'AuthenticationError'
    this.status = 401
  }
}

export async function getGoogleSession(request, { forceRefresh = false } = {}) {
  const cookies = parseCookies(request)
  const encryptedSession = cookies[REFRESH_COOKIE]
  const cookieState = decryptSessionTokens(encryptedSession)

  if (!cookieState?.refreshToken) throw new AuthenticationError()

  const refreshToken = cookieState.refreshToken
  const key = sessionKey(refreshToken)
  const cached = accessTokenCache.get(key)

  let accessToken = null
  let expiresAt = 0

  if (!forceRefresh && cached?.accessToken && Date.now() < cached.expiresAt - 60_000) {
    accessToken = cached.accessToken
    expiresAt = cached.expiresAt
  } else if (
    !forceRefresh &&
    cookieState.accessToken &&
    Date.now() < cookieState.accessTokenExpiresAt - 60_000
  ) {
    // Reuse the encrypted short-lived access token across serverless instances.
    // This removes the OAuth token refresh from the normal app-open path.
    accessToken = cookieState.accessToken
    expiresAt = cookieState.accessTokenExpiresAt
    accessTokenCache.set(key, { accessToken, expiresAt })
  } else {
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
      accessToken = value.accessToken
      expiresAt = value.expiresAt
    } catch (error) {
      accessTokenCache.delete(key)
      const authError = new AuthenticationError(error?.message || 'Google session refresh failed')
      authError.code = error?.code || 'refresh_failed'
      authError.clearCookie = clearCookie(REFRESH_COOKIE, request)
      throw authError
    }
  }

  const baseState = {
    refreshToken,
    accessToken,
    expiresAt,
    spreadsheetId: cookieState.spreadsheetId || null,
  }

  return {
    accessToken,
    cacheKey: key,
    spreadsheetId: baseState.spreadsheetId,
    sessionCookie: makeSessionCookie(request, baseState),
    sessionCookieForSpreadsheet(spreadsheetId) {
      return makeSessionCookie(request, {
        ...baseState,
        spreadsheetId: spreadsheetId || baseState.spreadsheetId,
      })
    },
  }
}

export async function getGoogleAutomationSession(token, { forceRefresh = false } = {}) {
  const tokenState = decryptAutomationToken(token)
  if (!tokenState?.refreshToken) {
    const error = new AuthenticationError('Invalid automation token')
    error.code = 'invalid_automation_token'
    throw error
  }

  const refreshToken = tokenState.refreshToken
  const key = sessionKey(refreshToken)
  const cached = accessTokenCache.get(key)
  let accessToken = null
  let expiresAt = 0

  if (!forceRefresh && cached?.accessToken && Date.now() < cached.expiresAt - 60_000) {
    accessToken = cached.accessToken
    expiresAt = cached.expiresAt
  } else {
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
      accessToken = value.accessToken
      expiresAt = value.expiresAt
    } catch (error) {
      accessTokenCache.delete(key)
      const authError = new AuthenticationError(error?.message || 'Google automation refresh failed')
      authError.code = error?.code || 'automation_refresh_failed'
      throw authError
    }
  }

  return {
    accessToken,
    expiresAt,
    cacheKey: key,
    spreadsheetId: tokenState.spreadsheetId || null,
  }
}

export function hasSessionCookie(request) {
  const cookies = parseCookies(request)
  return Boolean(decryptSessionTokens(cookies[REFRESH_COOKIE])?.refreshToken)
}

export function clearServerSessionCache(cacheKey) {
  if (!cacheKey) return
  accessTokenCache.delete(cacheKey)
  refreshPromises.delete(cacheKey)
}
