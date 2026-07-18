import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const C = {
  surface: "#1f2223", surfaceAlt: "#26292b", border: "#2e3234",
  text: "#ececec", textMuted: "#9ba1a6", textDim: "#5f6568",
  accent: "#4cc2c9", accentDim: "#153b3d",
  red: "#e5484d",
}

function PlanBadge({ plan }) {
  const isPro = plan === 'pro'
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
      padding: '2px 6px', borderRadius: 4,
      background: isPro ? C.accentDim : C.surfaceAlt,
      color: isPro ? C.accent : C.textDim,
      border: isPro ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
    }}>
      {isPro ? 'PRO' : 'FREE'}
    </span>
  )
}

export default function UserMenu() {
  const { user, plan, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) return null

  const initial = (user.email || '?').charAt(0).toUpperCase()
  const displayName = user.user_metadata?.full_name || user.email
  const isPro = plan === 'pro'

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 4px',
        background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 20, cursor: 'pointer',
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%', background: C.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: C.text,
        }}>{initial}</span>
        <span style={{ fontSize: 11.5, color: C.textMuted }}>{user.email?.split('@')[0]}</span>
        <PlanBadge plan={plan} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{
            position: 'fixed', inset: 0, zIndex: 100,
          }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 6,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
            minWidth: 240, zIndex: 101, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{displayName}</div>
                <PlanBadge plan={plan} />
              </div>
              {displayName !== user.email && (
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{user.email}</div>
              )}
            </div>

            {!isPro && (
              <button onClick={() => { setOpen(false); window.location.href = '/upgrade' }} style={{
                width: '100%', padding: '10px 14px', background: 'transparent', border: 'none',
                cursor: 'pointer', color: C.accent, fontSize: 12, textAlign: 'left', fontWeight: 600,
                borderBottom: `1px solid ${C.border}`,
              }}>Upgrade to Pro →</button>
            )}

            <button onClick={() => { setOpen(false); signOut() }} style={{
              width: '100%', padding: '9px 14px', background: 'transparent', border: 'none',
              cursor: 'pointer', color: C.red, fontSize: 12, textAlign: 'left',
            }}>Sign out</button>
          </div>
        </>
      )}
    </div>
  )
}
