import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './pages/SignIn'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Summary from './pages/Summary'
import BottomNav from './components/BottomNav'
import ThemeToggle from './components/ThemeToggle'
import { restoreSession } from './services/googleAuth'
import './App.css'

const THEME_KEY = 'expense_tracker_theme'

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [isSignedIn, setIsSignedIn] = useState(null)
  const [theme, setTheme] = useState(getInitialTheme)

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
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)

    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#0d1117' : '#f7f8fb')
  }, [theme])

  function toggleTheme() {
    setTheme(current => current === 'dark' ? 'light' : 'dark')
  }

  if (isSignedIn === null) {
    return (
      <div className="sign-in-shell">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <SignIn />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="app">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <Routes>
          <Route path="/" element={<Navigate to="/transactions" />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/add" element={<AddTransaction />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="*" element={<Navigate to="/transactions" replace />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App
