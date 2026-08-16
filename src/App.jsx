import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import SignIn from './pages/SignIn'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Summary from './pages/Summary'
import Analytics from './pages/Analytics'
import BottomNav from './components/BottomNav'
import ThemeMenu from './components/ThemeMenu'
import { restoreSession } from './services/googleAuth'
import { fetchAvailableMonths, preloadFinancialData } from './services/sheetsApi'
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

const ROUTE_ORDER = ['/transactions', '/add', '/summary', '/analytics']

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

    const currentMonthKey = getMonthKey()
    preloadFinancialData(currentMonthKey).catch(() => {})

    fetchAvailableMonths()
      .then(keys => {
        const clean = Array.isArray(keys) && keys.length ? keys : [currentMonthKey]
        setAvailableMonthKeys(clean)
        if (!clean.includes(selectedMonthKey)) setSelectedMonthKey(clean.at(-1) || currentMonthKey)
      })
      .catch(() => {})
  }, [isSignedIn])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return undefined

    const handleChange = event => setSystemTheme(event.matches ? 'dark' : 'light')
    setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener?.('change', handleChange)

    return () => media.removeEventListener?.('change', handleChange)
  }, [])

  const theme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, themePreference)

    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#0d1117' : '#f7f8fb')
  }, [theme, themePreference])

  if (isSignedIn === null) {
    return (
      <div className="sign-in-shell">
        <ThemeMenu value={themePreference} onChange={setThemePreference} />
        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)',
          color: 'var(--text-muted)',
        }}>

        </div>
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
      }}>
        <div className="app">
          <ThemeMenu value={themePreference} onChange={setThemePreference} />
          <MonthFilter />
          <AnimatedRoutes />
          <BottomNav />
        </div>
      </MonthContext.Provider>
    </BrowserRouter>
  )
}

export default App
