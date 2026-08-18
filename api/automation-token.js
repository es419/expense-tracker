import {
  REFRESH_COOKIE,
  decryptSessionTokens,
  encryptAutomationToken,
  parseCookies,
} from '../server/oauth.js'
import { AuthenticationError, getGoogleSession } from '../server/googleSession.js'
import { getExpenseSpreadsheetId } from '../server/expenseStore.js'

function htmlPage(token) {
  const safeToken = String(token)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>מפתח אוטומציה</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { width: min(92vw, 560px); padding: 24px; box-sizing: border-box; }
    h1 { font-size: 24px; margin: 0 0 10px; }
    p { line-height: 1.55; opacity: .8; }
    code { display: block; direction: ltr; text-align: left; overflow-wrap: anywhere; padding: 14px; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 14px; margin: 16px 0; font-size: 12px; }
    button { width: 100%; min-height: 48px; border: 0; border-radius: 14px; font-weight: 800; font-size: 16px; cursor: pointer; }
    small { display: block; margin-top: 12px; opacity: .65; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <h1>מפתח אוטומציה</h1>
    <p>המפתח הזה מאפשר ל-Shortcut להוסיף רק את עסקת מנהרות הכרמל דרך ה-endpoint הייעודי. אל תשתף אותו.</p>
    <code id="token">${safeToken}</code>
    <button id="copy" type="button">העתק מפתח</button>
    <small>אם תתנתק מ-Google או תבטל את ההרשאה לאפליקציה, ייתכן שתצטרך ליצור מפתח חדש.</small>
  </main>
  <script>
    const button = document.getElementById('copy');
    button.addEventListener('click', async () => {
      const token = document.getElementById('token').textContent;
      await navigator.clipboard.writeText(token);
      button.textContent = 'הועתק ✓';
    });
  </script>
</body>
</html>`
}

function response(body, status = 200, contentType = 'text/html; charset=utf-8') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, max-age=0',
      'Pragma': 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export default {
  async fetch(request) {
    if (request.method !== 'GET') {
      return response('Method Not Allowed', 405, 'text/plain; charset=utf-8')
    }

    try {
      const cookies = parseCookies(request)
      const cookieState = decryptSessionTokens(cookies[REFRESH_COOKIE])
      if (!cookieState?.refreshToken) throw new AuthenticationError()

      // Validate that the normal Google session can still refresh before issuing
      // a long-lived automation credential.
      const session = await getGoogleSession(request)
      const spreadsheetId = getExpenseSpreadsheetId(session.cacheKey)
        || session.spreadsheetId
        || cookieState.spreadsheetId
        || null

      const token = encryptAutomationToken({
        refreshToken: cookieState.refreshToken,
        spreadsheetId,
      })

      return response(htmlPage(token))
    } catch (error) {
      if (error instanceof AuthenticationError || error?.status === 401) {
        return response(
          '<!doctype html><meta charset="utf-8"><body dir="rtl" style="font-family:system-ui;padding:24px">צריך להתחבר קודם לאפליקציה עם Google ואז לפתוח את העמוד הזה מחדש.</body>',
          401
        )
      }

      console.error('Automation token setup failed:', error)
      return response('Automation setup failed', 500, 'text/plain; charset=utf-8')
    }
  },
}
