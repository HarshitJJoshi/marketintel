import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [plan, setPlan] = useState('free')
  const [loading, setLoading] = useState(true)

  const fetchPlan = async (userId) => {
    if (!userId) { setPlan('free'); return }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', userId)
        .single()
      if (error) throw error
      setPlan(data?.plan || 'free')
    } catch (e) {
      console.error('Plan fetch failed:', e)
      setPlan('free')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchPlan(u.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchPlan(u.id)
      else setPlan('free')
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setPlan('free')
  }

  const isPro = plan === 'pro'

  return (
    <AuthContext.Provider value={{ user, plan, isPro, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
