import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata'
export const REFRESH_COOKIE = 'expense_refresh'
export const STATE_COOKIE = 'expense_oauth_state'

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function getGoogleClientId() {
  return requiredEnv('GOOGLE_CLIENT_ID')
}

export function getGoogleClientSecret() {
  return requiredEnv('GOOGLE_CLIENT_SECRET')
}

function cookieSecretKey() {
  return createHash('sha256').update(requiredEnv('AUTH_COOKIE_SECRET')).digest()
}

function automationSecretKey() {
  return createHash('sha256')
    .update(`${requiredEnv('AUTH_COOKIE_SECRET')}:expense-automation:v1`)
    .digest()
}

export function getOrigin(request) {
  return new URL(request.url).origin
}

export function getRedirectUri(request) {
  return `${getOrigin(request)}/api/auth/callback`
}

export function createState() {
  return randomBytes(32).toString('base64url')
}

export function safeEqual(a, b) {
  if (!a || !b) return false
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function parseCookies(request) {
  const header = request.headers.get('cookie') || ''
  const cookies = {}

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (!key) continue
    try {
      cookies[key] = decodeURIComponent(value)
    } catch {
      cookies[key] = value
    }
  }

  return cookies
}

export function serializeCookie(name, value, request, options = {}) {
  const secure = new URL(request.url).protocol === 'https:'
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || '/'}`,
    `SameSite=${options.sameSite || 'Lax'}`,
  ]

  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (secure) parts.push('Secure')
  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`)

  return parts.join('; ')
}

export function clearCookie(name, request) {
  return serializeCookie(name, '', request, { maxAge: 0 })
}

function encryptPayload(value, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

function decryptPayload(payload, key) {
  if (!payload) return null

  try {
    const packed = Buffer.from(payload, 'base64url')
    if (packed.length < 29) return null

    const iv = packed.subarray(0, 12)
    const tag = packed.subarray(12, 28)
    const encrypted = packed.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch {
    return null
  }
}

function encryptCookiePayload(value) {
  return encryptPayload(value, cookieSecretKey())
}

function decryptCookiePayload(payload) {
  return decryptPayload(payload, cookieSecretKey())
}

export function encryptAutomationToken({ refreshToken, spreadsheetId = null }) {
  if (!refreshToken) throw new Error('Missing refresh token')

  return encryptPayload(JSON.stringify({
    v: 1,
    kind: 'expense-automation',
    refreshToken,
    spreadsheetId: spreadsheetId || null,
  }), automationSecretKey())
}

export function decryptAutomationToken(payload) {
  const decrypted = decryptPayload(payload, automationSecretKey())
  if (!decrypted) return null

  try {
    const parsed = JSON.parse(decrypted)
    if (
      parsed?.v === 1 &&
      parsed?.kind === 'expense-automation' &&
      typeof parsed.refreshToken === 'string' &&
      parsed.refreshToken
    ) {
      return {
        refreshToken: parsed.refreshToken,
        spreadsheetId: typeof parsed.spreadsheetId === 'string' ? parsed.spreadsheetId : null,
      }
    }
  } catch {
    return null
  }

  return null
}

// The old app stored only the refresh token in this encrypted cookie. The
// versioned payload keeps that format backward-compatible while also carrying
// a short-lived Google access token and the workbook ID. This avoids an OAuth
// refresh and Drive lookup on most serverless cold starts without persisting
// any financial data in the browser.
export function encryptSessionTokens({
  refreshToken,
  accessToken = null,
  accessTokenExpiresAt = 0,
  spreadsheetId = null,
}) {
  if (!refreshToken) throw new Error('Missing refresh token')

  return encryptCookiePayload(JSON.stringify({
    v: 2,
    refreshToken,
    accessToken: accessToken || null,
    accessTokenExpiresAt: Number(accessTokenExpiresAt) || 0,
    spreadsheetId: spreadsheetId || null,
  }))
}

export function decryptSessionTokens(payload) {
  const decrypted = decryptCookiePayload(payload)
  if (!decrypted) return null

  try {
    const parsed = JSON.parse(decrypted)
    if (parsed?.v === 2 && typeof parsed.refreshToken === 'string' && parsed.refreshToken) {
      return {
        refreshToken: parsed.refreshToken,
        accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : null,
        accessTokenExpiresAt: Number(parsed.accessTokenExpiresAt) || 0,
        spreadsheetId: typeof parsed.spreadsheetId === 'string' ? parsed.spreadsheetId : null,
      }
    }
  } catch {
    // Legacy cookie: the decrypted value itself is the refresh token.
  }

  return {
    refreshToken: decrypted,
    accessToken: null,
    accessTokenExpiresAt: 0,
    spreadsheetId: null,
  }
}

// Backward-compatible helpers used by logout/session endpoints.
export function encryptRefreshToken(refreshToken) {
  return encryptSessionTokens({ refreshToken })
}

export function decryptRefreshToken(payload) {
  return decryptSessionTokens(payload)?.refreshToken ?? null
}

async function tokenRequest(body) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error_description || data.error || 'Google token request failed')
    error.code = data.error || 'token_request_failed'
    error.status = response.status
    throw error
  }

  return data
}

export async function exchangeAuthorizationCode(code, request) {
  return tokenRequest({
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    code,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(request),
  })
}

export async function refreshAccessToken(refreshToken) {
  return tokenRequest({
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
}

export async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return

  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }),
    })
  } catch {
    // The local session is cleared even if Google's revoke endpoint is unavailable.
  }
}
