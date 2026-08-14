import {
  REFRESH_COOKIE,
  clearCookie,
  decryptRefreshToken,
  parseCookies,
  revokeRefreshToken,
} from '../../server/oauth.js'

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
    }

    const cookies = parseCookies(request)
    const refreshToken = decryptRefreshToken(cookies[REFRESH_COOKIE])
    await revokeRefreshToken(refreshToken)

    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': clearCookie(REFRESH_COOKIE, request),
      },
    })
  },
}
