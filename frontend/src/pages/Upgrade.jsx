import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UserMenu from '../components/UserMenu'
import Footer, { DISCLAIMER } from '../components/Footer'

const CHECKOUT_URL = "https://marketintel.lemonsqueezy.com/checkout/buy/2164254"

const C = {
  bg: "#0f1112", surface: "#181a1b", surfaceAlt: "#1f2223", border: "#2a2d2f",
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
  "Score history - track any ticker over time",
  "Portfolio strategies - aggressive, balanced, conservative",
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
      <div style={{
        borderBottom: `1px solid ${C.border}`, padding: '0 2.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        height: 56,
      }}>
        <Link to="/dashboard" style={{ textDecoration: 'none', color: C.text, fontSize: 15, fontWeight: 750, letterSpacing: '-0.3px' }}>
          MarketIntel
        </Link>
        {user && <UserMenu />}
      </div>

      <main style={{ maxWidth: 880, margin: '0 auto', padding: '4rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{
            display: 'inline-block', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: C.accent, background: C.accentDim,
            padding: '5px 14px', borderRadius: 6, marginBottom: 20,
          }}>Simple pricing</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.6px', marginBottom: 12 }}>
            Unlock the full signal
          </h1>
          <p style={{ fontSize: 15, color: C.textMuted, maxWidth: 520, margin: '0 auto', lineHeight: 1.55 }}>
            Free tier gets you a taste. Pro unlocks every signal we generate - congress, historical scores, strategies, and the full 12-signal breakdown.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Free */}
          <div style={{
            background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
            padding: '28px 30px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textDim, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Free</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 24 }}>
              <span style={{ fontSize: 36, fontWeight: 750, color: C.text }}>$0</span>
              <span style={{ fontSize: 14, color: C.textMuted }}>/ month</span>
            </div>
            <div style={{ marginBottom: 24 }}>
              {FREE_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, fontSize: 13, color: C.textMuted, marginBottom: 10, lineHeight: 1.45 }}>
                  <span style={{ color: C.textDim, flexShrink: 0 }}>-</span>{f}
                </div>
              ))}
            </div>
            {!isPro && (
              <button disabled style={{
                width: '100%', padding: '11px', background: C.surfaceAlt, color: C.textMuted,
                border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600,
              }}>Your current plan</button>
            )}
          </div>

          {/* Pro */}
          <div style={{
            background: C.surface, borderRadius: 14, border: `1px solid ${C.accent}`,
            padding: '28px 30px', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -11, right: 20,
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              <span style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
                padding: '3px 10px', borderRadius: 4,
                background: C.accent, color: C.bg,
              }}>RECOMMENDED</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Pro</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 24 }}>
              <span style={{ fontSize: 36, fontWeight: 750, color: C.text }}>$1</span>
              <span style={{ fontSize: 14, color: C.textMuted }}>/ month</span>
            </div>
            <div style={{ marginBottom: 24 }}>
              {PRO_FEATURES.map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, fontSize: 13, color: C.text, marginBottom: 10, lineHeight: 1.45 }}>
                  <span style={{ color: C.green, flexShrink: 0 }}>+</span>{f}
                </div>
              ))}
            </div>
            {isPro ? (
              <button disabled style={{
                width: '100%', padding: '11px', background: C.accentDim, color: C.accent,
                border: `1px solid ${C.accent}`, borderRadius: 8, fontSize: 13, fontWeight: 600,
              }}>Your current plan</button>
            ) : (
              <a
                href={`${CHECKOUT_URL}?checkout[email]=${encodeURIComponent(user?.email || '')}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'block', boxSizing: 'border-box', textAlign: 'center', textDecoration: 'none',
                  width: '100%', padding: '11px', background: C.accent, color: C.bg,
                  borderRadius: 8, fontSize: 13.5, fontWeight: 650,
                }}>Upgrade to Pro</a>
            )}
          </div>
        </div>

        <div style={{
          marginTop: 20, padding: '12px 16px', borderRadius: 8, fontSize: 12, lineHeight: 1.55,
          color: C.textMuted, background: C.surfaceAlt, border: `1px solid ${C.border}`, textAlign: 'center',
        }}>
          {DISCLAIMER} By subscribing you agree to our <Link to="/terms" style={{ color: C.accent }}>Terms</Link> and <Link to="/privacy" style={{ color: C.accent }}>Privacy Policy</Link>.
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <Link to="/dashboard" style={{ fontSize: 13, color: C.textMuted, textDecoration: 'none' }}>
            Back to dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
