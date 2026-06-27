import { useState, useEffect, useCallback } from "react"
import axios from "axios"

const API = "http://localhost:8000"
const fmt = (n, d = 2) => n != null ? Number(n).toFixed(d) : "—"
const fmtCap = (n) => {
  if (!n) return "—"
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n/1e9).toFixed(1)}B`
  return `$${(n/1e6).toFixed(0)}M`
}

// ─── Design tokens ───────────────────────────────────────────────
const C = {
  bg: "#0d1117",
  surface: "#161b22",
  surfaceAlt: "#1c2230",
  border: "#30363d",
  borderLight: "#21262d",
  text: "#e6edf3",
  textMuted: "#8b949e",
  textDim: "#484f58",
  green: "#3fb950",
  greenDim: "#1a3c20",
  greenText: "#56d364",
  red: "#f85149",
  redDim: "#3c1a1a",
  redText: "#ff7b72",
  amber: "#d29922",
  amberDim: "#3c2a0a",
  amberText: "#e3b341",
  purple: "#7c6fcd",
  purpleDim: "#1e1a3c",
  purpleText: "#a78bfa",
  blue: "#388bfd",
  blueDim: "#0d2044",
  accent: "#58a6ff",
}

const S = {
  card: {
    background: C.surface,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: C.textMuted,
  },
  mono: {
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  }
}

// ─── Micro components ────────────────────────────────────────────
function Sparkline({ data, width = 100, height = 32 }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i/(data.length-1))*width},${height - ((v-min)/range)*(height-4) - 2}`).join(" ")
  const up = data[data.length-1] >= data[0]
  return (
    <svg width={width} height={height} style={{display:"block"}}>
      <polyline points={pts} fill="none" stroke={up ? C.green : C.red} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

function ScoreRing({ value, size = 56 }) {
  const r = (size/2) - 5
  const circ = 2 * Math.PI * r
  const color = value >= 60 ? C.green : value >= 45 ? C.amber : C.red
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${(value/100)*circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2+5} textAnchor="middle" fontSize={11} fontWeight={700}
        fill={color} fontFamily="'SF Mono',monospace">{value}</text>
    </svg>
  )
}

function Badge({ children, color = "default", style = {} }) {
  const colors = {
    green: { bg: C.greenDim, text: C.greenText, border: "#2ea043" },
    red: { bg: C.redDim, text: C.redText, border: "#da3633" },
    amber: { bg: C.amberDim, text: C.amberText, border: "#9e6a03" },
    purple: { bg: C.purpleDim, text: C.purpleText, border: "#6e40c9" },
    blue: { bg: C.blueDim, text: C.accent, border: "#1f6feb" },
    default: { bg: C.surfaceAlt, text: C.textMuted, border: C.border },
  }
  const c = colors[color] || colors.default
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      display: "inline-block", ...style
    }}>{children}</span>
  )
}

function SignalBar({ label, value, color, icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: C.textMuted, width: 130, flexShrink: 0 }}>
        {icon && <span style={{marginRight:4}}>{icon}</span>}{label}
      </div>
      <div style={{ flex: 1, background: C.border, borderRadius: 3, height: 6 }}>
        <div style={{ width: `${Math.min(100,Math.max(0,value))}%`, height: 6, borderRadius: 3, background: color, transition:"width 0.4s" }}/>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, width: 28, textAlign: "right", ...S.mono, color: C.text }}>
        {Math.round(value)}
      </div>
    </div>
  )
}

function YearBar({ low, high, current }) {
  if (!low || !high || low >= high) return null
  const pct = Math.min(100, Math.max(0, ((current-low)/(high-low))*100))
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:C.textMuted, marginBottom:4 }}>
        <span>${fmt(low)}</span><span>52w range</span><span>${fmt(high)}</span>
      </div>
      <div style={{ background: C.border, borderRadius: 4, height: 5, position:"relative" }}>
        <div style={{ width:`${pct}%`, height:5, borderRadius:4, background:`linear-gradient(90deg, ${C.red}, ${C.amber}, ${C.green})` }}/>
        <div style={{ position:"absolute", left:`${pct}%`, top:-3, transform:"translateX(-50%)",
          width:11, height:11, borderRadius:"50%", background:C.accent, border:`2px solid ${C.bg}` }}/>
      </div>
    </div>
  )
}

function HistoryChart({ history, width = 500 }) {
  if (!history || history.length < 2) return (
    <div style={{ fontSize:12, color:C.textDim, textAlign:"center", padding:"1rem",
      background:C.surfaceAlt, borderRadius:8, border:`1px solid ${C.border}` }}>
      History builds as pipeline runs daily
    </div>
  )
  const height = 110
  const padL = 32, padR = 12, padT = 8, padB = 20
  const W = width - padL - padR, H = height - padT - padB
  const scores = history.map(h => h.composite_score)
  const dates = history.map(h => h.date)
  const minS = Math.min(...scores), maxS = Math.max(...scores)
  const rangeS = maxS - minS || 1
  const pts = scores.map((v,i) => {
    const x = padL + (i/(scores.length-1))*W
    const y = padT + H - ((v-minS)/rangeS)*H
    return `${x},${y}`
  }).join(" ")
  const step = Math.ceil(dates.length / 5)
  const labelIdx = dates.reduce((acc,d,i) => { if(i%step===0||i===dates.length-1) acc.push(i); return acc }, [])
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.purple} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={C.purple} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0,0.5,1].map((pct,i) => {
        const y = padT + H - pct*H
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL+W} y2={y} stroke={C.border} strokeWidth="0.5"/>
            <text x={padL-4} y={y+4} textAnchor="end" fontSize={8} fill={C.textDim}>
              {Math.round(minS+pct*rangeS)}
            </text>
          </g>
        )
      })}
      <polygon points={`${padL},${padT+H} ${pts} ${padL+W},${padT+H}`} fill="url(#hg)"/>
      <polyline points={pts} fill="none" stroke={C.purple} strokeWidth="2" strokeLinejoin="round"/>
      {scores.map((v,i) => {
        const x = padL+(i/(scores.length-1))*W
        const y = padT+H-((v-minS)/rangeS)*H
        return <circle key={i} cx={x} cy={y} r="3" fill={C.purple} stroke={C.bg} strokeWidth="1.5"/>
      })}
      {labelIdx.map(idx => {
        const x = padL+(idx/(dates.length-1))*W
        const d = dates[idx]
        return <text key={idx} x={x} y={height-4} textAnchor="middle" fontSize={8} fill={C.textDim}>
          {`${d.slice(4,6)}/${d.slice(6,8)}`}
        </text>
      })}
    </svg>
  )
}

function SentimentChart({ history, width = 500 }) {
  if (!history || history.length < 2) return null
  const height = 70
  const padL = 32, padR = 12, padT = 6, padB = 6
  const W = width - padL - padR, H = height - padT - padB
  const vals = history.map(h => h.avg_sentiment || 0)
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      <line x1={padL} y1={padT+H/2} x2={padL+W} y2={padT+H/2} stroke={C.border} strokeWidth="1" strokeDasharray="3 3"/>
      {vals.map((v,i) => {
        const x = padL + (i/vals.length)*W
        const bw = Math.max(2, W/vals.length - 1)
        const zY = padT+H/2
        const bH = Math.abs((v/2)*H)
        const y = v >= 0 ? zY - bH : zY
        return <rect key={i} x={x} y={y} width={bw} height={Math.max(1,bH)}
          fill={v>0.1?C.green:v<-0.1?C.red:C.amber} opacity="0.8" rx="1"/>
      })}
      <text x={padL-4} y={padT+6} textAnchor="end" fontSize={7} fill={C.textDim}>+1</text>
      <text x={padL-4} y={padT+H/2+4} textAnchor="end" fontSize={7} fill={C.textDim}>0</text>
      <text x={padL-4} y={padT+H-1} textAnchor="end" fontSize={7} fill={C.textDim}>-1</text>
    </svg>
  )
}

// ─── Modal ───────────────────────────────────────────────────────
function Modal({ ticker, data, onClose }) {
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState(null)
  const t = [...(data.top5_stocks||[]), ...(data.top5_etfs||[])].find(x => x.ticker === ticker)

  useEffect(() => {
    setDetail(null); setHistory(null)
    axios.get(`${API}/api/ticker/${ticker}/detail`).then(r => setDetail(r.data))
    axios.get(`${API}/api/history/${ticker}`).then(r => setHistory(r.data.history))
  }, [ticker])

  const r = t?.reasoning || {}
  const p = detail?.price_data || {}
  const priceHistory = p.price_history || t?.price_history || []
  const headlines = detail?.headlines || []
  const up = (t?.week_change_pct || 0) >= 0

  const sentColor = (s) => s > 0.1 ? C.green : s < -0.1 ? C.red : C.amber
  const sentLabel = (s) => s > 0.1 ? "bullish" : s < -0.1 ? "bearish" : "neutral"
  const sentBadge = (s) => s > 0.1 ? "green" : s < -0.1 ? "red" : "amber"

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:200, padding:"1rem", backdropFilter:"blur(4px)"
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background: C.surface, borderRadius:16, padding:"1.5rem",
        width:"100%", maxWidth:600, maxHeight:"90vh", overflowY:"auto",
        border:`1px solid ${C.border}`,
        boxShadow:"0 32px 80px rgba(0,0,0,0.6)"
      }}>
        {/* Header */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20}}>
          <div>
            <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:4}}>
              <span style={{fontSize:24, fontWeight:700, ...S.mono, color:C.text}}>{ticker}</span>
              <Badge color={t?.is_etf ? "purple" : "green"}>{t?.is_etf ? "ETF" : "Stock"}</Badge>
              {(t?.volume_spike||p.volume_spike) > 1.5 && (
                <Badge color="amber">⚡ {(t?.volume_spike||p.volume_spike)}x vol</Badge>
              )}
              {t?.congress_signal && t.congress_signal !== "neutral" && t.congress_signal !== "no_data" && (
                <Badge color={t.congress_signal.includes("buy") ? "green" : "red"}>
                  🏛 {t.congress_signal.replace("_"," ")}
                </Badge>
              )}
            </div>
            <div style={{fontSize:12, color:C.textMuted}}>{t?.sector}</div>
          </div>
          <button onClick={onClose} style={{
            background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8,
            width:32, height:32, cursor:"pointer", fontSize:14, color:C.textMuted,
            display:"flex", alignItems:"center", justifyContent:"center"
          }}>✕</button>
        </div>

        {/* Price row */}
        <div style={{background:C.surfaceAlt, borderRadius:12, padding:"16px", marginBottom:14, border:`1px solid ${C.border}`}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:16}}>
            <div>
              <div style={{fontSize:28, fontWeight:700, letterSpacing:"-1px", ...S.mono, color:C.text, marginBottom:2}}>
                ${fmt(t?.latest_close || p.latest_close)}
              </div>
              <div style={{fontSize:14, fontWeight:600, marginBottom:12,
                color: up ? C.green : C.red}}>
                {up ? "▲" : "▼"} {Math.abs(t?.week_change_pct||0).toFixed(2)}% this week
              </div>
              {priceHistory.length > 1
                ? <><Sparkline data={priceHistory} width={200} height={40}/>
                    <div style={{fontSize:10, color:C.textDim, marginTop:2}}>30-day price</div></>
                : <div style={{fontSize:11, color:C.textDim, height:40, display:"flex", alignItems:"center"}}>Loading chart...</div>
              }
            </div>
            <div style={{display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4}}>
              <ScoreRing value={t?.composite_score||0} size={60}/>
              <div style={{fontSize:10, color:C.textMuted}}>score</div>
            </div>
          </div>
          {(p.year_high||t?.year_high) > 0 && (
            <YearBar low={p.year_low||t?.year_low} high={p.year_high||t?.year_high}
              current={t?.latest_close||p.latest_close}/>
          )}
        </div>

        {/* Stats grid */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14}}>
          {[
            {label:"Market cap", value:fmtCap(p.market_cap||t?.market_cap)},
            {label:"P/E ratio", value:(p.pe_ratio||t?.pe_ratio) ? fmt(p.pe_ratio||t?.pe_ratio,1) : "—"},
            {label:"Revenue growth", value: t?.revenue_growth != null ? `${t.revenue_growth>0?"+":""}${t.revenue_growth}%` : "—"},
            {label:"Profit margin", value: t?.profit_margin != null ? `${t.profit_margin}%` : "—"},
            {label:"Debt/Equity", value: t?.debt_equity != null ? fmt(t.debt_equity,2) : "—"},
            {label:"Earnings beats", value: t?.earnings_surprise || "—"},
            {label:"RSI", value: t?.rsi || "—"},
            {label:"Institutions", value: t?.major_institutions != null ? `${t.major_institutions} major` : "—"},
            {label:"Insider filings", value: t?.insider_count != null ? `${t.insider_count} Form 4s` : "—"},
          ].map(m => (
            <div key={m.label} style={{background:C.bg, borderRadius:8, padding:"10px 12px", border:`1px solid ${C.border}`}}>
              <div style={{...S.label, marginBottom:3}}>{m.label}</div>
              <div style={{fontSize:13, fontWeight:600, color:C.text}}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* NEW: Analyst + Short Interest + Congress row */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14}}>
          {/* Analyst */}
          <div style={{background:C.bg, borderRadius:8, padding:"10px 12px", border:`1px solid ${C.border}`}}>
            <div style={{...S.label, marginBottom:6}}>📊 Analyst target</div>
            {t?.analyst_target ? (
              <>
                <div style={{fontSize:14, fontWeight:700, color:C.text, ...S.mono}}>${fmt(t.analyst_target)}</div>
                <div style={{fontSize:11, fontWeight:600, marginTop:2,
                  color: t.analyst_upside > 0 ? C.green : C.red}}>
                  {t.analyst_upside > 0 ? "+" : ""}{fmt(t.analyst_upside,1)}% upside
                </div>
                {t.analyst_rating && (
                  <Badge color={t.analyst_rating==="buy"?"green":t.analyst_rating==="sell"?"red":"default"}
                    style={{marginTop:4}}>
                    {t.analyst_rating}
                  </Badge>
                )}
                {(t.recent_upgrades > 0 || t.recent_downgrades > 0) && (
                  <div style={{fontSize:10, color:C.textMuted, marginTop:4}}>
                    {t.recent_upgrades > 0 && <span style={{color:C.green}}>↑{t.recent_upgrades} upgrades </span>}
                    {t.recent_downgrades > 0 && <span style={{color:C.red}}>↓{t.recent_downgrades} downgrades</span>}
                  </div>
                )}
              </>
            ) : <div style={{fontSize:12, color:C.textDim}}>No data</div>}
          </div>

          {/* Short Interest */}
          <div style={{background:C.bg, borderRadius:8, padding:"10px 12px", border:`1px solid ${C.border}`}}>
            <div style={{...S.label, marginBottom:6}}>🩳 Short interest</div>
            {t?.short_float_pct != null ? (
              <>
                <div style={{fontSize:14, fontWeight:700, ...S.mono,
                  color: t.short_float_pct > 20 ? C.red : t.short_float_pct > 10 ? C.amber : C.text}}>
                  {fmt(t.short_float_pct,1)}% float
                </div>
                <div style={{fontSize:11, color:C.textMuted, marginTop:2}}>
                  {t.short_ratio ? `${fmt(t.short_ratio,1)} days to cover` : ""}
                </div>
                <Badge color={t.short_float_pct > 20 ? "red" : t.short_float_pct > 10 ? "amber" : "default"}
                  style={{marginTop:4}}>
                  {t.short_signal?.replace("_"," ") || "low"}
                </Badge>
              </>
            ) : <div style={{fontSize:12, color:C.textDim}}>No data</div>}
          </div>

          {/* Congress */}
          <div style={{background:C.bg, borderRadius:8, padding:"10px 12px", border:`1px solid ${C.border}`}}>
            <div style={{...S.label, marginBottom:6}}>🏛 Congress trades</div>
            {t?.congress_signal && t.congress_signal !== "no_data" ? (
              <>
                <div style={{display:"flex", gap:10, marginBottom:4}}>
                  <span style={{fontSize:13, fontWeight:700, color:C.green}}>
                    {t.congress_buys || 0}B
                  </span>
                  <span style={{fontSize:13, fontWeight:700, color:C.red}}>
                    {t.congress_sells || 0}S
                  </span>
                </div>
                <Badge color={t.congress_signal.includes("buy") ? "green" : t.congress_signal.includes("sell") ? "red" : "default"}>
                  {t.congress_signal.replace(/_/g," ")}
                </Badge>
                {t.congress_buyers?.length > 0 && (
                  <div style={{fontSize:10, color:C.textMuted, marginTop:4, lineHeight:1.4}}>
                    {t.congress_buyers.slice(0,2).join(", ")}
                    {t.congress_buyers.length > 2 ? ` +${t.congress_buyers.length-2} more` : ""}
                  </div>
                )}
              </>
            ) : (
              <div style={{fontSize:12, color:C.textDim}}>No activity</div>
            )}
          </div>
        </div>

        {/* Signal confluence */}
        {t?.bullish_signals != null && (
          <div style={{
            marginBottom:14, borderRadius:10, padding:"12px 14px",
            background: t.bullish_signals >= 6 ? `${C.greenDim}` : t.bullish_signals >= 4 ? C.amberDim : C.surfaceAlt,
            border: `1px solid ${t.bullish_signals >= 6 ? "#2ea043" : t.bullish_signals >= 4 ? "#9e6a03" : C.border}`
          }}>
            <div style={{...S.label, marginBottom:8}}>Signal confluence</div>
            <div style={{display:"flex", alignItems:"center", gap:10}}>
              <div style={{display:"flex", gap:3}}>
                {Array.from({length:12}).map((_,i) => (
                  <div key={i} style={{
                    width:14, height:14, borderRadius:3,
                    background: i < t.bullish_signals
                      ? t.bullish_signals >= 6 ? C.green : t.bullish_signals >= 4 ? C.amber : C.textMuted
                      : C.border,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:8, color:C.bg, fontWeight:700
                  }}>{i < t.bullish_signals ? "✓" : ""}</div>
                ))}
              </div>
              <div style={{fontSize:12, color:C.text, fontWeight:500}}>
                {t.bullish_signals}/12
                {t.bullish_signals >= 7 && " — highest conviction"}
                {t.bullish_signals >= 5 && t.bullish_signals < 7 && " — strong setup"}
                {t.bullish_signals < 5 && " — mixed signals"}
              </div>
            </div>
          </div>
        )}

        {/* Signal breakdown - 12 signals */}
        <div style={{background:C.surfaceAlt, borderRadius:12, padding:"14px 16px", marginBottom:14, border:`1px solid ${C.border}`}}>
          <div style={{...S.label, marginBottom:12}}>Signal breakdown</div>
          <SignalBar label="Price + RSI + breakout" value={t?.price_score||0} color={C.blue} icon="📈"/>
          <SignalBar label="FinBERT sentiment" value={t?.sentiment_score||0}
            color={sentColor(t?.avg_sentiment||0)} icon="🧠"/>
          <SignalBar label="Social buzz" value={t?.buzz_score||0} color={C.purple} icon="💬"/>
          <SignalBar label="StockTwits" value={t?.st_score||0} color="#0ea5e9" icon="📡"/>
          <SignalBar label="Fundamentals" value={t?.fundamental_score||50} color={C.green} icon="💰"/>
          <SignalBar label="Analyst targets" value={t?.analyst_score||50} color={C.accent} icon="📊"/>
          <SignalBar label="Short interest" value={t?.short_score||50} color={C.amber} icon="🩳"/>
          <SignalBar label="Congress trades" value={t?.congress_score||50} color="#e879f9" icon="🏛"/>
          <SignalBar label="Insider activity" value={t?.insider_count > 0 ? 75 : 50} color={C.red} icon="👤"/>
          <SignalBar label="Institutions" value={Math.min(100,(t?.major_institutions||0)*20+40)} color="#7c3aed" icon="🏢"/>
          <SignalBar label="Google Trends" value={t?.trends_score||50} color="#f97316" icon="🔍"/>
          <SignalBar label="Options flow" value={t?.options_score||50} color="#06b6d4" icon="⚡"/>
        </div>

        {/* History charts */}
        <div style={{marginBottom:14}}>
          <div style={{...S.label, marginBottom:8}}>Score history</div>
          <HistoryChart history={history} width={520}/>
          {history && history.length > 1 && (
            <>
              <div style={{...S.label, marginBottom:4, marginTop:10}}>Sentiment trend</div>
              <SentimentChart history={history} width={520}/>
            </>
          )}
        </div>

        {/* Signal interpretation */}
        {r.signal_call && (
          <div style={{marginBottom:14}}>
            <div style={{...S.label, marginBottom:8}}>Signal interpretation</div>
            <div style={{
              borderRadius:10, padding:"12px 14px", marginBottom:8,
              background: r.signal_color==="green" ? C.greenDim : r.signal_color==="red" ? C.redDim : C.amberDim,
              border:`1px solid ${r.signal_color==="green"?"#2ea043":r.signal_color==="red"?"#da3633":"#9e6a03"}`
            }}>
              <div style={{fontSize:11, fontWeight:700, letterSpacing:"0.05em", marginBottom:4,
                color:r.signal_color==="green"?C.greenText:r.signal_color==="red"?C.redText:C.amberText}}>
                {r.signal_call}
              </div>
              <div style={{fontSize:12, lineHeight:1.5,
                color:r.signal_color==="green"?C.greenText:r.signal_color==="red"?C.redText:C.amberText}}>
                {r.signal_desc}
              </div>
            </div>
            <div style={{background:C.bg, borderRadius:8, padding:"10px 12px", marginBottom:6, border:`1px solid ${C.border}`}}>
              <div style={{fontSize:10, fontWeight:600, color:C.purple, marginBottom:4}}>Reddit signal</div>
              <div style={{fontSize:12, color:C.textMuted, lineHeight:1.5}}>{r.reddit_interp}</div>
            </div>
            <div style={{background:C.bg, borderRadius:8, padding:"10px 12px", border:`1px solid ${C.border}`}}>
              <div style={{fontSize:10, fontWeight:600, marginBottom:4,
                color:sentColor(t?.avg_sentiment||0)}}>Sentiment signal</div>
              <div style={{fontSize:12, color:C.textMuted, lineHeight:1.5}}>{r.sentiment_interp}</div>
            </div>
          </div>
        )}

        {/* Why picked */}
        <div style={{marginBottom:14}}>
          <div style={{...S.label, marginBottom:8}}>Why this pick</div>
          {r.thesis && (
            <div style={{fontSize:12, color:C.textMuted, fontStyle:"italic", marginBottom:8,
              borderLeft:`3px solid ${C.purple}`, paddingLeft:10, lineHeight:1.5}}>{r.thesis}</div>
          )}
          {(r.reasons||[]).map((reason,i) => (
            <div key={i} style={{display:"flex", gap:8, fontSize:12, color:C.textMuted, marginBottom:4}}>
              <span style={{color:C.green, flexShrink:0}}>✓</span>{reason}
            </div>
          ))}
        </div>

        {/* Watch out */}
        {(r.watches||[]).filter(w => w !== "monitor for broader market shifts").length > 0 && (
          <div style={{background:C.amberDim, border:`1px solid #9e6a03`, borderRadius:10,
            padding:"12px 14px", marginBottom:14}}>
            <div style={{...S.label, color:C.amberText, marginBottom:6}}>Watch out for</div>
            {r.watches.map((w,i) => (
              <div key={i} style={{display:"flex", gap:8, fontSize:12, color:C.amberText, marginBottom:4}}>
                <span style={{flexShrink:0}}>⚠</span>{w}
              </div>
            ))}
          </div>
        )}

        {/* Related tickers */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14}}>
          {r.related_etfs?.length > 0 && (
            <div style={{background:C.bg, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}`}}>
              <div style={{...S.label, marginBottom:6}}>Related ETFs</div>
              <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
                {r.related_etfs.map(e => (
                  <button key={e} onClick={()=>onClose(e)} style={{
                    fontSize:11, ...S.mono, fontWeight:600, padding:"2px 8px", borderRadius:6,
                    border:`1px solid ${C.border}`, background:C.surfaceAlt, color:C.purpleText, cursor:"pointer"
                  }}>{e}</button>
                ))}
              </div>
            </div>
          )}
          {r.watch_also?.length > 0 && (
            <div style={{background:C.bg, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}`}}>
              <div style={{...S.label, marginBottom:6}}>Watch also</div>
              <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
                {r.watch_also.map(e => (
                  <span key={e} style={{fontSize:11, ...S.mono, fontWeight:600, padding:"2px 8px",
                    borderRadius:6, border:`1px solid ${C.border}`, background:C.surfaceAlt, color:C.textMuted}}>
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Earnings */}
        {(p.earnings_date||t?.earnings_date) && (
          <div style={{background:C.amberDim, border:`1px solid #9e6a03`,
            borderRadius:8, padding:"8px 12px", marginBottom:14, fontSize:12, color:C.amberText}}>
            📅 Earnings: {p.earnings_date||t?.earnings_date}
          </div>
        )}

        {/* News */}
        {!detail && <div style={{fontSize:12, color:C.textDim, textAlign:"center", padding:"1rem"}}>Loading news...</div>}
        {detail && headlines.length > 0 && (
          <div>
            <div style={{...S.label, marginBottom:8}}>Recent news</div>
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {headlines.map((h,i) => (
                <a key={i} href={h.url} target="_blank" rel="noreferrer" style={{
                  display:"block", padding:"10px 12px", background:C.bg,
                  borderRadius:8, textDecoration:"none", color:C.text,
                  borderLeft:`3px solid ${C.border}`, border:`1px solid ${C.border}`
                }}>
                  <div style={{fontSize:12, lineHeight:1.4, marginBottom:3}}>{h.title}</div>
                  <div style={{fontSize:10, color:C.textDim}}>{h.source}</div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Ticker Card ─────────────────────────────────────────────────
function TickerCard({ t, rank, onClick }) {
  const up = t.week_change_pct >= 0
  const sentColor = t.avg_sentiment > 0.1 ? C.green : t.avg_sentiment < -0.1 ? C.red : C.amber
  const sentLabel = t.avg_sentiment > 0.1 ? "bullish" : t.avg_sentiment < -0.1 ? "bearish" : "neutral"
  const sentBadge = t.avg_sentiment > 0.1 ? "green" : t.avg_sentiment < -0.1 ? "red" : "amber"

  return (
    <div onClick={() => onClick(t.ticker)} style={{
      ...S.card,
      padding:"14px",
      cursor:"pointer",
      transition:"border-color 0.15s, transform 0.15s",
      ...(rank === 1 ? {borderColor:C.purple, boxShadow:`0 0 0 1px ${C.purple}40`} : {})
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.transform="translateY(-2px)" }}
    onMouseLeave={e => { e.currentTarget.style.borderColor=rank===1?C.purple:C.border; e.currentTarget.style.transform="translateY(0)" }}
    >
      {rank === 1 && (
        <div style={{fontSize:9, background:C.purpleDim, color:C.purpleText,
          padding:"2px 7px", borderRadius:10, fontWeight:700, letterSpacing:"0.06em",
          display:"inline-block", marginBottom:8, border:`1px solid ${C.purple}50`}}>
          TOP PICK
        </div>
      )}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8}}>
        <div>
          <div style={{fontSize:15, fontWeight:700, ...S.mono, color:C.text}}>{t.ticker}</div>
          <div style={{fontSize:10, color:C.textMuted, marginTop:1}}>{t.sector}</div>
        </div>
        <ScoreRing value={t.composite_score} size={48}/>
      </div>
      <div style={{marginBottom:6}}>
        <Sparkline data={t.price_history} width={150} height={26}/>
      </div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
        <span style={{fontSize:16, fontWeight:700, ...S.mono, color:C.text}}>
          {t.latest_close ? `$${fmt(t.latest_close)}` : "—"}
        </span>
        <span style={{fontSize:12, fontWeight:600, color: up ? C.green : C.red}}>
          {t.latest_close ? `${up?"+":""}${fmt(t.week_change_pct)}%` : "—"}
        </span>
      </div>
      {t.reasoning?.thesis && (
        <div style={{fontSize:10, color:C.textMuted, lineHeight:1.4, marginBottom:8,
          borderLeft:`2px solid ${C.border}`, paddingLeft:7}}>
          {t.reasoning.thesis}
        </div>
      )}
      <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
        <Badge color={sentBadge}>{sentLabel}</Badge>
        {t.mentions > 0 && <Badge color="purple">{t.mentions} mentions</Badge>}
        {t.volume_spike > 1.5 && <Badge color="amber">⚡ {t.volume_spike}x vol</Badge>}
        {t.congress_signal && t.congress_signal !== "neutral" && t.congress_signal !== "no_data" && (
          <Badge color={t.congress_signal.includes("buy") ? "green" : "red"}>
            🏛 {t.congress_signal.replace(/_/g," ")}
          </Badge>
        )}
        {t.earnings_date && <Badge color="amber">📅 {t.earnings_date}</Badge>}
      </div>
      <div style={{marginTop:10, fontSize:10, color:C.textDim, textAlign:"center"}}>
        click for full analysis →
      </div>
    </div>
  )
}

// ─── Sector components ───────────────────────────────────────────
function SectorBar({ sectors }) {
  const max = Math.max(...sectors.map(s => Math.abs(s.avg_change)))
  return (
    <div style={{display:"flex", flexDirection:"column", gap:8}}>
      {sectors.map(s => (
        <div key={s.sector} style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{fontSize:11, color:C.textMuted, width:155, flexShrink:0, textAlign:"right"}}>{s.sector}</div>
          <div style={{flex:1, background:C.border, borderRadius:3, height:7}}>
            <div style={{
              width:`${(Math.abs(s.avg_change)/max)*100}%`, height:7, borderRadius:3,
              background: s.avg_change >= 0 ? C.green : C.red, transition:"width 0.5s"
            }}/>
          </div>
          <div style={{fontSize:11, fontWeight:700, width:54, ...S.mono,
            color:s.avg_change>=0?C.green:C.red}}>
            {s.avg_change>=0?"+":""}{(s.avg_change||0).toFixed(2)}%
          </div>
        </div>
      ))}
    </div>
  )
}

function SectorDrilldown({ sectors, onTickerClick }) {
  const [active, setActive] = useState(sectors[0])
  useEffect(() => setActive(sectors[0]), [sectors])
  return (
    <div>
      <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:12}}>
        {sectors.map(s => (
          <button key={s.sector} onClick={() => setActive(s)} style={{
            fontSize:11, padding:"5px 12px", borderRadius:16, cursor:"pointer", fontWeight:500,
            border: active?.sector===s.sector ? `1px solid ${C.purple}` : `1px solid ${C.border}`,
            background: active?.sector===s.sector ? C.purpleDim : C.surfaceAlt,
            color: active?.sector===s.sector ? C.purpleText : C.textMuted
          }}>{s.sector}</button>
        ))}
      </div>
      {active && (
        <div style={{display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8}}>
          {active.top_5.map(t => (
            <div key={t.ticker} onClick={() => onTickerClick(t.ticker)} style={{
              background:C.bg, borderRadius:10, padding:"10px 12px", cursor:"pointer",
              border:`1px solid ${C.border}`, transition:"border-color 0.15s"
            }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5}}>
                <div style={{display:"flex", alignItems:"center", gap:6}}>
                  <span style={{...S.mono, fontWeight:700, fontSize:13, color:C.text}}>{t.ticker}</span>
                  <Badge color={t.is_etf?"purple":"green"}>{t.is_etf?"ETF":"Stock"}</Badge>
                </div>
                <span style={{fontSize:13, fontWeight:700, ...S.mono, color:t.week_change_pct>=0?C.green:C.red}}>
                  {t.week_change_pct>=0?"+":""}{(t.week_change_pct||0).toFixed(2)}%
                </span>
              </div>
              <div style={{background:C.border, borderRadius:3, height:4, marginBottom:5}}>
                <div style={{width:`${t.composite_score}%`, height:4, borderRadius:3,
                  background:t.composite_score>=60?C.green:t.composite_score>=45?C.amber:C.red}}/>
              </div>
              <div style={{display:"flex", justifyContent:"space-between"}}>
                <span style={{fontSize:10, color:C.textMuted}}>Score: {t.composite_score}</span>
                <span style={{fontSize:10, color:C.textDim}}>→ full analysis</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Events Sidebar ──────────────────────────────────────────────
function EventsSidebar() {
  const [events, setEvents] = useState(null)
  useEffect(() => { axios.get(`${API}/api/events`).then(r => setEvents(r.data.events)) }, [])
  if (!events) return null

  return (
    <div style={{
      width:250, flexShrink:0, ...S.card,
      padding:"1rem", height:"fit-content", position:"sticky", top:68
    }}>
      <div style={{...S.label, marginBottom:12}}>Market events</div>
      {events.length === 0
        ? <div style={{fontSize:12, color:C.textDim}}>No major events in next 14 days</div>
        : <div style={{display:"flex", flexDirection:"column", gap:7}}>
          {events.map((e,i) => {
            const isFed = e.type === "fed"
            const isEcon = e.type === "economic"
            const borderColor = isFed ? "#da3633" : isEcon ? "#9e6a03" : "#2ea043"
            const bgColor = isFed ? C.redDim : isEcon ? C.amberDim : C.greenDim
            const label = e.is_today ? "TODAY" : e.is_tomorrow ? "TOMORROW" : `in ${e.days_away}d`
            return (
              <div key={i} style={{background:bgColor, border:`1px solid ${borderColor}`, borderRadius:8, padding:"8px 10px"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3}}>
                  <span style={{fontSize:9, fontWeight:700, color:C.textMuted}}>{label}</span>
                  <span style={{fontSize:9, color:C.textMuted}}>{e.impact==="high"?"🔴 high":"🟡 med"}</span>
                </div>
                <div style={{fontSize:11, fontWeight:600, color:C.text, marginBottom:2}}>
                  {isFed?"🏦":isEcon?"📊":"📅"} {e.event}
                </div>
                <div style={{fontSize:9, color:C.textMuted}}>{e.date}</div>
              </div>
            )
          })}
        </div>
      }
      <div style={{marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}`,
        fontSize:10, color:C.textDim, lineHeight:1.5}}>
        High impact events can move markets 1-3%. Fed decisions especially.
      </div>
    </div>
  )
}

// ─── Watchlist ───────────────────────────────────────────────────
function WatchlistManager({ onTickerClick }) {
  const [watchlist, setWatchlist] = useState([])
  const [removing, setRemoving] = useState(null)
  useEffect(() => { axios.get(`${API}/api/watchlist`).then(r => setWatchlist(r.data.tickers || [])) }, [])
  if (watchlist.length === 0) return null
  const handleRemove = async (ticker) => {
    setRemoving(ticker)
    await axios.delete(`${API}/api/watchlist/${ticker}`)
    setWatchlist(prev => prev.filter(t => t !== ticker))
    setRemoving(null)
  }
  return (
    <div style={{...S.card, padding:"12px 14px", marginBottom:14}}>
      <div style={{...S.label, marginBottom:8}}>My watchlist — {watchlist.length} ticker{watchlist.length!==1?"s":""}</div>
      <div style={{display:"flex", gap:5, flexWrap:"wrap"}}>
        {watchlist.map(ticker => (
          <div key={ticker} style={{display:"flex", alignItems:"center", gap:3,
            background:C.bg, borderRadius:7, padding:"3px 8px", border:`1px solid ${C.border}`}}>
            <button onClick={() => onTickerClick(ticker)} style={{
              ...S.mono, fontWeight:600, fontSize:11, background:"none", border:"none",
              cursor:"pointer", color:C.text, padding:0
            }}>{ticker}</button>
            <button onClick={() => handleRemove(ticker)} style={{
              background:"none", border:"none", cursor:"pointer",
              color: removing===ticker ? C.textDim : C.red, fontSize:11, padding:"0 2px"
            }}>{removing===ticker?"…":"✕"}</button>
          </div>
        ))}
      </div>
      <div style={{fontSize:10, color:C.textDim, marginTop:6}}>
        Tracked tickers appear in history after the next pipeline run
      </div>
    </div>
  )
}

function WatchlistAdd({ ticker, onAdded }) {
  const [status, setStatus] = useState("idle")
  const [message, setMessage] = useState("")
  const handleAdd = async () => {
    setStatus("loading")
    try {
      const r = await axios.post(`${API}/api/watchlist/${ticker}`)
      if (r.data.success) { setStatus("success"); setMessage(r.data.message); setTimeout(()=>onAdded(),2000) }
      else { setStatus("error"); setMessage(r.data.error||"Could not add ticker") }
    } catch { setStatus("error"); setMessage("Failed to connect to API") }
  }
  return (
    <div style={{...S.card, padding:"2rem", textAlign:"center", marginBottom:14}}>
      <div style={{fontSize:20, fontWeight:700, ...S.mono, color:C.text, marginBottom:6}}>{ticker}</div>
      <div style={{fontSize:12, color:C.textMuted, marginBottom:14}}>
        Not tracked yet — add it to your watchlist and it will appear in history after the next pipeline run
      </div>
      {status==="idle" && (
        <button onClick={handleAdd} style={{
          fontSize:12, fontWeight:600, padding:"8px 20px", borderRadius:8,
          cursor:"pointer", border:"none", background:C.purple, color:"#fff"
        }}>+ Add {ticker} to watchlist</button>
      )}
      {status==="loading" && <div style={{fontSize:12,color:C.textMuted}}>Validating ticker...</div>}
      {status==="success" && <div style={{fontSize:12,color:C.green,fontWeight:500}}>✓ {message}</div>}
      {status==="error" && (
        <div>
          <div style={{fontSize:12,color:C.red,marginBottom:6}}>{message}</div>
          <button onClick={()=>setStatus("idle")} style={{
            fontSize:11, padding:"5px 12px", borderRadius:7, cursor:"pointer",
            border:`1px solid ${C.border}`, background:C.surfaceAlt, color:C.textMuted
          }}>Try again</button>
        </div>
      )}
      <div style={{fontSize:10, color:C.textDim, marginTop:10}}>Next pipeline run: 6:00 AM daily</div>
    </div>
  )
}

// ─── History Tab ─────────────────────────────────────────────────
function HistoryTab({ onTickerClick }) {
  const [allHistory, setAllHistory] = useState(null)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState([])
  const [compareMode, setCompareMode] = useState(false)

  useEffect(() => {
    axios.get(`${API}/api/history?days=30`).then(r => setAllHistory(r.data.history))
  }, [])

  if (!allHistory) return (
    <div style={{padding:"2rem", color:C.textDim, fontSize:13, textAlign:"center"}}>Loading history...</div>
  )

  const tickers = Object.keys(allHistory).filter(t => allHistory[t].length > 0)
    .sort((a,b) => {
      const as = allHistory[a][allHistory[a].length-1]?.composite_score || 0
      const bs = allHistory[b][allHistory[b].length-1]?.composite_score || 0
      return bs - as
    })

  const filtered = search.trim() ? tickers.filter(t => t.toLowerCase().includes(search.toLowerCase())) : tickers
  const display = selected.length > 0 ? selected : filtered.slice(0,6)

  return (
    <div>
      <WatchlistManager onTickerClick={onTickerClick}/>

      {/* Banner */}
      <div style={{...S.card, background:C.purpleDim, borderColor:"#6e40c9", padding:"1.25rem 1.5rem", marginBottom:"1.25rem"}}>
        <div style={{fontSize:13, fontWeight:600, color:C.purpleText, marginBottom:5}}>History builds over time</div>
        <div style={{fontSize:12, color:C.textMuted, lineHeight:1.6, marginBottom:12}}>
          Each morning at 6am a snapshot is saved. After 30 days you'll see which stocks consistently score high vs which ones spike and fade.
        </div>
        <div style={{display:"flex", gap:10}}>
          {[
            {label:"Days tracked", value: allHistory[tickers[0]]?.length || 1},
            {label:"Tickers in history", value: tickers.length},
            {label:"Next run", value:"6:00 AM"},
          ].map(m => (
            <div key={m.label} style={{background:"rgba(255,255,255,0.05)", borderRadius:8,
              padding:"8px 12px", flex:1, textAlign:"center"}}>
              <div style={{fontSize:16, fontWeight:700, color:C.purpleText, ...S.mono}}>{m.value}</div>
              <div style={{fontSize:9, color:C.textMuted, marginTop:2, ...S.label}}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{display:"flex", gap:8, marginBottom:12, alignItems:"center"}}>
        <div style={{position:"relative", flex:1}}>
          <span style={{position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:13, color:C.textDim}}>🔍</span>
          <input value={search} onChange={e=>{setSearch(e.target.value);setSelected([])}}
            placeholder="Search tickers... (AMD, NVDA, COST)"
            style={{width:"100%", paddingLeft:32, paddingRight:12, paddingTop:7, paddingBottom:7,
              border:`1px solid ${C.border}`, borderRadius:8, fontSize:12,
              background:C.bg, color:C.text, outline:"none", boxSizing:"border-box"}}/>
        </div>
        <button onClick={() => setCompareMode(!compareMode)} style={{
          fontSize:11, fontWeight:600, padding:"7px 14px", borderRadius:8, cursor:"pointer",
          border: compareMode ? `1px solid ${C.purple}` : `1px solid ${C.border}`,
          background: compareMode ? C.purpleDim : C.surfaceAlt,
          color: compareMode ? C.purpleText : C.textMuted, whiteSpace:"nowrap"
        }}>{compareMode ? "✓ Compare" : "Compare"}</button>
        {selected.length > 0 && (
          <button onClick={() => setSelected([])} style={{
            fontSize:11, padding:"7px 12px", borderRadius:8, cursor:"pointer",
            border:`1px solid ${C.border}`, background:C.surfaceAlt, color:C.textMuted
          }}>Clear</button>
        )}
      </div>

      {/* Ticker pills */}
      <div style={{marginBottom:14}}>
        <div style={{...S.label, marginBottom:6}}>
          {search ? `Results for "${search}" — ${filtered.length} tickers` : "All tickers — sorted by score"}
        </div>
        <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
          {filtered.map(t => {
            const hist = allHistory[t]
            const latest = hist[hist.length-1]
            const isSelected = selected.includes(t)
            const score = latest?.composite_score || 0
            const change = latest?.week_change_pct || 0
            return (
              <button key={t} onClick={() => {
                if (compareMode) setSelected(prev => prev.includes(t) ? prev.filter(x=>x!==t) : prev.length<4?[...prev,t]:prev)
                else setSelected(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev,t])
              }} style={{
                fontSize:10, ...S.mono, fontWeight:600, padding:"3px 8px", borderRadius:6, cursor:"pointer",
                border: isSelected ? `1px solid ${C.purple}` : `1px solid ${C.border}`,
                background: isSelected ? C.purpleDim : C.bg,
                color: isSelected ? C.purpleText : C.textMuted,
                display:"flex", alignItems:"center", gap:4
              }}>
                {t}
                <span style={{fontSize:8, color:change>=0?C.green:C.red}}>{change>=0?"+":""}{change.toFixed(1)}%</span>
                <span style={{fontSize:8, color:C.textDim}}>{score}</span>
              </button>
            )
          })}
        </div>
      </div>

      {search && filtered.length === 0 && (
        <WatchlistAdd ticker={search.toUpperCase()} onAdded={() => setSearch("")}/>
      )}

      <div style={{display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:12}}>
        {display.map(ticker => {
          const hist = allHistory[ticker] || []
          if (hist.length === 0) return null
          const latest = hist[hist.length-1]
          const first = hist[0]
          const delta = latest.composite_score - first.composite_score
          const trend = delta > 2 ? "↑ rising" : delta < -2 ? "↓ falling" : "→ stable"
          const trendColor = delta > 2 ? C.green : delta < -2 ? C.red : C.textMuted
          return (
            <div key={ticker} style={{...S.card, padding:"14px 16px"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
                <div style={{display:"flex", alignItems:"center", gap:6}}>
                  <button onClick={() => onTickerClick(ticker)} style={{
                    ...S.mono, fontWeight:700, fontSize:15, background:"none", border:"none",
                    cursor:"pointer", color:C.accent, padding:0
                  }}>{ticker}</button>
                  <Badge color={latest.is_etf?"purple":"green"}>{latest.is_etf?"ETF":"Stock"}</Badge>
                  <span style={{fontSize:10, color:C.textMuted}}>{latest.sector}</span>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14, fontWeight:700, ...S.mono, color:C.text}}>{latest.composite_score}/100</div>
                  <div style={{fontSize:10, color:trendColor}}>{trend}</div>
                </div>
              </div>

              {/* Mini signal bars */}
              <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5, marginBottom:10}}>
                {[
                  {label:"Price", value:latest.price_score||0, color:C.blue},
                  {label:"Sentiment", value:latest.sentiment_score||0, color:C.green},
                  {label:"Buzz", value:latest.buzz_score||0, color:C.purple},
                  {label:"StockTwits", value:latest.st_score||0, color:"#0ea5e9"},
                  {label:"Fundamentals", value:latest.fundamental_score||50, color:C.green},
                  {label:"Options", value:latest.options_score||50, color:C.amber},
                ].map(s => (
                  <div key={s.label} style={{background:C.bg, borderRadius:6, padding:"5px 7px", border:`1px solid ${C.border}`}}>
                    <div style={{fontSize:8, color:C.textDim, marginBottom:2}}>{s.label}</div>
                    <div style={{background:C.border, borderRadius:2, height:3}}>
                      <div style={{width:`${s.value}%`, height:3, borderRadius:2, background:s.color}}/>
                    </div>
                    <div style={{fontSize:9, fontWeight:700, color:C.text, marginTop:2, ...S.mono}}>{Math.round(s.value)}</div>
                  </div>
                ))}
              </div>

              <div style={{fontSize:10, color:C.textMuted, marginBottom:3}}>Composite score</div>
              <HistoryChart history={hist} width={440}/>

              {hist.length > 1 && (
                <>
                  <div style={{fontSize:10, color:C.textMuted, marginBottom:2, marginTop:8}}>Sentiment</div>
                  <SentimentChart history={hist} width={440}/>
                </>
              )}

              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center",
                marginTop:8, paddingTop:8, borderTop:`1px solid ${C.border}`, flexWrap:"wrap", gap:6}}>
                <span style={{fontSize:10, color:C.textDim}}>{hist.length} day{hist.length!==1?"s":""} tracked</span>
                <div style={{display:"flex", gap:10}}>
                  <span style={{fontSize:10, color:C.textMuted}}>
                    Price: <span style={{fontWeight:600, ...S.mono, color:latest.week_change_pct>=0?C.green:C.red}}>
                      {latest.week_change_pct>=0?"+":""}{fmt(latest.week_change_pct)}%
                    </span>
                  </span>
                  <span style={{fontSize:10, color:C.textMuted}}>
                    Δ score: <span style={{fontWeight:600, ...S.mono, color:trendColor}}>
                      {delta>=0?"+":""}{delta.toFixed(1)}
                    </span>
                  </span>
                  {latest.rsi && (
                    <span style={{fontSize:10, color:C.textMuted}}>
                      RSI: <span style={{fontWeight:600, ...S.mono,
                        color:latest.rsi>70?C.red:latest.rsi<30?C.green:C.text}}>{latest.rsi}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Strategies Tab ──────────────────────────────────────────────
function StrategiesTab({ onTickerClick }) {
  const [strategies, setStrategies] = useState(null)
  const [amount, setAmount] = useState(100)
  const [active, setActive] = useState(0)

  useEffect(() => { axios.get(`${API}/api/strategies`).then(r => setStrategies(r.data)) }, [])
  if (!strategies) return (
    <div style={{padding:"2rem", color:C.textDim, fontSize:13, textAlign:"center"}}>
      Building strategies from live data...
    </div>
  )

  const strategy = strategies.strategies[active]
  const riskPalette = {
    1: {bg:C.greenDim, border:"#2ea043", text:C.greenText, label:"Low risk"},
    2: {bg:C.amberDim, border:"#9e6a03", text:C.amberText, label:"Medium risk"},
    3: {bg:C.redDim, border:"#da3633", text:C.redText, label:"High risk"},
  }
  const rp = riskPalette[strategy.risk_level]

  return (
    <div>
      <div style={{...S.card, padding:"1.25rem 1.5rem", marginBottom:"1.25rem"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
          <div>
            <div style={{fontSize:15, fontWeight:700, color:C.text, marginBottom:3}}>Investment strategies</div>
            <div style={{fontSize:12, color:C.textMuted}}>Built from live scores — updated every pipeline run</div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontSize:12, color:C.textMuted}}>Invest</span>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute", left:8, top:"50%", transform:"translateY(-50%)",
                fontSize:13, color:C.text, fontWeight:500}}>$</span>
              <input type="number" value={amount} onChange={e=>setAmount(Math.max(1,Number(e.target.value)))}
                style={{width:90, paddingLeft:20, paddingRight:8, paddingTop:5, paddingBottom:5,
                  border:`1px solid ${C.border}`, borderRadius:7, fontSize:13, fontWeight:700,
                  background:C.bg, color:C.text, outline:"none", ...S.mono}}/>
            </div>
          </div>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8}}>
          {strategies.strategies.map((s,i) => (
            <button key={s.name} onClick={()=>setActive(i)} style={{
              padding:"10px 12px", borderRadius:10, cursor:"pointer", textAlign:"left",
              border: active===i ? `1px solid ${riskPalette[s.risk_level].border}` : `1px solid ${C.border}`,
              background: active===i ? riskPalette[s.risk_level].bg : C.surfaceAlt,
            }}>
              <div style={{fontSize:16, marginBottom:3}}>{s.emoji}</div>
              <div style={{fontSize:12, fontWeight:600, color:C.text, marginBottom:1}}>{s.name}</div>
              <div style={{fontSize:10, color:C.textMuted}}>{s.expected_horizon}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 300px", gap:12}}>
        <div style={{...S.card, padding:"1.25rem 1.5rem"}}>
          <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:14,
            paddingBottom:12, borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:18}}>{strategy.emoji}</span>
            <div>
              <div style={{fontSize:14, fontWeight:700, color:C.text}}>{strategy.name} portfolio</div>
              <div style={{fontSize:11, color:C.textMuted}}>{strategy.tagline}</div>
            </div>
          </div>
          <div style={{display:"flex", flexDirection:"column", gap:8}}>
            {strategy.allocations.map(a => {
              const dollars = ((a.allocation_pct/100)*amount).toFixed(2)
              return (
                <div key={a.ticker} style={{background:C.bg, borderRadius:10, padding:"10px 12px", border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5}}>
                    <div style={{display:"flex", alignItems:"center", gap:6}}>
                      <button onClick={() => onTickerClick(a.ticker)} style={{
                        ...S.mono, fontWeight:700, fontSize:13, background:"none", border:"none",
                        cursor:"pointer", color:C.accent, padding:0
                      }}>{a.ticker}</button>
                      <Badge color={a.type==="ETF"?"purple":"green"}>{a.type}</Badge>
                      <span style={{fontSize:10, color:C.textMuted}}>{a.sector}</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:14, fontWeight:700, ...S.mono, color:C.text}}>${dollars}</div>
                      <div style={{fontSize:10, color:C.textMuted}}>{a.allocation_pct}%</div>
                    </div>
                  </div>
                  <div style={{background:C.border, borderRadius:3, height:5, marginBottom:6}}>
                    <div style={{width:`${a.allocation_pct}%`, height:5, borderRadius:3,
                      background:a.type==="ETF"?C.purple:C.green}}/>
                  </div>
                  <div style={{fontSize:11, color:C.textMuted, marginBottom:5, lineHeight:1.4}}>{a.rationale}</div>
                  <div style={{display:"flex", gap:8, alignItems:"center"}}>
                    <span style={{fontSize:9, color:C.textDim}}>⏱ {a.horizon}</span>
                    {a.week_change_pct != null && (
                      <span style={{fontSize:9, fontWeight:600, ...S.mono,
                        color:a.week_change_pct>=0?C.green:C.red}}>
                        {a.week_change_pct>=0?"+":""}{a.week_change_pct.toFixed(1)}% this week
                      </span>
                    )}
                    {a.earnings_date && <Badge color="amber">📅 {a.earnings_date}</Badge>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{display:"flex", flexDirection:"column", gap:10}}>
          <div style={{...S.card, background:rp.bg, borderColor:rp.border, padding:"12px 14px"}}>
            <div style={{...S.label, color:rp.text, marginBottom:6}}>Risk level</div>
            <div style={{display:"flex", gap:3, marginBottom:6}}>
              {[1,2,3].map(i => (
                <div key={i} style={{flex:1, height:6, borderRadius:3,
                  background:i<=strategy.risk_level?rp.border:C.border}}/>
              ))}
            </div>
            <div style={{fontSize:12, fontWeight:600, color:rp.text}}>{rp.label}</div>
          </div>

          <div style={{...S.card, padding:"12px 14px"}}>
            <div style={{...S.label, marginBottom:10}}>Allocation split</div>
            {[{label:"Stocks",pct:strategy.stock_pct,color:C.green},{label:"ETFs",pct:strategy.etf_pct,color:C.purple}].map(a => (
              <div key={a.label} style={{marginBottom:8}}>
                <div style={{display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3}}>
                  <span style={{color:a.color, fontWeight:500}}>{a.label}</span>
                  <span style={{fontWeight:600, ...S.mono, color:C.text}}>${((a.pct/100)*amount).toFixed(2)}</span>
                </div>
                <div style={{background:C.border, borderRadius:3, height:6}}>
                  <div style={{width:`${a.pct}%`, height:6, borderRadius:3, background:a.color}}/>
                </div>
              </div>
            ))}
          </div>

          <div style={{...S.card, padding:"12px 14px"}}>
            <div style={{...S.label, marginBottom:6}}>Time horizon</div>
            <div style={{fontSize:13, fontWeight:600, color:C.text, marginBottom:3}}>{strategy.expected_horizon}</div>
            <div style={{fontSize:11, color:C.textMuted}}>
              {strategy.risk_level===3?"Monitor daily — momentum shifts fast":
               strategy.risk_level===2?"Check weekly — rebalance monthly":
               "Set and forget — review every 3 months"}
            </div>
          </div>

          <div style={{...S.card, background:C.amberDim, borderColor:"#9e6a03", padding:"12px 14px"}}>
            <div style={{...S.label, color:C.amberText, marginBottom:6}}>Keep in mind</div>
            {strategy.warnings.map((w,i) => (
              <div key={i} style={{display:"flex", gap:6, fontSize:11, color:C.amberText, marginBottom:5, lineHeight:1.4}}>
                <span style={{flexShrink:0}}>⚠</span>{w}
              </div>
            ))}
            <div style={{fontSize:10, color:C.textDim, marginTop:6, paddingTop:6, borderTop:`1px solid #9e6a03`}}>
              Not financial advice — algorithmic signals only.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Macro Bar ───────────────────────────────────────────────────
function MacroBar({ data }) {
  const [macro, setMacro] = useState(null)
  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/fear-greed`).catch(() => null),
      axios.get(`${API}/api/vix`).catch(() => null),
    ]).then(([fg, vix]) => {
      setMacro({
        fg: fg?.data,
        vix: vix?.data,
      })
    })
  }, [])

  if (!macro?.fg && !macro?.vix) return null

  const fg = macro.fg
  const vix = macro.vix
  const fgColor = fg?.value <= 25 ? C.red : fg?.value <= 45 ? C.amber : fg?.value >= 75 ? C.green : C.textMuted
  const vixColor = vix?.value >= 30 ? C.red : vix?.value >= 20 ? C.amber : C.green

  return (
    <div style={{
      background: C.surfaceAlt, borderBottom:`1px solid ${C.border}`,
      padding:"6px 2rem", display:"flex", alignItems:"center", gap:20
    }}>
      <span style={{fontSize:10, fontWeight:700, color:C.textDim, letterSpacing:"0.08em", textTransform:"uppercase"}}>
        Macro
      </span>
      {fg && (
        <div style={{display:"flex", alignItems:"center", gap:6}}>
          <span style={{fontSize:10, color:C.textMuted}}>Fear & Greed</span>
          <span style={{fontSize:12, fontWeight:700, color:fgColor}}>{fg.value}</span>
          <span style={{fontSize:10, color:fgColor}}>{fg.description}</span>
          <span style={{fontSize:10, color:C.textDim}}>·</span>
          <span style={{fontSize:10, color:C.textMuted, fontStyle:"italic"}}>{fg.context?.split(".")[0]}</span>
        </div>
      )}
      {vix && (
        <div style={{display:"flex", alignItems:"center", gap:6}}>
          <span style={{fontSize:10, color:C.textMuted}}>VIX</span>
          <span style={{fontSize:12, fontWeight:700, color:vixColor}}>{vix.value}</span>
          <span style={{fontSize:10, color:vixColor}}>{vix.signal}</span>
        </div>
      )}
    </div>
  )
}

// ─── Signal Filter Bar ───────────────────────────────────────────
const FILTERS = [
  { id: "congress_buy",    label: "🏛 Congress buying",   test: t => t.congress_signal && ["bullish","buy_cluster","strong_buy_cluster"].includes(t.congress_signal) },
  { id: "congress_sell",   label: "🏛 Congress selling",  test: t => t.congress_signal && ["bearish","sell_cluster","strong_sell_cluster"].includes(t.congress_signal) },
  { id: "analyst_upgrade", label: "📊 Analyst upgrade",   test: t => t.analyst_action && ["upgrade","strong_upgrade"].includes(t.analyst_action) },
  { id: "bullish_sent",    label: "🧠 Bullish sentiment", test: t => (t.avg_sentiment || 0) > 0.1 },
  { id: "bearish_sent",    label: "🧠 Bearish sentiment", test: t => (t.avg_sentiment || 0) < -0.1 },
  { id: "high_volume",     label: "⚡ High volume",       test: t => (t.volume_spike || 1) > 2 },
  { id: "high_short",      label: "🩳 High short interest",test: t => (t.short_float_pct || 0) > 10 },
  { id: "unusual_options", label: "📈 Unusual options",   test: t => t.unusual_options },
  { id: "oversold",        label: "RSI oversold",         test: t => t.rsi && t.rsi < 35 },
  { id: "strong_signal",   label: "✓ 5+ signals",         test: t => (t.bullish_signals || 0) >= 5 },
]

const SORTS = [
  { id: "score",    label: "Score",         fn: (a,b) => b.composite_score - a.composite_score },
  { id: "price",    label: "Price ▲",       fn: (a,b) => b.week_change_pct - a.week_change_pct },
  { id: "mentions", label: "Reddit buzz",   fn: (a,b) => b.mentions - a.mentions },
  { id: "volume",   label: "Volume spike",  fn: (a,b) => (b.volume_spike||1) - (a.volume_spike||1) },
  { id: "upside",   label: "Analyst upside",fn: (a,b) => (b.analyst_upside||0) - (a.analyst_upside||0) },
]

function FilterBar({ allScores, activeFilters, setActiveFilters, sortBy, setSortBy, onTickerClick }) {
  const toggleFilter = (id) => {
    setActiveFilters(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  // Apply filters + sort
  const filtered = allScores.filter(t => {
    if (activeFilters.length === 0) return true
    return activeFilters.every(fid => {
      const f = FILTERS.find(f => f.id === fid)
      return f ? f.test(t) : true
    })
  })

  const sortFn = SORTS.find(s => s.id === sortBy)?.fn || SORTS[0].fn
  const sorted = [...filtered].sort(sortFn)

  // Count per filter
  const counts = {}
  FILTERS.forEach(f => {
    counts[f.id] = allScores.filter(f.test).length
  })

  const isFiltered = activeFilters.length > 0

  return (
    <div style={{marginBottom:"1.5rem"}}>
      {/* Filter pills */}
      <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:10}}>
        <span style={{...S.label, flexShrink:0}}>Filter by signal</span>
        {activeFilters.length > 0 && (
          <button onClick={() => setActiveFilters([])} style={{
            fontSize:10, padding:"3px 10px", borderRadius:20, cursor:"pointer",
            border:`1px solid ${C.red}`, background:C.redDim, color:C.redText, fontWeight:600
          }}>✕ Clear all</button>
        )}
      </div>
      <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:12}}>
        {FILTERS.map(f => {
          const active = activeFilters.includes(f.id)
          const count = counts[f.id]
          return (
            <button key={f.id} onClick={() => toggleFilter(f.id)} style={{
              fontSize:11, padding:"5px 12px", borderRadius:20, cursor:"pointer", fontWeight:500,
              border: active ? `1px solid ${C.purple}` : `1px solid ${C.border}`,
              background: active ? C.purpleDim : C.surfaceAlt,
              color: active ? C.purpleText : count === 0 ? C.textDim : C.textMuted,
              display:"flex", alignItems:"center", gap:5,
              opacity: count === 0 ? 0.5 : 1
            }}>
              {f.label}
              <span style={{
                fontSize:9, background: active ? C.purple : C.border,
                color: active ? "#fff" : C.textDim,
                padding:"1px 5px", borderRadius:10, fontWeight:700, ...S.mono
              }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Sort row */}
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <span style={{...S.label, flexShrink:0}}>Sort by</span>
        <div style={{display:"flex", gap:4}}>
          {SORTS.map(s => (
            <button key={s.id} onClick={() => setSortBy(s.id)} style={{
              fontSize:11, padding:"4px 10px", borderRadius:7, cursor:"pointer",
              border: sortBy===s.id ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
              background: sortBy===s.id ? C.blueDim : C.surfaceAlt,
              color: sortBy===s.id ? C.accent : C.textMuted, fontWeight:500
            }}>{s.label}</button>
          ))}
        </div>
        {isFiltered && (
          <span style={{fontSize:11, color:C.textMuted, marginLeft:8}}>
            Showing <span style={{color:C.text, fontWeight:600}}>{sorted.length}</span> of {allScores.length} tickers
          </span>
        )}
      </div>

      {/* Filtered results grid */}
      {isFiltered && (
        <div style={{marginTop:16}}>
          <div style={{fontSize:14, fontWeight:700, color:C.text, marginBottom:12}}>
            Filtered results
            <span style={{fontSize:11, color:C.textMuted, fontWeight:400, marginLeft:8}}>
              {activeFilters.map(id => FILTERS.find(f=>f.id===id)?.label).join(" + ")}
            </span>
          </div>
          {sorted.length === 0 ? (
            <div style={{...S.card, padding:"2rem", textAlign:"center", color:C.textDim, fontSize:13}}>
              No tickers match all selected filters. Try removing some filters.
            </div>
          ) : (
            <div style={{display:"grid", gridTemplateColumns:"repeat(5,minmax(0,1fr))", gap:10}}>
              {sorted.slice(0,20).map((t,i) => (
                <TickerCard key={t.ticker} t={t} rank={i===0?1:0} onClick={onTickerClick}/>
              ))}
            </div>
          )}
          {sorted.length > 20 && (
            <div style={{fontSize:11, color:C.textDim, textAlign:"center", marginTop:10}}>
              Showing top 20 of {sorted.length} matches
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null)
  const [allScores, setAllScores] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState(null)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [activeFilters, setActiveFilters] = useState([])
  const [sortBy, setSortBy] = useState("score")

  const fetchData = useCallback(() => {
    Promise.all([
      axios.get(`${API}/api/summary`),
      axios.get(`${API}/api/scores`),
    ]).then(([summary, scores]) => {
      setData(summary.data)
      setAllScores(scores.data.scores || [])
      setLoading(false)
    })
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await axios.post(`${API}/api/refresh`)
    const poll = setInterval(async () => {
      const s = await axios.get(`${API}/api/status`)
      if (!s.data.running) { clearInterval(poll); fetchData(); setRefreshing(false) }
    }, 3000)
  }

  const handleTickerClick = (ticker) => setSelectedTicker(ticker)
  const handleModalClose = (switchTo) => {
    if (typeof switchTo === "string") setSelectedTicker(switchTo)
    else setSelectedTicker(null)
  }

  if (loading) return (
    <div style={{display:"flex", alignItems:"center", justifyContent:"center", height:"100vh",
      background:C.bg, color:C.textMuted, fontFamily:"system-ui", fontSize:14}}>
      Loading market data...
    </div>
  )

  return (
    <div style={{background:C.bg, minHeight:"100vh", fontFamily:"system-ui,-apple-system,sans-serif", color:C.text}}>
      {selectedTicker && <Modal ticker={selectedTicker} data={data} onClose={handleModalClose}/>}

      {/* Top bar */}
      <div style={{
        background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"0 2rem", display:"flex", justifyContent:"space-between", alignItems:"center",
        position:"sticky", top:0, zIndex:50, height:56
      }}>
        <div style={{display:"flex", alignItems:"center", gap:24}}>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{width:28, height:28, borderRadius:7, background:`linear-gradient(135deg, ${C.purple}, ${C.blue})`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:13}}>📈</div>
            <div style={{fontSize:14, fontWeight:700, color:C.text, letterSpacing:"-0.3px"}}>MarketIntel</div>
          </div>
          <div style={{display:"flex", gap:2}}>
            {["dashboard","history","strategies"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                fontSize:12, fontWeight:500, padding:"5px 12px", borderRadius:7,
                border:"none", cursor:"pointer",
                background: activeTab===tab ? C.purpleDim : "transparent",
                color: activeTab===tab ? C.purpleText : C.textMuted
              }}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <span style={{fontSize:11, color:C.textDim}}>
            {data.total_tickers} tickers · {new Date(data.generated_at).toLocaleString()}
          </span>
          <span style={{fontSize:10, background:C.greenDim, color:C.greenText,
            padding:"3px 10px", borderRadius:20, fontWeight:700, border:`1px solid #2ea043`}}>● Live</span>
          <button onClick={handleRefresh} disabled={refreshing} style={{
            fontSize:11, padding:"5px 12px", borderRadius:7, fontWeight:500,
            border:`1px solid ${C.border}`, background:refreshing?C.surfaceAlt:C.surface,
            color:refreshing?C.textDim:C.text, cursor:refreshing?"not-allowed":"pointer"
          }}>
            {refreshing?"Refreshing...":"↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Macro bar */}
      <MacroBar data={data}/>

      <div style={{maxWidth:1360, margin:"0 auto", padding:"1.75rem 1.5rem"}}>
        {activeTab === "history" ? (
          <HistoryTab onTickerClick={handleTickerClick}/>
        ) : activeTab === "strategies" ? (
          <StrategiesTab onTickerClick={handleTickerClick}/>
        ) : (
          <div style={{display:"grid", gridTemplateColumns:"1fr 250px", gap:20, alignItems:"start"}}>
            <div>
              {/* Summary cards */}
              <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1.5rem"}}>
                {[
                  {label:"Top sector", value:data.top_sector,
                    sub:`${data.top_sector_change!=null?(data.top_sector_change>=0?"+":"")+Number(data.top_sector_change).toFixed(2)+"%":"—"} avg this week`},
                  {label:"Tickers tracked", value:data.total_tickers, sub:"across all sectors"},
                  {label:"Top stock pick", value:data.top5_stocks?.[0]?.ticker,
                    sub:`score ${data.top5_stocks?.[0]?.composite_score}/100`},
                  {label:"Top ETF pick", value:data.top5_etfs?.[0]?.ticker,
                    sub:`score ${data.top5_etfs?.[0]?.composite_score}/100`},
                ].map(m => (
                  <div key={m.label} style={{...S.card, padding:"14px 16px"}}>
                    <div style={{...S.label, marginBottom:5}}>{m.label}</div>
                    <div style={{fontSize:20, fontWeight:700, color:C.text, letterSpacing:"-0.5px", ...S.mono}}>{m.value}</div>
                    <div style={{fontSize:11, color:C.textMuted, marginTop:3}}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Sector momentum */}
              <div style={{...S.card, padding:"1.25rem 1.5rem", marginBottom:"1.5rem"}}>
                <div style={{...S.label, marginBottom:14}}>Sector momentum this week</div>
                <SectorBar sectors={data.sectors}/>
              </div>

              {/* Filter + Sort system */}
              <FilterBar
                allScores={allScores.filter(t => !t.is_etf)}
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                sortBy={sortBy}
                setSortBy={setSortBy}
                onTickerClick={handleTickerClick}
              />

              {/* Top 5 Stocks — hidden when filters active */}
              {activeFilters.length === 0 && (
                <div style={{marginBottom:"1.5rem"}}>
                  <div style={{display:"flex", alignItems:"baseline", gap:10, marginBottom:12}}>
                    <div style={{fontSize:15, fontWeight:700, color:C.text}}>Top 5 Stocks</div>
                    <div style={{fontSize:11, color:C.textMuted}}>ranked by composite score · click for full analysis</div>
                  </div>
                  <div style={{display:"grid", gridTemplateColumns:"repeat(5,minmax(0,1fr))", gap:10}}>
                    {(data.top5_stocks||[]).map((t,i) => (
                      <TickerCard key={t.ticker} t={t} rank={i+1} onClick={handleTickerClick}/>
                    ))}
                  </div>
                </div>
              )}

              {/* Top 5 ETFs — hidden when filters active */}
              {activeFilters.length === 0 && (
                <div style={{marginBottom:"1.5rem"}}>
                  <div style={{display:"flex", alignItems:"baseline", gap:10, marginBottom:12}}>
                    <div style={{fontSize:15, fontWeight:700, color:C.text}}>Top 5 ETFs</div>
                    <div style={{fontSize:11, color:C.textMuted}}>diversified exposure · click for full analysis</div>
                  </div>
                  <div style={{display:"grid", gridTemplateColumns:"repeat(5,minmax(0,1fr))", gap:10}}>
                    {(data.top5_etfs||[]).map((t,i) => (
                      <TickerCard key={t.ticker} t={t} rank={i+1} onClick={handleTickerClick}/>
                    ))}
                  </div>
                </div>
              )}

              {/* Sector drill-down */}
              <div style={{...S.card, padding:"1.25rem 1.5rem"}}>
                <div style={{...S.label, marginBottom:12}}>Sector drill-down</div>
                <SectorDrilldown sectors={data.sectors} onTickerClick={handleTickerClick}/>
              </div>
            </div>

            <EventsSidebar/>
          </div>
        )}
      </div>
    </div>
  )
}
