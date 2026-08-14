import {
  REFRESH_COOKIE,
  clearCookie,
  decryptRefreshToken,
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
    const refreshToken = decryptRefreshToken(cookies[REFRESH_COOKIE])

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
        'Set-Cookie': serializeCookie(REFRESH_COOKIE, cookies[REFRESH_COOKIE], request, {
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
