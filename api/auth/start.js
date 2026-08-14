import {
  GOOGLE_SCOPE,
  STATE_COOKIE,
  createState,
  getGoogleClientId,
  getRedirectUri,
  serializeCookie,
} from '../../server/oauth.js'

export default {
  async fetch(request) {
    try {
      const state = createState()
      const params = new URLSearchParams({
        client_id: getGoogleClientId(),
        redirect_uri: getRedirectUri(request),
        response_type: 'code',
        scope: GOOGLE_SCOPE,
        access_type: 'offline',
        include_granted_scopes: 'true',
        prompt: 'consent',
        state,
      })

      const headers = new Headers({
        Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        'Cache-Control': 'no-store',
      })
      headers.append('Set-Cookie', serializeCookie(STATE_COOKIE, state, request, { maxAge: 10 * 60 }))

      return new Response(null, { status: 302, headers })
    } catch (error) {
      return new Response(`OAuth configuration error: ${error.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
  },
}
