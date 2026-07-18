import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = { bg: "#181a1b", textDim: "#5f6568" }

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase automatically parses the URL fragment for the token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard')
      } else {
        navigate('/login')
      }
    })
  }, [navigate])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
      background: C.bg, color: C.textDim, fontFamily: 'system-ui', fontSize: 13,
    }}>Completing sign in</div>
  )
}
