import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './pages/SignIn'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Summary from './pages/Summary'
import BottomNav from './components/BottomNav'
import ThemeToggle from './components/ThemeToggle'
import './App.css'

const THEME_KEY = 'expense_tracker_theme'

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) setIsSignedIn(true)
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

  if (!isSignedIn) {
    return (
      <div className="sign-in-shell">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <SignIn onSignIn={() => setIsSignedIn(true)} />
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
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

export default App
