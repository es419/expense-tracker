import {
  REFRESH_COOKIE,
  STATE_COOKIE,
  clearCookie,
  encryptRefreshToken,
  exchangeAuthorizationCode,
  getOrigin,
  parseCookies,
  safeEqual,
  serializeCookie,
} from '../../server/oauth.js'

function redirectWithError(request, code) {
  return `${getOrigin(request)}/?auth_error=${encodeURIComponent(code)}`
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const googleError = url.searchParams.get('error')
    const cookies = parseCookies(request)

    const headers = new Headers({ 'Cache-Control': 'no-store' })
    headers.append('Set-Cookie', clearCookie(STATE_COOKIE, request))

    if (googleError) {
      headers.set('Location', redirectWithError(request, googleError))
      return new Response(null, { status: 302, headers })
    }

    if (!code || !safeEqual(state, cookies[STATE_COOKIE])) {
      headers.set('Location', redirectWithError(request, 'invalid_state'))
      return new Response(null, { status: 302, headers })
    }

    try {
      const tokens = await exchangeAuthorizationCode(code, request)
      if (!tokens.refresh_token) {
        headers.set('Location', redirectWithError(request, 'missing_refresh_token'))
        return new Response(null, { status: 302, headers })
      }

      const encryptedRefreshToken = encryptRefreshToken(tokens.refresh_token)
      headers.append('Set-Cookie', serializeCookie(REFRESH_COOKIE, encryptedRefreshToken, request, {
        maxAge: 365 * 24 * 60 * 60,
      }))
      headers.set('Location', `${getOrigin(request)}/transactions`)

      return new Response(null, { status: 302, headers })
    } catch (error) {
      console.error('OAuth callback failed:', error)
      headers.set('Location', redirectWithError(request, error.code || 'token_exchange_failed'))
      return new Response(null, { status: 302, headers })
    }
  },
}
