import {
  REFRESH_COOKIE,
  clearCookie,
  decryptSessionTokens,
  encryptSessionTokens,
  parseCookies,
  refreshAccessToken,
  serializeCookie,
} from '../../server/oauth.js'

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

export default {
  async fetch(request) {
    const cookies = parseCookies(request)
    const session = decryptSessionTokens(cookies[REFRESH_COOKIE])
    const refreshToken = session?.refreshToken

    if (!refreshToken) {
      return json({ authenticated: false }, 401)
    }

    try {
      const tokens = await refreshAccessToken(refreshToken)
      return json({
        authenticated: true,
        access_token: tokens.access_token,
        expires_in: tokens.expires_in || 3600,
      }, 200, {
        // Sliding one-year cookie: normal use keeps the local session alive.
        'Set-Cookie': serializeCookie(REFRESH_COOKIE, encryptSessionTokens({
          refreshToken,
          accessToken: tokens.access_token,
          accessTokenExpiresAt: Date.now() + (Number(tokens.expires_in) || 3600) * 1000,
          spreadsheetId: session?.spreadsheetId || null,
        }), request, {
          maxAge: 365 * 24 * 60 * 60,
        }),
      })
    } catch (error) {
      console.error('Token refresh failed:', error)
      return new Response(JSON.stringify({ authenticated: false, error: error.code || 'refresh_failed' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Set-Cookie': clearCookie(REFRESH_COOKIE, request),
        },
      })
    }
  },
}
