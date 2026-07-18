import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UserMenu from '../components/UserMenu'

const C = {
  bg: "#181a1b", surface: "#1f2223", surfaceAlt: "#26292b", border: "#2e3234",
  text: "#ececec", textMuted: "#9ba1a6", textDim: "#5f6568",
  green: "#22c07a", accent: "#4cc2c9", accentDim: "#153b3d",
}

const FREE_FEATURES = [
  "Top 3 stocks + top 3 ETFs daily",
  "Sector heatmap",
  "Fear & Greed + VIX macro overview",
  "Basic ticker details",
]

const PRO_FEATURES = [
  "Full top 5 stocks + top 5 ETFs",
  "Complete 12-signal breakdown per ticker",
  "Congressional trading tracker with buy/sell clusters",
  "Analyst targets, short interest, historical momentum",
  "Score history — track any ticker over time",
  "Portfolio strategies — aggressive, balanced, conservative",
  "Advanced screening filters",
  "Personal watchlist",
]

export default function Upgrade() {
  const { user, isPro } = useAuth()

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        borderBottom: `1px solid ${C.border}`, padding: '0 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        height: 54,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link to="/dashboard" style={{ textDecoration: 'none', color: C.text, fontSize: 14.5, fontWeight: 750, letterSpacing: '-0.3px' }}>
            MarketIntel
          </Link>
        </div>
        {user && <UserMenu />}
      </div>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '3.5rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: C.accent, background: C.accentDim,
            padding: '4px 12px', borderRadius: 6, marginBottom: 16,
          }}>Simple pricing</div>
          <h1 style={{ fontSize: 32, fontWeight: 750, letterSpacing: '-0.5px', marginBottom: 10 }}>
            Unlock the full signal
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted, maxWidth: 500, margin: '0 auto', lineHeight: 1.5 }}>
            Free tier gets you a taste. Pro unlocks every signal we generate — congress, historical scores, strategies, and the full 12-signal breakdown.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
        }}>
          {/* Free */}
          <div style={{
            background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
            padding: '24px 26px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Free</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: C.text }}>$0</span>
              <span style={{ fontSize: 13, color: C.textMuted }}>/ month</span>
            </div>
            <div style={{ marginBottom: 20 }}>
              {FREE_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: C.textMuted, marginBottom: 8, lineHeight: 1.4 }}>
                  <span style={{ color: C.textDim, flexShrink: 0 }}>•</span>{f}
                </div>
              ))}
            </div>
            {!isPro && (
              <button disabled style={{
                width: '100%', padding: '10px', background: C.surfaceAlt, color: C.textMuted,
                border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontWeight: 600,
              }}>Your current plan</button>
            )}
          </div>

          {/* Pro */}
          <div style={{
            background: C.surface, borderRadius: 12, border: `1px solid ${C.accent}`,
            padding: '24px 26px', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -10, right: 20,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              padding: '3px 10px', borderRadius: 4,
              background: C.accent, color: C.bg,
            }}>RECOMMENDED</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Pro</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: C.text }}>$9</span>
              <span style={{ fontSize: 13, color: C.textMuted }}>/ month</span>
            </div>
            <div style={{ marginBottom: 20 }}>
              {PRO_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: C.text, marginBottom: 8, lineHeight: 1.4 }}>
                  <span style={{ color: C.green, flexShrink: 0 }}>✓</span>{f}
                </div>
              ))}
            </div>
            {isPro ? (
              <button disabled style={{
                width: '100%', padding: '10px', background: C.accentDim, color: C.accent,
                border: `1px solid ${C.accent}`, borderRadius: 7, fontSize: 13, fontWeight: 600,
              }}>Your current plan</button>
            ) : (
              <button disabled style={{
                width: '100%', padding: '10px', background: C.accent, color: C.bg,
                border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 650, cursor: 'not-allowed', opacity: 0.7,
              }}>Payment coming soon</button>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/dashboard" style={{ fontSize: 12.5, color: C.textMuted, textDecoration: 'none' }}>
            ← Back to dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}
