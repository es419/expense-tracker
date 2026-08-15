import { REFRESH_COOKIE, parseCookies, serializeCookie } from '../../server/oauth.js'
import { hasSessionCookie } from '../../server/googleSession.js'

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
    const authenticated = hasSessionCookie(request)
    if (!authenticated) return json({ authenticated: false }, 401)

    const cookies = parseCookies(request)
    return json({ authenticated: true }, 200, {
      'Set-Cookie': serializeCookie(REFRESH_COOKIE, cookies[REFRESH_COOKIE], request, {
        maxAge: 365 * 24 * 60 * 60,
      }),
    })
  },
}
