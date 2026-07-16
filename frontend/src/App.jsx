import { useState, useEffect, useCallback } from "react"
import axios from "axios"

const API = "https://marketintel-production-e203.up.railway.app"
const fmt = (n, d = 2) => (n != null && !Number.isNaN(Number(n))) ? Number(n).toFixed(d) : "—"
const fmtCap = (n) => {
  if (!n) return "—"
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  return `$${(n / 1e6).toFixed(0)}M`
}
const pct = (n, signed = true) => {
  if (n == null || Number.isNaN(Number(n))) return "—"
  const v = Number(n)
  return `${signed && v > 0 ? "+" : ""}${v.toFixed(2)}%`
}

// ─── Design tokens — warm dark, minimal accents ──────────────────
const C = {
  bg: "#181a1b",
  surface: "#1f2223",
  surfaceAlt: "#26292b",
  border: "#2e3234",
  borderSubtle: "#26292b",
  text: "#ececec",
  textMuted: "#9ba1a6",
  textDim: "#5f6568",
  green: "#22c07a",
  red: "#e5484d",
  amber: "#d5a439",
  accent: "#4cc2c9",
  accentDim: "#153b3d",
  repRed: "#b54548",
  demBlue: "#3b6fb5",
}

const S = {
  card: { background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` },
  label: {
    fontSize: 10.5, fontWeight: 600, letterSpacing: "0.07em",
    textTransform: "uppercase", color: C.textDim,
  },
  num: { fontVariantNumeric: "tabular-nums", fontFamily: "'SF Mono','Roboto Mono',monospace" },
}

const changeColor = (v) => (v == null || v === 0) ? C.textMuted : v > 0 ? C.green : C.red
const scoreColor = (v) => v >= 60 ? C.green : v >= 45 ? C.amber : C.red

// ─── Primitives ──────────────────────────────────────────────────
function Sparkline({ data, width = 120, height = 30, color }) {
  if (!data || data.length < 2) return <div style={{ height }} />
  const clean = data.filter(v => v != null && !Number.isNaN(v))
  if (clean.length < 2) return <div style={{ height }} />
  const min = Math.min(...clean), max = Math.max(...clean)
  const range = max - min || 1
  const pts = clean.map((v, i) =>
    `${(i / (clean.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(" ")
  const up = clean[clean.length - 1] >= clean[0]
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color || (up ? C.green : C.red)}
        strokeWidth="1.4" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}

function Score({ value, size = "md" }) {
  const sizes = { sm: 15, md: 19, lg: 26 }
  return (
    <span style={{ ...S.num, fontSize: sizes[size], fontWeight: 650, color: scoreColor(value) }}>
      {value != null ? Number(value).toFixed(1) : "—"}
    </span>
  )
}

function Chip({ children, tone = "default" }) {
  const tones = {
    default: { bg: C.surfaceAlt, color: C.textMuted },
    green: { bg: "rgba(34,192,122,0.12)", color: C.green },
    red: { bg: "rgba(229,72,77,0.12)", color: C.red },
    amber: { bg: "rgba(213,164,57,0.12)", color: C.amber },
    accent: { bg: C.accentDim, color: C.accent },
    rep: { bg: "rgba(181,69,72,0.15)", color: "#d98487" },
    dem: { bg: "rgba(59,111,181,0.15)", color: "#7ba3d9" },
  }
  const t = tones[tone] || tones.default
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 550, padding: "2px 8px", borderRadius: 5,
      background: t.bg, color: t.color, whiteSpace: "nowrap",
    }}>{children}</span>
  )
}

function Row({ label, value, valueColor, mono = true }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "7px 0", borderBottom: `1px solid ${C.borderSubtle}`,
    }}>
      <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 550, color: valueColor || C.text, ...(mono ? S.num : {}) }}>
        {value}
      </span>
    </div>
  )
}

function SignalBar({ label, value }) {
  const v = Math.min(100, Math.max(0, value || 0))
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
      <span style={{ fontSize: 11.5, color: C.textMuted, width: 150, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: C.surfaceAlt, borderRadius: 2, height: 4 }}>
        <div style={{
          width: `${v}%`, height: 4, borderRadius: 2,
          background: v >= 60 ? C.green : v >= 45 ? C.textDim : C.red,
          transition: "width 0.3s",
        }} />
      </div>
      <span style={{ ...S.num, fontSize: 11.5, color: C.text, width: 26, textAlign: "right" }}>
        {Math.round(v)}
      </span>
    </div>
  )
}

function RangeBar({ low, high, current }) {
  if (!low || !high || low >= high || !current) return null
  const p = Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100))
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.textDim, marginBottom: 4 }}>
        <span style={S.num}>${fmt(low)}</span>
        <span>52-week range</span>
        <span style={S.num}>${fmt(high)}</span>
      </div>
      <div style={{ background: C.surfaceAlt, borderRadius: 2, height: 4, position: "relative" }}>
        <div style={{
          position: "absolute", left: `${p}%`, top: -2.5, transform: "translateX(-50%)",
          width: 9, height: 9, borderRadius: "50%", background: C.accent,
          border: `2px solid ${C.bg}`,
        }} />
      </div>
    </div>
  )
}

function HistoryChart({ history, width = 520, height = 120 }) {
  if (!history || history.length < 2) return (
    <div style={{
      fontSize: 12, color: C.textDim, textAlign: "center", padding: "1.25rem",
      background: C.surfaceAlt, borderRadius: 8,
    }}>
      History builds as the pipeline runs daily
    </div>
  )
  const padL = 34, padR = 10, padT = 8, padB = 20
  const W = width - padL - padR, H = height - padT - padB
  const scores = history.map(h => h.composite_score)
  const dates = history.map(h => h.date)
  const minS = Math.min(...scores), maxS = Math.max(...scores)
  const range = maxS - minS || 1
  const pts = scores.map((v, i) =>
    `${padL + (i / (scores.length - 1)) * W},${padT + H - ((v - minS) / range) * H}`
  ).join(" ")
  const step = Math.ceil(dates.length / 5)
  const labels = dates.reduce((a, d, i) => { if (i % step === 0 || i === dates.length - 1) a.push(i); return a }, [])
  const fmtDate = (d) => d?.includes("-") ? `${d.slice(5, 7)}/${d.slice(8, 10)}` : `${d?.slice(4, 6)}/${d?.slice(6, 8)}`

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.5, 1].map((p, i) => {
        const y = padT + H - p * H
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + W} y2={y} stroke={C.border} strokeWidth="0.5" />
            <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize={9} fill={C.textDim} style={S.num}>
              {Math.round(minS + p * range)}
            </text>
          </g>
        )
      })}
      <polyline points={pts} fill="none" stroke={C.accent} strokeWidth="1.6" strokeLinejoin="round" />
      {scores.map((v, i) => (
        <circle key={i} cx={padL + (i / (scores.length - 1)) * W}
          cy={padT + H - ((v - minS) / range) * H} r="2.5" fill={C.accent} stroke={C.bg} strokeWidth="1.5" />
      ))}
      {labels.map(idx => (
        <text key={idx} x={padL + (idx / (dates.length - 1)) * W} y={height - 5}
          textAnchor="middle" fontSize={9} fill={C.textDim}>{fmtDate(dates[idx])}</text>
      ))}
    </svg>
  )
}

// ─── Modal ───────────────────────────────────────────────────────
function Modal({ ticker, data, allScores, onClose }) {
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState(null)

  const t = allScores?.find(x => x.ticker === ticker) ||
    [...(data?.top5_stocks || []), ...(data?.top5_etfs || [])].find(x => x.ticker === ticker)

  useEffect(() => {
    setDetail(null); setHistory(null)
    axios.get(`${API}/api/ticker/${ticker}/detail`).then(r => setDetail(r.data)).catch(() => {})
    axios.get(`${API}/api/history/${ticker}`).then(r => setHistory(r.data.history)).catch(() => {})
  }, [ticker])

  if (!t) return null

  const r = t.reasoning || {}
  const p = detail?.price_data || {}
  const priceHistory = (t.price_history?.length > 1 ? t.price_history : p.price_history) || []
  const headlines = detail?.headlines || []
  const close = t.latest_close || p.latest_close
  const up = (t.week_change_pct || 0) >= 0
  const congressActive = t.congress_signal && !["neutral", "no_data"].includes(t.congress_signal)

  return (
    <div onClick={() => onClose()} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: "1rem", backdropFilter: "blur(3px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, borderRadius: 12, width: "100%", maxWidth: 620,
        maxHeight: "92vh", overflowY: "auto", border: `1px solid ${C.border}`,
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px 14px", borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          position: "sticky", top: 0, background: C.surface, zIndex: 5,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 21, fontWeight: 700, color: C.text, letterSpacing: "-0.3px" }}>{ticker}</span>
              <span style={{ fontSize: 12, color: C.textDim }}>{t.sector}</span>
              <Chip>{t.is_etf ? "ETF" : "Stock"}</Chip>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
              <span style={{ ...S.num, fontSize: 26, fontWeight: 650, color: C.text }}>
                {close ? `$${fmt(close)}` : "—"}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: changeColor(t.week_change_pct) }}>
                {up ? "▲" : "▼"} {pct(Math.abs(t.week_change_pct || 0), false)} 1W
              </span>
              {t.momentum_30d != null && (
                <span style={{ fontSize: 12, color: changeColor(t.momentum_30d) }}>
                  {pct(t.momentum_30d)} 30D
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <Score value={t.composite_score} size="lg" />
              <div style={{ ...S.label, marginTop: 2 }}>Score</div>
            </div>
            <button onClick={() => onClose()} style={{
              background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6,
              width: 28, height: 28, cursor: "pointer", color: C.textMuted, fontSize: 13,
            }}>✕</button>
          </div>
        </div>

        <div style={{ padding: "18px 24px" }}>
          {/* Sparkline + range */}
          {priceHistory.length > 1 && (
            <div style={{ marginBottom: 18 }}>
              <Sparkline data={priceHistory} width={560} height={54} />
              <RangeBar low={t.year_low || p.year_low} high={t.year_high || p.year_high} current={close} />
            </div>
          )}

          {/* Key stats — two column ledger */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 32, marginBottom: 20 }}>
            <div>
              <Row label="Market cap" value={fmtCap(t.market_cap || p.market_cap)} />
              <Row label="P/E ratio" value={fmt(t.pe_ratio || p.pe_ratio, 1)} />
              <Row label="Revenue growth" value={t.revenue_growth != null ? pct(t.revenue_growth) : "—"}
                valueColor={t.revenue_growth > 0 ? C.green : t.revenue_growth < 0 ? C.red : undefined} />
              <Row label="Profit margin" value={t.profit_margin != null ? `${t.profit_margin}%` : "—"} />
              <Row label="Debt / equity" value={fmt(t.debt_equity)} />
              <Row label="Earnings record" value={t.earnings_surprise || "—"} mono={false} />
            </div>
            <div>
              <Row label="RSI" value={t.rsi || "—"}
                valueColor={t.rsi > 70 ? C.red : t.rsi < 30 ? C.green : undefined} />
              <Row label="30-day volatility" value={t.volatility_30d ? `${t.volatility_30d}%` : "—"} />
              <Row label="Beta" value={fmt(t.beta, 2)} />
              <Row label="Trend" value={t.trend_direction || "—"} mono={false} />
              <Row label="Institutions" value={t.major_institutions != null ? `${t.major_institutions} major` : "—"} mono={false} />
              <Row label="Insider filings" value={t.insider_count != null ? `${t.insider_count} Form 4` : "—"} mono={false} />
            </div>
          </div>

          {/* Analyst / Short / Congress */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ ...S.label, marginBottom: 8 }}>Analyst</div>
              {t.analyst_target ? (
                <>
                  <div style={{ ...S.num, fontSize: 16, fontWeight: 650, color: C.text }}>${fmt(t.analyst_target)}</div>
                  <div style={{ fontSize: 11.5, marginTop: 2, color: changeColor(t.analyst_upside) }}>
                    {pct(t.analyst_upside)} upside
                  </div>
                  <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                    {t.analyst_rating && <Chip tone={t.analyst_rating === "buy" ? "green" : t.analyst_rating === "sell" ? "red" : "default"}>{t.analyst_rating}</Chip>}
                  </div>
                </>
              ) : <div style={{ fontSize: 12, color: C.textDim }}>No coverage data</div>}
            </div>

            <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ ...S.label, marginBottom: 8 }}>Short interest</div>
              {t.short_float_pct != null ? (
                <>
                  <div style={{
                    ...S.num, fontSize: 16, fontWeight: 650,
                    color: t.short_float_pct > 20 ? C.red : t.short_float_pct > 10 ? C.amber : C.text,
                  }}>{fmt(t.short_float_pct, 1)}%</div>
                  <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>
                    {t.short_ratio ? `${fmt(t.short_ratio, 1)} days to cover` : "of float"}
                  </div>
                </>
              ) : <div style={{ fontSize: 12, color: C.textDim }}>No data</div>}
            </div>

            <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ ...S.label, marginBottom: 8 }}>Congress</div>
              {congressActive ? (
                <>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span style={{ ...S.num, fontSize: 16, fontWeight: 650, color: C.green }}>{t.congress_buys || 0}B</span>
                    <span style={{ ...S.num, fontSize: 16, fontWeight: 650, color: C.red }}>{t.congress_sells || 0}S</span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Chip tone={t.congress_signal.includes("buy") || t.congress_signal === "bullish" ? "green" : "red"}>
                      {t.congress_signal.replace(/_/g, " ")}
                    </Chip>
                  </div>
                  {t.congress_buyers?.length > 0 && (
                    <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 6, lineHeight: 1.5 }}>
                      {t.congress_buyers.slice(0, 2).join(", ")}
                      {t.congress_buyers.length > 2 ? ` +${t.congress_buyers.length - 2}` : ""}
                    </div>
                  )}
                </>
              ) : <div style={{ fontSize: 12, color: C.textDim }}>No recent activity</div>}
            </div>
          </div>

          {/* Confluence */}
          {t.bullish_signals != null && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ ...S.label }}>Signal confluence</span>
                <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
                  {t.bullish_signals} of 12 bullish
                  <span style={{ color: C.textDim, fontWeight: 400 }}>
                    {t.bullish_signals >= 7 ? " · high conviction" : t.bullish_signals >= 5 ? " · strong" : ""}
                  </span>
                </span>
              </div>
              <div style={{ background: C.surfaceAlt, borderRadius: 3, height: 5 }}>
                <div style={{
                  width: `${(t.bullish_signals / 12) * 100}%`, height: 5, borderRadius: 3,
                  background: t.bullish_signals >= 6 ? C.green : t.bullish_signals >= 4 ? C.amber : C.textDim,
                }} />
              </div>
            </div>
          )}

          {/* Signal breakdown */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...S.label, marginBottom: 10 }}>Signal breakdown</div>
            <SignalBar label="Price momentum" value={t.price_score} />
            <SignalBar label="News sentiment" value={t.sentiment_score} />
            <SignalBar label="Social buzz" value={t.buzz_score} />
            <SignalBar label="StockTwits" value={t.st_score} />
            <SignalBar label="Fundamentals" value={t.fundamental_score} />
            <SignalBar label="Analyst targets" value={t.analyst_score} />
            <SignalBar label="Short interest" value={t.short_score} />
            <SignalBar label="Congress activity" value={t.congress_score} />
            <SignalBar label="Insider filings" value={t.insider_count > 0 ? 75 : 50} />
            <SignalBar label="Institutional" value={Math.min(100, (t.major_institutions || 0) * 20 + 40)} />
            <SignalBar label="Search interest" value={t.trends_score} />
            <SignalBar label="Options flow" value={t.options_score} />
          </div>

          {/* Score history */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...S.label, marginBottom: 8 }}>Score history</div>
            <HistoryChart history={history} />
          </div>

          {/* Interpretation */}
          {r.signal_call && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                borderLeft: `2px solid ${r.signal_color === "green" ? C.green : r.signal_color === "red" ? C.red : C.amber}`,
                paddingLeft: 14, marginBottom: 12,
              }}>
                <div style={{
                  fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 3,
                  color: r.signal_color === "green" ? C.green : r.signal_color === "red" ? C.red : C.amber,
                }}>{r.signal_call}</div>
                <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55 }}>{r.signal_desc}</div>
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6, marginBottom: 6 }}>
                <span style={{ color: C.textDim }}>Social — </span>{r.reddit_interp}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                <span style={{ color: C.textDim }}>Sentiment — </span>{r.sentiment_interp}
              </div>
            </div>
          )}

          {/* Thesis + reasons */}
          {(r.thesis || r.reasons?.length > 0) && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ ...S.label, marginBottom: 8 }}>Why this ranks</div>
              {r.thesis && (
                <div style={{
                  fontSize: 12.5, color: C.text, marginBottom: 10, lineHeight: 1.5,
                  fontStyle: "italic",
                }}>{r.thesis}</div>
              )}
              {(r.reasons || []).map((reason, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: C.textMuted, marginBottom: 5, lineHeight: 1.5 }}>
                  <span style={{ color: C.green, flexShrink: 0 }}>+</span>{reason}
                </div>
              ))}
            </div>
          )}

          {/* Watch-outs */}
          {(r.watches || []).filter(w => w !== "monitor for broader market shifts").length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ ...S.label, marginBottom: 8 }}>Risks</div>
              {r.watches.map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: C.textMuted, marginBottom: 5, lineHeight: 1.5 }}>
                  <span style={{ color: C.amber, flexShrink: 0 }}>–</span>{w}
                </div>
              ))}
            </div>
          )}

          {/* Related */}
          {(r.related_etfs?.length > 0 || r.watch_also?.length > 0) && (
            <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
              {r.related_etfs?.length > 0 && (
                <div>
                  <div style={{ ...S.label, marginBottom: 6 }}>Related ETFs</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {r.related_etfs.map(e => (
                      <button key={e} onClick={() => onClose(e)} style={{
                        ...S.num, fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 5,
                        border: `1px solid ${C.border}`, background: "transparent", color: C.accent, cursor: "pointer",
                      }}>{e}</button>
                    ))}
                  </div>
                </div>
              )}
              {r.watch_also?.length > 0 && (
                <div>
                  <div style={{ ...S.label, marginBottom: 6 }}>Comparable</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {r.watch_also.map(e => (
                      <span key={e} style={{
                        ...S.num, fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 5,
                        border: `1px solid ${C.borderSubtle}`, color: C.textMuted,
                      }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Earnings note */}
          {(t.earnings_date || p.earnings_date) && (
            <div style={{
              fontSize: 12, color: C.amber, marginBottom: 20,
              borderLeft: `2px solid ${C.amber}`, paddingLeft: 12,
            }}>
              Earnings {t.earnings_date || p.earnings_date}
            </div>
          )}

          {/* News */}
          {headlines.length > 0 && (
            <div>
              <div style={{ ...S.label, marginBottom: 10 }}>Recent news</div>
              {headlines.map((h, i) => (
                <a key={i} href={h.url} target="_blank" rel="noreferrer" style={{
                  display: "block", padding: "10px 0", textDecoration: "none",
                  borderBottom: i < headlines.length - 1 ? `1px solid ${C.borderSubtle}` : "none",
                }}>
                  <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.45, marginBottom: 3 }}>{h.title}</div>
                  <div style={{ fontSize: 10.5, color: C.textDim }}>{h.source?.replace(/_/g, " ")}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Ticker Card ─────────────────────────────────────────────────
function TickerCard({ t, rank, onClick }) {
  const congressActive = t.congress_signal && !["neutral", "no_data"].includes(t.congress_signal)
  const congressBuy = congressActive && (t.congress_signal.includes("buy") || t.congress_signal === "bullish")

  // Pick ONE most important secondary signal
  let signal = null
  if (congressActive) signal = { text: `Congress ${congressBuy ? "buying" : "selling"}`, tone: congressBuy ? "green" : "red" }
  else if (t.volume_spike > 2) signal = { text: `${t.volume_spike}x volume`, tone: "amber" }
  else if (t.mentions > 20) signal = { text: `${t.mentions} mentions`, tone: "default" }
  else if (t.analyst_upside > 15) signal = { text: `${pct(t.analyst_upside)} analyst upside`, tone: "green" }

  return (
    <div onClick={() => onClick(t.ticker)} style={{
      ...S.card, padding: "14px 16px", cursor: "pointer", transition: "border-color 0.15s",
      ...(rank === 1 ? { borderColor: C.accent } : {}),
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = C.textDim}
      onMouseLeave={e => e.currentTarget.style.borderColor = rank === 1 ? C.accent : C.border}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>{t.ticker}</span>
        <Score value={t.composite_score} size="sm" />
      </div>
      <div style={{ fontSize: 10.5, color: C.textDim, marginBottom: 10 }}>{t.sector}</div>
      <div style={{ marginBottom: 10 }}>
        <Sparkline data={t.price_history} width={170} height={28} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ ...S.num, fontSize: 14.5, fontWeight: 650, color: C.text }}>
          {t.latest_close ? `$${fmt(t.latest_close)}` : "—"}
        </span>
        <span style={{ ...S.num, fontSize: 12, fontWeight: 600, color: changeColor(t.week_change_pct) }}>
          {pct(t.week_change_pct)}
        </span>
      </div>
      {signal && (
        <div style={{ marginTop: 10 }}>
          <Chip tone={signal.tone}>{signal.text}</Chip>
        </div>
      )}
    </div>
  )
}

// ─── Filters ─────────────────────────────────────────────────────
const FILTERS = [
  { id: "congress_buy", label: "Congress buying", test: t => t.congress_signal && ["bullish", "buy_cluster", "strong_buy_cluster"].includes(t.congress_signal) },
  { id: "congress_sell", label: "Congress selling", test: t => t.congress_signal && ["bearish", "sell_cluster", "strong_sell_cluster"].includes(t.congress_signal) },
  { id: "analyst_upgrade", label: "Analyst upgrades", test: t => t.analyst_action && ["upgrade", "strong_upgrade"].includes(t.analyst_action) },
  { id: "bullish_sent", label: "Bullish sentiment", test: t => (t.avg_sentiment || 0) > 0.1 },
  { id: "bearish_sent", label: "Bearish sentiment", test: t => (t.avg_sentiment || 0) < -0.1 },
  { id: "high_volume", label: "High volume", test: t => (t.volume_spike || 1) > 2 },
  { id: "high_short", label: "High short interest", test: t => (t.short_float_pct || 0) > 10 },
  { id: "oversold", label: "RSI oversold", test: t => t.rsi && t.rsi < 35 },
  { id: "uptrend", label: "30-day uptrend", test: t => t.trend_direction === "uptrend" },
  { id: "strong_signal", label: "5+ signals", test: t => (t.bullish_signals || 0) >= 5 },
]

const SORTS = [
  { id: "score", label: "Score", fn: (a, b) => (b.composite_score || 0) - (a.composite_score || 0) },
  { id: "price", label: "Price change", fn: (a, b) => (b.week_change_pct || 0) - (a.week_change_pct || 0) },
  { id: "mentions", label: "Social buzz", fn: (a, b) => (b.mentions || 0) - (a.mentions || 0) },
  { id: "volume", label: "Volume", fn: (a, b) => (b.volume_spike || 1) - (a.volume_spike || 1) },
  { id: "upside", label: "Analyst upside", fn: (a, b) => (b.analyst_upside || 0) - (a.analyst_upside || 0) },
]

function FilterBar({ allScores, activeFilters, setActiveFilters, sortBy, setSortBy, onTickerClick }) {
  const toggle = (id) => setActiveFilters(prev =>
    prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])

  const filtered = allScores.filter(t =>
    activeFilters.length === 0 || activeFilters.every(fid => FILTERS.find(f => f.id === fid)?.test(t)))
  const sorted = [...filtered].sort(SORTS.find(s => s.id === sortBy)?.fn || SORTS[0].fn)
  const counts = Object.fromEntries(FILTERS.map(f => [f.id, allScores.filter(f.test).length]))
  const isFiltered = activeFilters.length > 0

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={S.label}>Screen</span>
        {FILTERS.map(f => {
          const active = activeFilters.includes(f.id)
          return (
            <button key={f.id} onClick={() => toggle(f.id)} disabled={counts[f.id] === 0} style={{
              fontSize: 11.5, padding: "4px 11px", borderRadius: 6, cursor: counts[f.id] === 0 ? "default" : "pointer",
              border: `1px solid ${active ? C.accent : C.border}`,
              background: active ? C.accentDim : "transparent",
              color: active ? C.accent : counts[f.id] === 0 ? C.textDim : C.textMuted,
              opacity: counts[f.id] === 0 ? 0.4 : 1, fontWeight: 500,
            }}>
              {f.label} <span style={{ ...S.num, opacity: 0.7 }}>{counts[f.id]}</span>
            </button>
          )
        })}
        {isFiltered && (
          <button onClick={() => setActiveFilters([])} style={{
            fontSize: 11.5, padding: "4px 11px", borderRadius: 6, cursor: "pointer",
            border: "none", background: "transparent", color: C.red, fontWeight: 500,
          }}>Clear</button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={S.label}>Sort</span>
        {SORTS.map(s => (
          <button key={s.id} onClick={() => setSortBy(s.id)} style={{
            fontSize: 11.5, padding: "3px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500,
            border: "none", background: sortBy === s.id ? C.surfaceAlt : "transparent",
            color: sortBy === s.id ? C.text : C.textDim,
          }}>{s.label}</button>
        ))}
        {isFiltered && (
          <span style={{ fontSize: 12, color: C.textMuted, marginLeft: "auto" }}>
            {sorted.length} of {allScores.length} match
          </span>
        )}
      </div>

      {isFiltered && (
        <div style={{ marginTop: 16 }}>
          {sorted.length === 0 ? (
            <div style={{ ...S.card, padding: "2rem", textAlign: "center", color: C.textDim, fontSize: 13 }}>
              No tickers match all selected filters
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 10 }}>
              {sorted.slice(0, 20).map((t, i) => (
                <TickerCard key={t.ticker} t={t} rank={0} onClick={onTickerClick} />
              ))}
            </div>
          )}
          {sorted.length > 20 && (
            <div style={{ fontSize: 11.5, color: C.textDim, textAlign: "center", marginTop: 10 }}>
              Showing 20 of {sorted.length}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Congress Tab ────────────────────────────────────────────────
function CongressTab({ allScores, onTickerClick }) {
  const [congressData, setCongressData] = useState(null)

  useEffect(() => {
    axios.get(`${API}/api/congress`).then(r => setCongressData(r.data)).catch(() => setCongressData({ trades: [] }))
  }, [])

  // Aggregate view from scores
  const withCongress = allScores
    .filter(t => t.congress_signal && !["neutral", "no_data"].includes(t.congress_signal))
    .sort((a, b) => ((b.congress_buys || 0) + (b.congress_sells || 0)) - ((a.congress_buys || 0) + (a.congress_sells || 0)))

  const buying = withCongress.filter(t => ["bullish", "buy_cluster", "strong_buy_cluster"].includes(t.congress_signal))
  const selling = withCongress.filter(t => ["bearish", "sell_cluster", "strong_sell_cluster"].includes(t.congress_signal))

  const trades = congressData?.trades || []

  return (
    <div>
      <div style={{ marginBottom: "1.75rem" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Congressional trading</div>
        <div style={{ fontSize: 12.5, color: C.textMuted }}>
          STOCK Act disclosures from Capitol Trades, last 60 days. Signals derive from buy and sell clusters across members.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: "1.75rem" }}>
        {/* Buying */}
        <div style={{ ...S.card, padding: "16px 20px" }}>
          <div style={{ ...S.label, color: C.green, marginBottom: 12 }}>
            Cluster buying — {buying.length} tickers
          </div>
          {buying.length === 0 ? (
            <div style={{ fontSize: 12, color: C.textDim }}>No active buy clusters</div>
          ) : buying.map(t => (
            <div key={t.ticker} onClick={() => onTickerClick(t.ticker)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer",
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 650, color: C.text }}>{t.ticker}</span>
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: 8 }}>{t.sector}</span>
                {t.congress_buyers?.length > 0 && (
                  <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 2 }}>
                    {t.congress_buyers.slice(0, 3).join(", ")}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...S.num, fontSize: 12.5, fontWeight: 600 }}>
                  <span style={{ color: C.green }}>{t.congress_buys || 0}B</span>
                  <span style={{ color: C.textDim }}> / </span>
                  <span style={{ color: C.red }}>{t.congress_sells || 0}S</span>
                </div>
                <div style={{ fontSize: 10.5, color: changeColor(t.week_change_pct), marginTop: 2, ...S.num }}>
                  {pct(t.week_change_pct)} 1W
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Selling */}
        <div style={{ ...S.card, padding: "16px 20px" }}>
          <div style={{ ...S.label, color: C.red, marginBottom: 12 }}>
            Cluster selling — {selling.length} tickers
          </div>
          {selling.length === 0 ? (
            <div style={{ fontSize: 12, color: C.textDim }}>No active sell clusters</div>
          ) : selling.map(t => (
            <div key={t.ticker} onClick={() => onTickerClick(t.ticker)} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: `1px solid ${C.borderSubtle}`, cursor: "pointer",
            }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 650, color: C.text }}>{t.ticker}</span>
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: 8 }}>{t.sector}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...S.num, fontSize: 12.5, fontWeight: 600 }}>
                  <span style={{ color: C.green }}>{t.congress_buys || 0}B</span>
                  <span style={{ color: C.textDim }}> / </span>
                  <span style={{ color: C.red }}>{t.congress_sells || 0}S</span>
                </div>
                <div style={{ fontSize: 10.5, color: changeColor(t.week_change_pct), marginTop: 2, ...S.num }}>
                  {pct(t.week_change_pct)} 1W
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Individual trades feed if API provides them */}
      {trades.length > 0 && (
        <div style={{ ...S.card, padding: "16px 20px" }}>
          <div style={{ ...S.label, marginBottom: 12 }}>Recent transactions</div>
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
            gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}`,
          }}>
            {["Member", "Ticker", "Type", "Date", "Amount"].map(h => (
              <span key={h} style={{ ...S.label, fontSize: 10 }}>{h}</span>
            ))}
          </div>
          {trades.slice(0, 30).map((tr, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
              gap: 8, padding: "9px 0", borderBottom: `1px solid ${C.borderSubtle}`,
              alignItems: "center",
            }}>
              <span style={{ fontSize: 12.5, color: C.text }}>
                {tr.politician}
                {tr.party && <Chip tone={tr.party === "R" ? "rep" : "dem"} style={{ marginLeft: 6 }}>{tr.party}</Chip>}
              </span>
              <button onClick={() => onTickerClick(tr.ticker)} style={{
                background: "none", border: "none", cursor: "pointer", textAlign: "left",
                fontSize: 12.5, fontWeight: 650, color: C.accent, padding: 0, ...S.num,
              }}>{tr.ticker}</button>
              <span style={{ fontSize: 12, fontWeight: 600, color: tr.trade_type === "buy" ? C.green : C.red }}>
                {tr.trade_type?.toUpperCase()}
              </span>
              <span style={{ fontSize: 11.5, color: C.textMuted, ...S.num }}>{tr.trade_date}</span>
              <span style={{ fontSize: 11.5, color: C.textMuted }}>{tr.amount || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── History Tab ─────────────────────────────────────────────────
function HistoryTab({ onTickerClick }) {
  const [allHistory, setAllHistory] = useState(null)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [addStatus, setAddStatus] = useState("idle")

  useEffect(() => {
    axios.get(`${API}/api/history?days=30`).then(r => setAllHistory(r.data.history))
    axios.get(`${API}/api/watchlist`).then(r => setWatchlist(r.data.tickers || []))
  }, [])

  if (!allHistory) return (
    <div style={{ padding: "3rem", color: C.textDim, fontSize: 13, textAlign: "center" }}>Loading history</div>
  )

  const tickers = Object.keys(allHistory).filter(t => allHistory[t].length > 0)
    .sort((a, b) => {
      const as = allHistory[a].slice(-1)[0]?.composite_score || 0
      const bs = allHistory[b].slice(-1)[0]?.composite_score || 0
      return bs - as
    })

  const filtered = search.trim() ? tickers.filter(t => t.toLowerCase().includes(search.toLowerCase())) : tickers
  const display = selected.length > 0 ? selected : filtered.slice(0, 6)
  const daysTracked = allHistory[tickers[0]]?.length || 0

  const handleAdd = async (ticker) => {
    setAddStatus("loading")
    try {
      const r = await axios.post(`${API}/api/watchlist/${ticker}`)
      setAddStatus(r.data.success ? "success" : "error")
      if (r.data.success) {
        setWatchlist(prev => [...prev, ticker])
        setTimeout(() => { setSearch(""); setAddStatus("idle") }, 1500)
      }
    } catch { setAddStatus("error") }
  }

  const handleRemove = async (ticker) => {
    await axios.delete(`${API}/api/watchlist/${ticker}`)
    setWatchlist(prev => prev.filter(t => t !== ticker))
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Score history</div>
          <div style={{ fontSize: 12.5, color: C.textMuted }}>
            {daysTracked} day{daysTracked !== 1 ? "s" : ""} tracked across {tickers.length} tickers · snapshots daily at 6 AM
          </div>
        </div>
        <input value={search} onChange={e => { setSearch(e.target.value); setSelected([]) }}
          placeholder="Search ticker"
          style={{
            width: 200, padding: "7px 12px", border: `1px solid ${C.border}`, borderRadius: 7,
            fontSize: 12.5, background: C.surface, color: C.text, outline: "none",
          }} />
      </div>

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={S.label}>Watchlist</span>
          {watchlist.map(t => (
            <span key={t} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px",
            }}>
              <button onClick={() => onTickerClick(t)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11.5, fontWeight: 650, color: C.text, padding: 0, ...S.num,
              }}>{t}</button>
              <button onClick={() => handleRemove(t)} style={{
                background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 11, padding: 0,
              }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Ticker pills */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {filtered.map(t => {
          const hist = allHistory[t]
          const latest = hist[hist.length - 1]
          const isSel = selected.includes(t)
          return (
            <button key={t} onClick={() =>
              setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].slice(-4))
            } style={{
              ...S.num, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 5, cursor: "pointer",
              border: `1px solid ${isSel ? C.accent : C.border}`,
              background: isSel ? C.accentDim : "transparent",
              color: isSel ? C.accent : C.textMuted,
            }}>
              {t} <span style={{ opacity: 0.65 }}>{latest?.composite_score}</span>
            </button>
          )
        })}
      </div>

      {search && filtered.length === 0 && (
        <div style={{ ...S.card, padding: "2rem", textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6, ...S.num }}>{search.toUpperCase()}</div>
          <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 14 }}>
            Not tracked yet — add to watchlist to include in the next pipeline run
          </div>
          {addStatus === "idle" && (
            <button onClick={() => handleAdd(search.toUpperCase())} style={{
              fontSize: 12.5, fontWeight: 600, padding: "8px 18px", borderRadius: 7,
              cursor: "pointer", border: "none", background: C.accent, color: C.bg,
            }}>Add {search.toUpperCase()}</button>
          )}
          {addStatus === "loading" && <div style={{ fontSize: 12, color: C.textMuted }}>Validating</div>}
          {addStatus === "success" && <div style={{ fontSize: 12, color: C.green }}>Added</div>}
          {addStatus === "error" && <div style={{ fontSize: 12, color: C.red }}>Not found on markets</div>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
        {display.map(ticker => {
          const hist = allHistory[ticker] || []
          if (hist.length === 0) return null
          const latest = hist[hist.length - 1]
          const delta = latest.composite_score - hist[0].composite_score
          return (
            <div key={ticker} style={{ ...S.card, padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <button onClick={() => onTickerClick(ticker)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 15, fontWeight: 700, color: C.accent, padding: 0,
                  }}>{ticker}</button>
                  <span style={{ fontSize: 11, color: C.textDim }}>{latest.sector}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Score value={latest.composite_score} size="sm" />
                  <span style={{ ...S.num, fontSize: 11, marginLeft: 8, color: delta > 2 ? C.green : delta < -2 ? C.red : C.textDim }}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
                  </span>
                </div>
              </div>
              <HistoryChart history={hist} width={440} height={110} />
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
  const [amount, setAmount] = useState(1000)
  const [active, setActive] = useState(1)

  useEffect(() => { axios.get(`${API}/api/strategies`).then(r => setStrategies(r.data)) }, [])
  if (!strategies?.strategies) return (
    <div style={{ padding: "3rem", color: C.textDim, fontSize: 13, textAlign: "center" }}>Building strategies</div>
  )

  const strategy = strategies.strategies[active]
  const riskLabel = { 1: "Low risk", 2: "Medium risk", 3: "High risk" }
  const riskColor = { 1: C.green, 2: C.amber, 3: C.red }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Model portfolios</div>
          <div style={{ fontSize: 12.5, color: C.textMuted }}>
            Built from live signals — volatility, beta and 30-day trend determine allocation. Not financial advice.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>Amount</span>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.textMuted }}>$</span>
            <input type="number" value={amount} onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
              style={{
                width: 100, padding: "7px 10px 7px 22px", border: `1px solid ${C.border}`, borderRadius: 7,
                fontSize: 13, fontWeight: 600, background: C.surface, color: C.text, outline: "none", ...S.num,
              }} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem" }}>
        {strategies.strategies.map((s, i) => (
          <button key={s.name} onClick={() => setActive(i)} style={{
            flex: 1, padding: "12px 16px", borderRadius: 9, cursor: "pointer", textAlign: "left",
            border: `1px solid ${active === i ? riskColor[s.risk_level] : C.border}`,
            background: active === i ? C.surfaceAlt : "transparent",
          }}>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: C.text, marginBottom: 2 }}>{s.name}</div>
            <div style={{ fontSize: 11, color: riskColor[s.risk_level] }}>{riskLabel[s.risk_level]}</div>
            <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 2 }}>{s.expected_horizon}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14 }}>
        <div style={{ ...S.card, padding: "18px 22px" }}>
          <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
            {strategy.description}
          </div>
          {strategy.allocations.map(a => (
            <div key={a.ticker} style={{ padding: "12px 0", borderBottom: `1px solid ${C.borderSubtle}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <button onClick={() => onTickerClick(a.ticker)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 700, color: C.accent, padding: 0,
                  }}>{a.ticker}</button>
                  <Chip>{a.type}</Chip>
                  <span style={{ fontSize: 11, color: C.textDim }}>{a.sector}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ ...S.num, fontSize: 14.5, fontWeight: 650, color: C.text }}>
                    ${((a.allocation_pct / 100) * amount).toFixed(2)}
                  </span>
                  <span style={{ ...S.num, fontSize: 11, color: C.textDim, marginLeft: 6 }}>{a.allocation_pct}%</span>
                </div>
              </div>
              <div style={{ background: C.surfaceAlt, borderRadius: 2, height: 4, marginBottom: 8 }}>
                <div style={{
                  width: `${a.allocation_pct}%`, height: 4, borderRadius: 2,
                  background: a.type === "ETF" ? C.accent : C.green,
                }} />
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.45 }}>{a.rationale}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...S.card, padding: "14px 18px" }}>
            <div style={{ ...S.label, marginBottom: 10 }}>Allocation</div>
            <Row label="Stocks" value={`$${((strategy.stock_pct / 100) * amount).toFixed(2)}`} />
            <Row label="ETFs" value={`$${((strategy.etf_pct / 100) * amount).toFixed(2)}`} />
            <Row label="Horizon" value={strategy.expected_horizon} mono={false} />
          </div>
          <div style={{ ...S.card, padding: "14px 18px" }}>
            <div style={{ ...S.label, marginBottom: 10 }}>Considerations</div>
            {strategy.warnings.map((w, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 11.5, color: C.textMuted, marginBottom: 7, lineHeight: 1.45 }}>
                <span style={{ color: C.amber, flexShrink: 0 }}>–</span>{w}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Events Sidebar ──────────────────────────────────────────────
function EventsSidebar() {
  const [events, setEvents] = useState(null)
  useEffect(() => { axios.get(`${API}/api/events`).then(r => setEvents(r.data.events)).catch(() => setEvents([])) }, [])
  if (!events) return null

  // Group by date
  const grouped = events.reduce((acc, e) => {
    (acc[e.date] = acc[e.date] || []).push(e)
    return acc
  }, {})

  return (
    <div style={{ width: 250, flexShrink: 0, position: "sticky", top: 76, height: "fit-content" }}>
      <div style={{ ...S.label, marginBottom: 12 }}>Upcoming events</div>
      {events.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textDim }}>No major events in the next 14 days</div>
      ) : (
        Object.entries(grouped).map(([date, dayEvents]) => (
          <div key={date} style={{ marginBottom: 14 }}>
            <div style={{ ...S.num, fontSize: 11, color: C.textDim, marginBottom: 6 }}>
              {date}
              {dayEvents[0]?.is_today ? " · today" : dayEvents[0]?.is_tomorrow ? " · tomorrow" : ` · ${dayEvents[0]?.days_away}d`}
            </div>
            {dayEvents.map((e, i) => (
              <div key={i} style={{
                borderLeft: `2px solid ${e.impact === "high" ? C.red : C.amber}`,
                paddingLeft: 10, marginBottom: 6,
              }}>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{e.event}</div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

// ─── Sector Heatmap ──────────────────────────────────────────────
// Color intensity by % change. Hover to pop out the cell.
function heatColor(pct) {
  if (pct == null || Number.isNaN(pct)) return C.surfaceAlt
  const v = Math.max(-8, Math.min(8, pct))
  const intensity = Math.abs(v) / 8
  if (v > 0) {
    // green scale: darker green as more positive
    return `rgba(34, 192, 122, ${0.12 + intensity * 0.55})`
  } else if (v < 0) {
    return `rgba(229, 72, 77, ${0.12 + intensity * 0.55})`
  }
  return C.surfaceAlt
}

function HeatCell({ t, onClick }) {
  const [hover, setHover] = useState(false)
  const change = t.week_change_pct || 0
  return (
    <div
      onClick={() => onClick(t.ticker)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: heatColor(change),
        border: `1px solid ${hover ? C.text : "transparent"}`,
        borderRadius: 6,
        padding: hover ? "10px 12px" : "9px 11px",
        cursor: "pointer",
        transition: "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
        transform: hover ? "scale(1.06)" : "scale(1)",
        boxShadow: hover ? "0 6px 18px rgba(0,0,0,0.35)" : "none",
        zIndex: hover ? 10 : 1,
        position: "relative",
        minHeight: 58,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{t.ticker}</span>
        {t.composite_score != null && (
          <span style={{ ...S.num, fontSize: 10.5, fontWeight: 600, color: scoreColor(t.composite_score), opacity: 0.85 }}>
            {Number(t.composite_score).toFixed(0)}
          </span>
        )}
      </div>
      <div style={{
        ...S.num, fontSize: 12, fontWeight: 650,
        color: change > 0 ? C.green : change < 0 ? C.red : C.textMuted,
      }}>
        {pct(change)}
      </div>
      {hover && t.latest_close && (
        <div style={{ ...S.num, fontSize: 10, color: C.textDim, marginTop: 2 }}>
          ${fmt(t.latest_close)}
        </div>
      )}
    </div>
  )
}

function SectorHeatmap({ sectors, allScores, onTickerClick }) {
  // Sort sectors by average change desc
  const sortedSectors = [...sectors].sort((a, b) => b.avg_change - a.avg_change)

  // Build ticker list per sector from allScores (more complete than top_5)
  const tickersBySector = {}
  allScores.forEach(t => {
    const s = t.sector || "Other"
    if (!tickersBySector[s]) tickersBySector[s] = []
    tickersBySector[s].push(t)
  })

  // Sort each sector's tickers by absolute % change (biggest movers first)
  Object.keys(tickersBySector).forEach(s => {
    tickersBySector[s].sort((a, b) => Math.abs(b.week_change_pct || 0) - Math.abs(a.week_change_pct || 0))
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sortedSectors.map(sector => {
        const tickers = (tickersBySector[sector.sector] || []).slice(0, 8)
        if (tickers.length === 0) return null
        return (
          <div key={sector.sector}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: C.text }}>{sector.sector}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 10.5, color: C.textDim }}>
                  {tickers.length} ticker{tickers.length !== 1 ? "s" : ""}
                </span>
                <span style={{ ...S.num, fontSize: 12, fontWeight: 600, color: changeColor(sector.avg_change) }}>
                  {pct(sector.avg_change)} avg
                </span>
              </div>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(8, tickers.length)}, minmax(0, 1fr))`,
              gap: 6,
            }}>
              {tickers.map(t => (
                <HeatCell key={t.ticker} t={t} onClick={onTickerClick} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null)
  const [allScores, setAllScores] = useState([])
  const [macro, setMacro] = useState({})
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
      axios.get(`${API}/api/fear-greed`).catch(() => null),
      axios.get(`${API}/api/vix`).catch(() => null),
    ]).then(([summary, scores, fg, vix]) => {
      setData(summary.data)
      setAllScores(scores.data.scores || [])
      setMacro({ fg: fg?.data, vix: vix?.data })
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
  const handleModalClose = (switchTo) =>
    setSelectedTicker(typeof switchTo === "string" ? switchTo : null)

  if (loading) return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", height: "100vh",
      background: C.bg, color: C.textMuted, fontFamily: "system-ui", fontSize: 13,
    }}>Loading market data</div>
  )

  const fg = macro.fg
  const vix = macro.vix
  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "congress", label: "Congress" },
    { id: "history", label: "History" },
    { id: "strategies", label: "Strategies" },
  ]

  return (
    <div style={{
      background: C.bg, minHeight: "100vh", color: C.text,
      fontFamily: "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif",
    }}>
      {selectedTicker && (
        <Modal ticker={selectedTicker} data={data} allScores={allScores} onClose={handleModalClose} />
      )}

      {/* Top bar */}
      <div style={{
        borderBottom: `1px solid ${C.border}`, padding: "0 2rem",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 50, height: 54, background: C.bg,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <span style={{ fontSize: 14.5, fontWeight: 750, letterSpacing: "-0.3px" }}>MarketIntel</span>
          <nav style={{ display: "flex", gap: 4 }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                fontSize: 12.5, fontWeight: 550, padding: "6px 13px", borderRadius: 7,
                border: "none", cursor: "pointer",
                background: activeTab === tab.id ? C.surfaceAlt : "transparent",
                color: activeTab === tab.id ? C.text : C.textMuted,
              }}>{tab.label}</button>
            ))}
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* Macro inline */}
          {fg?.value != null && (
            <span style={{ fontSize: 11.5, color: C.textMuted }}>
              Fear &amp; Greed{" "}
              <span style={{ ...S.num, fontWeight: 650, color: fg.value <= 25 ? C.red : fg.value <= 45 ? C.amber : fg.value >= 75 ? C.green : C.text }}>
                {fg.value}
              </span>
              <span style={{ color: C.textDim }}> {fg.description}</span>
            </span>
          )}
          {vix?.value != null && (
            <span style={{ fontSize: 11.5, color: C.textMuted }}>
              VIX{" "}
              <span style={{ ...S.num, fontWeight: 650, color: vix.value >= 30 ? C.red : vix.value >= 20 ? C.amber : C.text }}>
                {vix.value}
              </span>
            </span>
          )}
          <span style={{ fontSize: 11, color: C.textDim, ...S.num }}>
            {data.total_tickers} tickers
          </span>
          <button onClick={handleRefresh} disabled={refreshing} style={{
            fontSize: 11.5, padding: "5px 13px", borderRadius: 6, fontWeight: 500,
            border: `1px solid ${C.border}`, background: "transparent",
            color: refreshing ? C.textDim : C.textMuted, cursor: refreshing ? "default" : "pointer",
          }}>{refreshing ? "Refreshing" : "Refresh"}</button>
        </div>
      </div>

      <main style={{ maxWidth: 1340, margin: "0 auto", padding: "1.75rem 1.5rem" }}>
        {activeTab === "history" ? (
          <HistoryTab onTickerClick={handleTickerClick} />
        ) : activeTab === "strategies" ? (
          <StrategiesTab onTickerClick={handleTickerClick} />
        ) : activeTab === "congress" ? (
          <CongressTab allScores={allScores} onTickerClick={handleTickerClick} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 28, alignItems: "start" }}>
            <div>
              {/* Summary strip */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0,
                marginBottom: "1.75rem", ...S.card, padding: "16px 0",
              }}>
                {(() => {
                  const bullishCount = allScores.filter(t => (t.bullish_signals || 0) >= 5).length
                  const congressActive = allScores.filter(t => t.congress_signal && !["neutral", "no_data"].includes(t.congress_signal)).length
                  return [
                    { label: "Top sector", value: data.top_sector, sub: pct(data.top_sector_change) + " 1W", subColor: changeColor(data.top_sector_change) },
                    { label: "Top stock", value: data.top5_stocks?.[0]?.ticker, sub: `score ${data.top5_stocks?.[0]?.composite_score}`, subColor: scoreColor(data.top5_stocks?.[0]?.composite_score) },
                    { label: "High-conviction", value: bullishCount, sub: "tickers with 5+ signals", subColor: bullishCount > 5 ? C.green : C.textDim },
                    { label: "Congress active", value: congressActive, sub: "tickers with cluster signal", subColor: congressActive > 0 ? C.accent : C.textDim },
                  ]
                })().map((m, i) => (
                  <div key={m.label} style={{
                    padding: "0 22px",
                    borderRight: i < 3 ? `1px solid ${C.borderSubtle}` : "none",
                  }}>
                    <div style={{ ...S.label, marginBottom: 6 }}>{m.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: "-0.3px" }}>{m.value}</div>
                    <div style={{ ...S.num, fontSize: 11.5, marginTop: 2, color: m.subColor }}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <FilterBar
                allScores={allScores.filter(t => !t.is_etf)}
                activeFilters={activeFilters} setActiveFilters={setActiveFilters}
                sortBy={sortBy} setSortBy={setSortBy}
                onTickerClick={handleTickerClick}
              />

              {activeFilters.length === 0 && (
                <>
                  {/* Top stocks */}
                  <section style={{ marginBottom: "1.75rem" }}>
                    <div style={{ ...S.label, marginBottom: 12 }}>Top stocks</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 10 }}>
                      {(data.top5_stocks || []).map((t, i) => (
                        <TickerCard key={t.ticker} t={t} rank={i + 1} onClick={handleTickerClick} />
                      ))}
                    </div>
                  </section>

                  {/* Top ETFs */}
                  <section style={{ marginBottom: "1.75rem" }}>
                    <div style={{ ...S.label, marginBottom: 12 }}>Top ETFs</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 10 }}>
                      {(data.top5_etfs || []).map((t, i) => (
                        <TickerCard key={t.ticker} t={t} rank={i + 1} onClick={handleTickerClick} />
                      ))}
                    </div>
                  </section>

                  {/* Sector heatmap */}
                  <section style={{ ...S.card, padding: "18px 22px" }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "baseline", marginBottom: 14,
                    }}>
                      <div style={S.label}>Sector heatmap — 1 week</div>
                      <div style={{ fontSize: 10.5, color: C.textDim }}>Hover to expand · click to open</div>
                    </div>
                    <SectorHeatmap sectors={data.sectors} allScores={allScores} onTickerClick={handleTickerClick} />
                  </section>
                </>
              )}
            </div>

            <EventsSidebar />
          </div>
        )}
      </main>
    </div>
  )
}
