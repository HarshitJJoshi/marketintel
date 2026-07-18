import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const C = {
  bg: "#181a1b", surface: "#1f2223", surfaceAlt: "#26292b", border: "#2e3234",
  text: "#ececec", textMuted: "#9ba1a6", textDim: "#5f6568",
  green: "#22c07a", red: "#e5484d", amber: "#d5a439",
  accent: "#4cc2c9", accentDim: "#153b3d",
}

const S = {
  num: { fontVariantNumeric: "tabular-nums", fontFamily: "'SF Mono', 'Roboto Mono', monospace" },
}

const FEATURES = [
  { title: "12-signal composite score", body: "Price momentum, sentiment, buzz, fundamentals, analyst targets, short interest and more. One number tells you where a ticker stands." },
  { title: "Congressional trading tracker", body: "Buy and sell clusters from senators and representatives, scraped daily. See what politicians are trading before it moves markets." },
  { title: "Real-time macro context", body: "CNN Fear & Greed Index and VIX shown at all times. Every score is adjusted for market regime." },
  { title: "Portfolio strategies", body: "Aggressive, balanced and conservative allocations built from live signals. 30-day volatility and beta feed the risk routing." },
  { title: "Sector heatmap", body: "See which sectors are moving and which tickers are driving them at a glance." },
  { title: "Personal watchlist", body: "Track your own tickers alongside the top picks. Your scores update daily." },
]

export default function Landing() {
  const { user } = useAuth()

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
        <span style={{ fontSize: 14.5, fontWeight: 750, letterSpacing: '-0.3px' }}>MarketIntel</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {user ? (
            <Link to="/dashboard" style={{
              fontSize: 12.5, fontWeight: 550, padding: '6px 14px', borderRadius: 7,
              background: C.accent, color: C.bg, textDecoration: 'none',
            }}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" style={{
                fontSize: 12.5, fontWeight: 550, padding: '6px 14px', borderRadius: 7,
                background: 'transparent', color: C.textMuted, textDecoration: 'none',
              }}>Log in</Link>
              <Link to="/signup" style={{
                fontSize: 12.5, fontWeight: 550, padding: '6px 14px', borderRadius: 7,
                background: C.accent, color: C.bg, textDecoration: 'none',
              }}>Sign up free</Link>
            </>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '4rem 1.5rem 2rem' }}>
        {/* Hero */}
        <section style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{
            display: 'inline-block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: C.accent, background: C.accentDim,
            padding: '4px 12px', borderRadius: 6, marginBottom: 20,
          }}>Daily market intelligence</div>
          <h1 style={{
            fontSize: 42, fontWeight: 750, letterSpacing: '-0.8px', lineHeight: 1.15,
            marginBottom: 16, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto',
          }}>
            12 signals per ticker,<br/>updated every morning
          </h1>
          <p style={{
            fontSize: 15, color: C.textMuted, maxWidth: 560, margin: '0 auto 32px',
            lineHeight: 1.5,
          }}>
            MarketIntel aggregates price momentum, congressional trades, analyst targets,
            short interest, and social sentiment into one composite score. Built for retail investors
            who want institutional-grade signals.
          </p>
          <Link to="/signup" style={{
            display: 'inline-block', fontSize: 14, fontWeight: 650, padding: '11px 24px',
            background: C.accent, color: C.bg, textDecoration: 'none', borderRadius: 8,
          }}>Sign up free</Link>
          <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 12 }}>No credit card required</div>
        </section>

        {/* Preview strip */}
        <section style={{
          marginBottom: '3.5rem',
          background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: '20px 24px',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
          }}>
            {[
              { label: "Top pick today", value: "META", sub: "score 72.6", subColor: C.green },
              { label: "Congress buying", value: "9", sub: "cluster signals", subColor: C.accent },
              { label: "Fear & Greed", value: "46.3", sub: "neutral", subColor: C.textDim },
              { label: "Tickers tracked", value: "200+", sub: "updated daily", subColor: C.textDim },
            ].map((m, i) => (
              <div key={m.label} style={{
                padding: '0 20px',
                borderRight: i < 3 ? `1px solid ${C.border}` : 'none',
              }}>
                <div style={{
                  fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em',
                  textTransform: 'uppercase', color: C.textDim, marginBottom: 6,
                }}>{m.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>{m.value}</div>
                <div style={{ ...S.num, fontSize: 11.5, marginTop: 2, color: m.subColor }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features grid */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: C.textDim, marginBottom: 14, textAlign: 'center',
          }}>What you get</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12,
          }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`,
                padding: '18px 22px',
              }}>
                <div style={{ fontSize: 13.5, fontWeight: 650, color: C.text, marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{
          textAlign: 'center', padding: '3rem 2rem',
          background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
          marginBottom: '3.5rem',
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.3px' }}>
            Start tracking signals today
          </h2>
          <p style={{ fontSize: 13.5, color: C.textMuted, marginBottom: 22, maxWidth: 460, margin: '0 auto 22px' }}>
            Free tier includes top picks and macro overview. Pro tier unlocks the full signal breakdown, congress feed and historical tracking.
          </p>
          <Link to="/signup" style={{
            display: 'inline-block', fontSize: 14, fontWeight: 650, padding: '11px 24px',
            background: C.accent, color: C.bg, textDecoration: 'none', borderRadius: 8,
          }}>Sign up free</Link>
        </section>

        <footer style={{
          textAlign: 'center', fontSize: 11.5, color: C.textDim, paddingTop: '2rem',
          borderTop: `1px solid ${C.border}`,
        }}>
          <div>MarketIntel is not a licensed broker or financial advisor. Signals are informational only.</div>
          <div style={{ marginTop: 6 }}>Data sources: yfinance, Reddit, SEC EDGAR, Capitol Trades, StockTwits, CNN Fear &amp; Greed, CBOE VIX.</div>
        </footer>
      </main>
    </div>
  )
}
