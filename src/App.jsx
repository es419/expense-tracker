import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import SignIn from './pages/SignIn'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Summary from './pages/Summary'
import Analytics from './pages/Analytics'
import Savings from './pages/Savings'
import BottomNav from './components/BottomNav'
import ThemeMenu from './components/ThemeMenu'
import { restoreSession } from './services/googleAuth'
import { fetchAvailableMonths, preloadFinancialData, refreshFinancialData } from './services/sheetsApi'
import MonthFilter from './components/MonthFilter'
import { MonthContext } from './context/MonthContext'
import { getMonthKey } from './utils/billing'
import './App.css'

const THEME_KEY = 'expense_tracker_theme'

function getInitialThemePreference() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'system' || saved === 'light' || saved === 'dark') return saved
  return 'system'
}

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const ROUTE_ORDER = ['/transactions', '/add', '/summary', '/analytics', '/savings']


function PageHeader() {
  const location = useLocation()
  const titleByPath = {
    '/transactions': 'תנועות',
    '/add': 'הוספה',
    '/summary': 'סיכום',
    '/analytics': 'ניתוח',
    '/savings': 'חסכונות, קרנות ופנסיה',
  }
  const title = titleByPath[location.pathname] || 'הוספה'

  return (
    <header className="pageHeader">
      <h1 className="pageHeaderTitle">{title}</h1>
      {location.pathname !== '/savings' && <MonthFilter />}
    </header>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  const previousIndexRef = useRef(
    Math.max(0, ROUTE_ORDER.indexOf(location.pathname))
  )

  const currentIndex = Math.max(0, ROUTE_ORDER.indexOf(location.pathname))
  const direction = currentIndex >= previousIndexRef.current ? 'forward' : 'back'

  useEffect(() => {
    previousIndexRef.current = currentIndex
  }, [currentIndex])

  return (
    <div key={location.pathname} className={`tabScene ${direction}`}>
      <Routes location={location}>
        <Route path="/" element={<Navigate to="/add" replace />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/add" element={<AddTransaction />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/savings" element={<Savings />} />
        <Route path="*" element={<Navigate to="/add" replace />} />
      </Routes>
    </div>
  )
}

function App() {
  const [isSignedIn, setIsSignedIn] = useState(null)
  const [themePreference, setThemePreference] = useState(getInitialThemePreference)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const [selectedMonthKey, setSelectedMonthKey] = useState(getMonthKey)
  const [availableMonthKeys, setAvailableMonthKeys] = useState([getMonthKey()])
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')
  const appRef = useRef(null)
  const refreshingRef = useRef(false)

  useEffect(() => {
    let active = true
    restoreSession().then(signedIn => {
      if (active) setIsSignedIn(signedIn)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isSignedIn) return

    let active = true
    const currentMonthKey = getMonthKey()

    ;(async () => {
      try {
        // loadMonth now also returns the workbook's month list, so app start
        // needs one data request instead of loading the same sheet twice.
        const preload = await preloadFinancialData(currentMonthKey)
        const keys = preload?.availableMonths?.length
          ? preload.availableMonths
          : await fetchAvailableMonths()
        if (!active) return

        const clean = Array.isArray(keys) && keys.length ? keys : [currentMonthKey]
        setAvailableMonthKeys(clean)
        setSelectedMonthKey(current => clean.includes(current) ? current : (clean.at(-1) || currentMonthKey))
      } catch {
        // Keep the current month usable even if a background preload fails.
      }
    })()

    return () => {
      active = false
    }
  }, [isSignedIn])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return undefined

    const handleChange = event => setSystemTheme(event.matches ? 'dark' : 'light')
    setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener?.('change', handleChange)

    return () => media.removeEventListener?.('change', handleChange)
  }, [])

  async function refreshAllData() {
    if (!isSignedIn || refreshingRef.current) return

    refreshingRef.current = true
    setRefreshing(true)
    setPullDistance(72)
    setRefreshMessage('')

    try {
      const fresh = await refreshFinancialData(selectedMonthKey)
      const keys = Array.isArray(fresh?.availableMonths) && fresh.availableMonths.length
        ? fresh.availableMonths
        : (availableMonthKeys.length ? availableMonthKeys : [selectedMonthKey])
      setAvailableMonthKeys(keys)
      setRefreshVersion(version => version + 1)
      setRefreshMessage('הנתונים עודכנו')
    } catch {
      setRefreshMessage('הרענון נכשל')
    } finally {
      window.setTimeout(() => {
        refreshingRef.current = false
        setRefreshing(false)
        setPullDistance(0)
        window.setTimeout(() => setRefreshMessage(''), 650)
      }, 320)
    }
  }

  useEffect(() => {
    const root = appRef.current
    if (!root || !isSignedIn) return

    let startX = 0
    let startY = 0
    let tracking = false
    let pulling = false
    let currentDistance = 0

    const resetGesture = () => {
      tracking = false
      pulling = false
      currentDistance = 0
    }

    const handleTouchStart = event => {
      if (refreshingRef.current || event.touches.length !== 1 || window.scrollY > 1) return
      const touch = event.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      tracking = true
      pulling = false
      currentDistance = 0
    }

    const handleTouchMove = event => {
      if (!tracking || event.touches.length !== 1) return
      const touch = event.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY

      if (!pulling) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          resetGesture()
          return
        }
        if (dy <= 6 || Math.abs(dy) <= Math.abs(dx)) return
        if (window.scrollY > 1) {
          resetGesture()
          return
        }
        pulling = true
      }

      if (dy <= 0) {
        resetGesture()
        setPullDistance(0)
        return
      }

      event.preventDefault()
      currentDistance = Math.min(104, dy * 0.55)
      setPullDistance(currentDistance)
    }

    const finishPull = () => {
      if (!tracking && !pulling) return
      const shouldRefresh = pulling && currentDistance >= 72
      resetGesture()
      if (shouldRefresh) refreshAllData()
      else setPullDistance(0)
    }

    root.addEventListener('touchstart', handleTouchStart, { passive: true })
    root.addEventListener('touchmove', handleTouchMove, { passive: false })
    root.addEventListener('touchend', finishPull, { passive: true })
    root.addEventListener('touchcancel', finishPull, { passive: true })

    return () => {
      root.removeEventListener('touchstart', handleTouchStart)
      root.removeEventListener('touchmove', handleTouchMove)
      root.removeEventListener('touchend', finishPull)
      root.removeEventListener('touchcancel', finishPull)
    }
  }, [isSignedIn, selectedMonthKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const theme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, themePreference)

    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#0d1117' : '#f7f8fb')
  }, [theme, themePreference])

  if (isSignedIn === null) {
    return (
      <div className="appSplash" aria-label="טוען את ניהול ההוצאות">
        <img className="appSplashLogo" src="/icon-192.png" alt="" />
        <div className="appSplashLoader" aria-hidden="true" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="sign-in-shell">
        <ThemeMenu value={themePreference} onChange={setThemePreference} />
        <SignIn />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <MonthContext.Provider value={{
        selectedMonthKey,
        setSelectedMonthKey,
        availableMonthKeys,
        refreshVersion,
      }}>
        <div className="app" ref={appRef}>
          <div
            className={`pullRefreshIndicator ${refreshing ? 'refreshing' : ''} ${pullDistance >= 72 ? 'ready' : ''}`}
            style={{
              transform: `translate(-50%, ${refreshing ? 0 : Math.min(0, -58 + pullDistance * 0.82)}px)`,
              opacity: refreshing || refreshMessage ? 1 : Math.min(1, pullDistance / 72),
              '--pull-rotation': Math.round(Math.min(1, pullDistance / 72) * 220),
            }}
            aria-live="polite"
          >
            <span className="pullRefreshGlyph">↻</span>
            <span>{refreshMessage || (refreshing ? 'מרענן...' : pullDistance >= 72 ? 'שחרר לרענון' : 'משוך לרענון')}</span>
          </div>
          <ThemeMenu value={themePreference} onChange={setThemePreference} />
          <PageHeader />
          <AnimatedRoutes />
          <BottomNav />
        </div>
      </MonthContext.Provider>
    </BrowserRouter>
  )
}

export default App
