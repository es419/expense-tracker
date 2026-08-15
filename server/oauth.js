import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file'
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

export function encryptRefreshToken(refreshToken) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', cookieSecretKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(refreshToken, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function decryptRefreshToken(payload) {
  if (!payload) return null

  try {
    const packed = Buffer.from(payload, 'base64url')
    if (packed.length < 29) return null

    const iv = packed.subarray(0, 12)
    const tag = packed.subarray(12, 28)
    const encrypted = packed.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', cookieSecretKey(), iv)
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
