import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './pages/SignIn'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Summary from './pages/Summary'
import BottomNav from './components/BottomNav'
import './App.css'

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) setIsSignedIn(true)
  }, [])

  if (!isSignedIn) {
    return <SignIn onSignIn={() => setIsSignedIn(true)} />
  }

  return (
    <BrowserRouter>
      <div className="app">
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