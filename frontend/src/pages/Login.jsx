import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = {
  bg: "#181a1b", surface: "#1f2223", surfaceAlt: "#26292b", border: "#2e3234",
  text: "#ececec", textMuted: "#9ba1a6", textDim: "#5f6568",
  accent: "#4cc2c9", accentDim: "#153b3d", red: "#e5484d",
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) setError(error.message)
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <Link to="/" style={{ textDecoration: 'none', color: C.text, marginBottom: 40, fontSize: 18, fontWeight: 700 }}>
        MarketIntel
      </Link>

      <div style={{
        width: '100%', maxWidth: 380, background: C.surface,
        borderRadius: 12, border: `1px solid ${C.border}`, padding: '32px 28px',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.3px' }}>Welcome back</h1>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>Log in to view your dashboard</p>

        <button onClick={handleGoogleLogin} style={{
          width: '100%', padding: '10px 14px', border: `1px solid ${C.border}`,
          background: C.surfaceAlt, color: C.text, borderRadius: 8, fontSize: 13.5, fontWeight: 550,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          marginBottom: 18,
        }}>
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.3-7.2 2.3-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2c-.4.4 6.5-4.7 6.5-14.7 0-1.3-.1-2.6-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 1, background: C.border }} />
          <span style={{ fontSize: 11, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>or</span>
          <div style={{ flex: 1, height: 1, background: C.border }} />
        </div>

        <form onSubmit={handleEmailLogin}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
            style={{
              width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 7,
              background: C.bg, color: C.text, fontSize: 13, marginBottom: 10, outline: 'none',
              boxSizing: 'border-box',
            }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
            style={{
              width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 7,
              background: C.bg, color: C.text, fontSize: 13, marginBottom: 14, outline: 'none',
              boxSizing: 'border-box',
            }} />

          {error && (
            <div style={{ fontSize: 12, color: C.red, marginBottom: 14, padding: '8px 10px', background: 'rgba(229,72,77,0.08)', borderRadius: 6 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '10px', background: C.accent, color: C.bg,
            border: 'none', borderRadius: 7, fontSize: 13.5, fontWeight: 650, cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}>{loading ? 'Signing in' : 'Sign in'}</button>
        </form>

        <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 20 }}>
          Don't have an account? <Link to="/signup" style={{ color: C.accent, textDecoration: 'none', fontWeight: 550 }}>Sign up</Link>
        </div>
      </div>
    </div>
  )
}
