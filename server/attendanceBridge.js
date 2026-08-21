const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_FILES_BASE = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files'
const LINK_CONFIG_NAME = 'expense-tracker-attendance-links.json'

const MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
]

const sheetIdCache = new Map()

function createGoogleRequest(accessToken) {
  return async function googleRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const text = await response.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }

    if (!response.ok) {
      const message = data?.error?.message || data?.error || `Google API error ${response.status}`
      const error = new Error(typeof message === 'string' ? message : JSON.stringify(message))
      error.status = response.status
      throw error
    }

    return data
  }
}

function validateMonthKey(monthKey) {
  const value = String(monthKey || '')
  if (!/^\d{4}-\d{2}$/.test(value)) {
    const error = new Error('Invalid month key')
    error.status = 400
    throw error
  }
  const month = Number(value.slice(5, 7))
  if (month < 1 || month > 12) {
    const error = new Error('Invalid month key')
    error.status = 400
    throw error
  }
  return value
}

function a1(title, cells) {
  const escaped = String(title).replaceAll("'", "''")
  return `'${escaped}'!${cells}`
}

function parseSpreadsheetId(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const urlMatch = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (urlMatch?.[1]) return urlMatch[1]
  return /^[a-zA-Z0-9-_]{20,}$/.test(text) ? text : ''
}

function hoursBetween(start, end, breakMinutes = 0) {
  if (!start || !end) return 0
  const [sh, sm] = String(start).split(':').map(Number)
  const [eh, em] = String(end).split(':').map(Number)
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0
  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return Math.max(0, (mins - Number(breakMinutes || 0)) / 60)
}

function splitHoursByRate(totalHours, settings) {
  const t125 = Number(settings.overtime125AfterHours || 8)
  const t150 = Number(settings.overtime150AfterHours || 10)
  return {
    regularHours: Math.min(totalHours, t125),
    overtime125Hours: Math.max(0, Math.min(totalHours, t150) - t125),
    overtime150Hours: Math.max(0, totalHours - t150),
  }
}

function parseConfig(rows) {
  const map = Object.fromEntries((rows || []).slice(1).map(row => [row?.[0], row?.[1]]))
  let settings = {}
  let additions = []
  try { settings = JSON.parse(map.settings_json || '{}') || {} } catch {}
  try {
    const parsed = JSON.parse(map.additions_json || '[]')
    additions = Array.isArray(parsed) ? parsed : []
  } catch {}
  return { settings, additions }
}

function calculateGross(entries, settings, additions) {
  const hourlyRate = Number(settings.hourlyRate || 0)
  const rate125 = Number(settings.overtime125Percent || 125) / 100
  const rate150 = Number(settings.overtime150Percent || 150) / 100

  const totals = (entries || []).reduce((acc, entry) => {
    const hours = hoursBetween(entry.start, entry.end, entry.breakMinutes)
    const split = splitHoursByRate(hours, settings)
    acc.total += hours
    acc.regular += split.regularHours
    acc.h125 += split.overtime125Hours
    acc.h150 += split.overtime150Hours
    return acc
  }, { total: 0, regular: 0, h125: 0, h150: 0 })

  const fromHours = totals.regular * hourlyRate
    + totals.h125 * hourlyRate * rate125
    + totals.h150 * hourlyRate * rate150
  const additionsTotal = (additions || []).reduce((sum, item) => sum + Number(item?.value || 0), 0)

  return {
    gross: fromHours + additionsTotal,
    hours: totals.total,
    additionsTotal,
    hourlyRate,
  }
}

async function getMetadata(googleRequest, spreadsheetId) {
  return googleRequest(`${SHEETS_BASE}/${spreadsheetId}?fields=properties(title),sheets.properties(title)`)
}

async function readAttendanceMonth(googleRequest, spreadsheetId, monthKey) {
  const year = monthKey.slice(0, 4)
  const month = Number(monthKey.slice(5, 7))
  const monthTitle = MONTHS[month - 1]
  const metadata = await getMetadata(googleRequest, spreadsheetId)
  const titles = new Set((metadata?.sheets || []).map(item => item.properties?.title))

  if (!titles.has('_מערכת') || !titles.has(monthTitle)) {
    const error = new Error('Not an attendance workbook')
    error.code = 'not_attendance_workbook'
    error.status = 404
    throw error
  }

  const ranges = [a1(monthTitle, 'A2:G'), a1('_מערכת', 'A1:B3')]
  const query = ranges.map(range => `ranges=${encodeURIComponent(range)}`).join('&')
  const data = await googleRequest(`${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${query}&majorDimension=ROWS`)
  const entryRows = data?.valueRanges?.[0]?.values || []
  const configRows = data?.valueRanges?.[1]?.values || []
  const entries = entryRows.filter(row => row?.[0]).map(row => ({
    id: row?.[0] || '',
    date: row?.[1] || '',
    start: row?.[2] || '',
    end: row?.[3] || '',
    breakMinutes: Number(row?.[4] || 0),
  }))
  const { settings, additions } = parseConfig(configRows)
  const calculated = calculateGross(entries, settings, additions)

  return {
    available: true,
    spreadsheetId,
    spreadsheetTitle: metadata?.properties?.title || year,
    monthKey,
    gross: calculated.gross,
    hours: calculated.hours,
    additionsTotal: calculated.additionsTotal,
    hourlyRate: calculated.hourlyRate,
    pensionEmployeePercent: Number(settings.pensionEmployeePercent || 0),
    pensionEmployerPercent: Number(settings.pensionEmployerPercent || 0),
    pensionSeverancePercent: Number(settings.pensionSeverancePercent || 0),
    trainingFundEmployeePercent: Number(settings.trainingFundEmployeePercent || 0),
    trainingFundEmployerPercent: Number(settings.trainingFundEmployerPercent || 0),
    fetchedAt: new Date().toISOString(),
  }
}

async function listLinkConfigFiles(googleRequest) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${LINK_CONFIG_NAME}' and trashed = false`,
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '5',
  })
  const data = await googleRequest(`${DRIVE_FILES_BASE}?${params.toString()}`)
  return data?.files || []
}

async function readSavedLinks(googleRequest) {
  try {
    const files = await listLinkConfigFiles(googleRequest)
    const file = files[0]
    if (!file) return { fileId: null, links: {} }
    const data = await googleRequest(`${DRIVE_FILES_BASE}/${file.id}?alt=media`)
    const links = data && typeof data === 'object' && data.links && typeof data.links === 'object' ? data.links : {}
    return { fileId: file.id, links }
  } catch {
    return { fileId: null, links: {} }
  }
}

async function writeSavedLinks(googleRequest, links, fileId = null) {
  let targetId = fileId
  if (!targetId) {
    const created = await googleRequest(`${DRIVE_FILES_BASE}?fields=id`, {
      method: 'POST',
      body: JSON.stringify({
        name: LINK_CONFIG_NAME,
        parents: ['appDataFolder'],
        mimeType: 'application/json',
      }),
    })
    targetId = created?.id
  }

  if (!targetId) throw new Error('Failed to create attendance link config')
  await googleRequest(`${DRIVE_UPLOAD_BASE}/${targetId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ links }),
  })
}

async function discoverAttendanceSpreadsheet(googleRequest, year) {
  const q = [
    `name = '${String(year).replaceAll("'", "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    'trashed = false',
  ].join(' and ')
  const params = new URLSearchParams({
    q,
    spaces: 'drive',
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '20',
  })

  let files = []
  try {
    const data = await googleRequest(`${DRIVE_FILES_BASE}?${params.toString()}`)
    files = data?.files || []
  } catch {
    return null
  }

  for (const file of files) {
    try {
      const metadata = await getMetadata(googleRequest, file.id)
      const titles = new Set((metadata?.sheets || []).map(item => item.properties?.title))
      if (titles.has('_מערכת') && MONTHS.every(title => titles.has(title))) return file.id
    } catch {}
  }
  return null
}

export async function getAttendanceGross(accessToken, cacheKey, rawMonthKey) {
  const monthKey = validateMonthKey(rawMonthKey)
  const year = monthKey.slice(0, 4)
  const googleRequest = createGoogleRequest(accessToken)
  const cacheId = `${cacheKey || 'session'}:${year}`

  let spreadsheetId = sheetIdCache.get(cacheId) || null
  let savedConfig = null

  if (!spreadsheetId) {
    savedConfig = await readSavedLinks(googleRequest)
    spreadsheetId = parseSpreadsheetId(savedConfig.links?.[year]) || null
    if (spreadsheetId) sheetIdCache.set(cacheId, spreadsheetId)
  }

  if (spreadsheetId) {
    try {
      return await readAttendanceMonth(googleRequest, spreadsheetId, monthKey)
    } catch (error) {
      if (![403, 404].includes(error?.status)) throw error
      sheetIdCache.delete(cacheId)
      spreadsheetId = null
    }
  }

  spreadsheetId = await discoverAttendanceSpreadsheet(googleRequest, year)
  if (spreadsheetId) {
    sheetIdCache.set(cacheId, spreadsheetId)
    try {
      savedConfig ||= await readSavedLinks(googleRequest)
      await writeSavedLinks(googleRequest, { ...(savedConfig.links || {}), [year]: spreadsheetId }, savedConfig.fileId)
    } catch {}
    return readAttendanceMonth(googleRequest, spreadsheetId, monthKey)
  }

  return {
    available: false,
    monthKey,
    year,
    reason: 'attendance_sheet_not_found',
    message: 'לא הצלחתי למצוא אוטומטית את גיליון הנוכחות של השנה.',
  }
}

export async function saveAttendanceSpreadsheetLink(accessToken, cacheKey, rawMonthKey, rawValue) {
  const monthKey = validateMonthKey(rawMonthKey)
  const year = monthKey.slice(0, 4)
  const spreadsheetId = parseSpreadsheetId(rawValue)
  if (!spreadsheetId) {
    const error = new Error('קישור או מזהה Google Sheet לא תקין')
    error.status = 400
    throw error
  }

  const googleRequest = createGoogleRequest(accessToken)
  // Validate access and workbook structure before persisting the link.
  await readAttendanceMonth(googleRequest, spreadsheetId, monthKey)

  const saved = await readSavedLinks(googleRequest)
  await writeSavedLinks(googleRequest, { ...(saved.links || {}), [year]: spreadsheetId }, saved.fileId)
  sheetIdCache.set(`${cacheKey || 'session'}:${year}`, spreadsheetId)

  return getAttendanceGross(accessToken, cacheKey, monthKey)
}

export function clearAttendanceBridgeCache(cacheKey) {
  if (!cacheKey) return
  for (const key of sheetIdCache.keys()) {
    if (key.startsWith(`${cacheKey}:`)) sheetIdCache.delete(key)
  }
}
