import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import Footer from '../components/Footer'

const API = "https://marketintel-production-e203.up.railway.app"

const C = {
  bg: "#0f1112", surface: "#181a1b", surfaceAlt: "#1f2223", border: "#2a2d2f",
  text: "#ececec", textMuted: "#9ba1a6", textDim: "#5f6568",
  green: "#22c07a", red: "#e5484d", amber: "#d5a439",
  accent: "#4cc2c9", accentDim: "#153b3d",
}

const mono = { fontVariantNumeric: "tabular-nums", fontFamily: "'SF Mono','Roboto Mono',monospace" }

const pct = (n) => {
  if (n == null || Number.isNaN(Number(n))) return "---"
  const v = Number(n)
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`
}

const scoreColor = (v) => v >= 60 ? C.green : v >= 45 ? C.amber : C.red

function LiveBar({ data, fg, vix }) {
  if (!data) return null
  const top = data.top5_stocks?.[0]
  return (
    <div style={{
      background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
      padding: '28px 32px', marginBottom: 48,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: C.textDim, marginBottom: 18,
      }}>Live signals - updated daily at 6 AM ET</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0 }}>
        {[
          {
            label: "Top signal",
            value: top?.ticker || "---",
            sub: top ? `score ${Number(top.composite_score).toFixed(1)}` : "",
            subColor: top ? scoreColor(top.composite_score) : C.textDim,
          },
          {
            label: "Top sector",
            value: data.top_sector || "---",
            sub: data.top_sector_change != null ? `${pct(data.top_sector_change)} 1W` : "",
            subColor: data.top_sector_change > 0 ? C.green : data.top_sector_change < 0 ? C.red : C.textDim,
          },
          {
            label: "Fear & Greed",
            value: fg?.value != null ? String(fg.value) : "---",
            sub: fg?.description || "",
            subColor: fg?.value <= 25 ? C.red : fg?.value <= 45 ? C.amber : fg?.value >= 75 ? C.green : C.textDim,
          },
          {
            label: "VIX",
            value: vix?.value != null ? String(vix.value) : "---",
            sub: vix?.signal || "",
            subColor: vix?.value >= 30 ? C.red : vix?.value >= 20 ? C.amber : C.textDim,
          },
          {
            label: "Tickers tracked",
            value: data.total_tickers ? String(data.total_tickers) : "---",
            sub: "updated daily",
            subColor: C.textDim,
          },
        ].map((m, i) => (
          <div key={m.label} style={{
            padding: '0 24px',
            borderRight: i < 4 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: C.textDim, marginBottom: 8,
            }}>{m.label}</div>
            <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>{m.value}</div>
            <div style={{ ...mono, fontSize: 11.5, marginTop: 4, color: m.subColor }}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopPicks({ stocks, etfs }) {
  if (!stocks?.length) return null
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: C.textDim, marginBottom: 16,
      }}>Today's top signals</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {(stocks || []).slice(0, 5).map((t, i) => (
          <div key={t.ticker} style={{
            background: C.surface, borderRadius: 10, border: `1px solid ${i === 0 ? C.accent : C.border}`,
            padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{t.ticker}</span>
              <span style={{ ...mono, fontSize: 14, fontWeight: 650, color: scoreColor(t.composite_score) }}>
                {Number(t.composite_score).toFixed(1)}
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: C.textDim, marginBottom: 8 }}>{t.sector}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ ...mono, fontSize: 13, color: C.text }}>
                {t.latest_close ? `$${Number(t.latest_close).toFixed(2)}` : "---"}
              </span>
              <span style={{
                ...mono, fontSize: 11.5, fontWeight: 600,
                color: (t.week_change_pct || 0) >= 0 ? C.green : C.red,
              }}>{pct(t.week_change_pct)}</span>
            </div>
          </div>
        ))}
      </div>
      {etfs?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, color: C.textDim, alignSelf: 'center', marginRight: 4 }}>TOP ETFS</span>
          {etfs.slice(0, 5).map(t => (
            <span key={t.ticker} style={{
              ...mono, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
              background: C.surfaceAlt, color: C.textMuted, border: `1px solid ${C.border}`,
            }}>
              {t.ticker} <span style={{ color: scoreColor(t.composite_score), opacity: 0.8 }}>
                {Number(t.composite_score).toFixed(0)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const FEATURES = [
  { title: "12-signal composite score", body: "Price momentum, sentiment, buzz, fundamentals, analyst targets, short interest and more. One number tells you where a ticker stands." },
  { title: "Congressional trading tracker", body: "Buy and sell clusters from senators and representatives, scraped daily from STOCK Act filings." },
  { title: "Real-time macro context", body: "CNN Fear & Greed Index and VIX shown at all times. Every score is adjusted for market regime." },
  { title: "Portfolio strategies", body: "Aggressive, balanced and conservative allocations built from live signals, volatility and beta." },
  { title: "Sector heatmap", body: "See which sectors are moving and which tickers are driving them at a glance." },
  { title: "Personal watchlist", body: "Track your own tickers alongside the top picks. Scores update daily at 6 AM." },
]

export default function Landing() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [fg, setFg] = useState(null)
  const [vix, setVix] = useState(null)

  useEffect(() => {
    axios.get(`${API}/api/summary`).then(r => setData(r.data)).catch(() => {})
    axios.get(`${API}/api/fear-greed`).then(r => setFg(r.data)).catch(() => {})
    axios.get(`${API}/api/vix`).then(r => setVix(r.data)).catch(() => {})
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Nav */}
      <div style={{
        borderBottom: `1px solid ${C.border}`, padding: '0 2.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        height: 56,
      }}>
        <span style={{ fontSize: 15, fontWeight: 750, letterSpacing: '-0.3px' }}>MarketIntel</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {user ? (
            <Link to="/dashboard" style={{
              fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 7,
              background: C.accent, color: C.bg, textDecoration: 'none',
            }}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" style={{
                fontSize: 13, fontWeight: 550, padding: '7px 16px', borderRadius: 7,
                background: 'transparent', color: C.textMuted, textDecoration: 'none',
              }}>Log in</Link>
              <Link to="/signup" style={{
                fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 7,
                background: C.accent, color: C.bg, textDecoration: 'none',
              }}>Sign up free</Link>
            </>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '4.5rem 2rem 3rem' }}>
        {/* Hero */}
        <section style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            display: 'inline-block', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: C.accent, background: C.accentDim,
            padding: '5px 14px', borderRadius: 6, marginBottom: 24,
          }}>Daily market intelligence</div>
          <h1 style={{
            fontSize: 48, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1,
            marginBottom: 20, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto',
          }}>
            12 signals per ticker,<br/>updated every morning
          </h1>
          <p style={{
            fontSize: 16, color: C.textMuted, maxWidth: 540, margin: '0 auto 36px',
            lineHeight: 1.6,
          }}>
            Price momentum, congressional trades, analyst targets, short interest, and social sentiment aggregated into one composite score.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
            <Link to="/signup" style={{
              display: 'inline-block', fontSize: 14, fontWeight: 650, padding: '12px 28px',
              background: C.accent, color: C.bg, textDecoration: 'none', borderRadius: 8,
            }}>Get started free</Link>
            <span style={{ fontSize: 12, color: C.textDim }}>No credit card required</span>
          </div>
        </section>

        {/* Live data strip */}
        <LiveBar data={data} fg={fg} vix={vix} />

        {/* Top picks from live API */}
        <TopPicks stocks={data?.top5_stocks} etfs={data?.top5_etfs} />

        {/* Features */}
        <section style={{ marginBottom: 56 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: C.textDim, marginBottom: 16, textAlign: 'center',
          }}>What you get</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
          }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`,
                padding: '22px 24px',
              }}>
                <div style={{ fontSize: 14, fontWeight: 650, color: C.text, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.55 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{
          textAlign: 'center', padding: '3.5rem 2rem',
          background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
          marginBottom: 56,
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 750, marginBottom: 12, letterSpacing: '-0.4px' }}>
            Start tracking signals today
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 24, maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.5 }}>
            Free tier includes top picks and macro overview. Pro unlocks the full signal breakdown, congress feed and historical tracking for $1/month.
          </p>
          <Link to="/signup" style={{
            display: 'inline-block', fontSize: 14, fontWeight: 650, padding: '12px 28px',
            background: C.accent, color: C.bg, textDecoration: 'none', borderRadius: 8,
          }}>Sign up free</Link>
        </section>

        <Footer>
          <div style={{ marginTop: 6 }}>Data sources: yfinance, Reddit, SEC EDGAR, Capitol Trades, StockTwits, CNN Fear & Greed, CBOE VIX.</div>
        </Footer>
      </main>
    </div>
  )
}
