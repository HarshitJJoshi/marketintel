import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const C = { bg: "#181a1b", textDim: "#5f6568" }

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", height: "100vh",
      background: C.bg, color: C.textDim, fontFamily: "system-ui", fontSize: 13,
    }}>Loading</div>
  )

  if (!user) return <Navigate to="/login" replace />

  return children
}
