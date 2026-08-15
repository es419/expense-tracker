import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './pages/SignIn'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Summary from './pages/Summary'
import BottomNav from './components/BottomNav'
import ThemeMenu from './components/ThemeMenu'
import { restoreSession } from './services/googleAuth'
import { preloadFinancialData } from './services/sheetsApi'
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

function App() {
  const [isSignedIn, setIsSignedIn] = useState(null)
  const [themePreference, setThemePreference] = useState(getInitialThemePreference)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)

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

    // Same UX idea as the attendance app: warm the data while the user is
    // already looking at the first screen, instead of waiting for the next tab.
    preloadFinancialData().catch(() => {})
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
          מתחבר…
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
      <div className="app">
        <ThemeMenu value={themePreference} onChange={setThemePreference} />
        <Routes>
          <Route path="/" element={<Navigate to="/add" replace />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/add" element={<AddTransaction />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="*" element={<Navigate to="/add" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App
