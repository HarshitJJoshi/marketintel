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

function Sparkline({ data, width = 100, height = 32 }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i/(data.length-1))*width},${height - ((v-min)/range)*(height-4) - 2}`).join(" ")
  const up = data[data.length-1] >= data[0]
  return (
    <svg width={width} height={height}>
      <polyline points={pts} fill="none" stroke={up ? "#5a9e3a" : "#d95f5f"} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

function ScoreArc({ value }) {
  const r = 26, circ = 2 * Math.PI * r
  const color = value >= 55 ? "#5a9e3a" : value >= 45 ? "#c8841a" : "#d95f5f"
  return (
    <svg width={64} height={64}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="#e8e4dc" strokeWidth={5}/>
      <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${(value/100)*circ} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 32 32)"/>
      <text x={32} y={37} textAnchor="middle" fontSize={13} fontWeight={600} fill={color}>{value}</text>
    </svg>
  )
}

function YearBar({ low, high, current }) {
  if (!low || !high || low >= high) return null
  const pct = Math.min(100, Math.max(0, ((current-low)/(high-low))*100))
  return (
    <div style={{marginTop:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#9a9690",marginBottom:3}}>
        <span>52w low ${fmt(low)}</span><span>52w high ${fmt(high)}</span>
      </div>
      <div style={{background:"#e8e4dc",borderRadius:3,height:4,position:"relative"}}>
        <div style={{width:`${pct}%`,height:4,borderRadius:3,background:"#7c6fcd"}}/>
        <div style={{position:"absolute",left:`${pct}%`,top:-3,transform:"translateX(-50%)",width:10,height:10,borderRadius:"50%",background:"#7c6fcd",border:"2px solid #fff"}}/>
      </div>
    </div>
  )
}

function HistoryChart({ history, width = 500 }) {
  if (!history || history.length < 2) return (
    <div style={{fontSize:12,color:"#9a9690",textAlign:"center",padding:"1rem",
      background:"#f0ede8",borderRadius:10}}>
      Not enough history yet — charts build up as the pipeline runs daily.
    </div>
  )
  const height = 120
  const padL = 36, padR = 16, padT = 10, padB = 24
  const W = width - padL - padR
  const H = height - padT - padB
  const scores = history.map(h => h.composite_score)
  const dates = history.map(h => h.date)
  const minS = Math.min(...scores), maxS = Math.max(...scores)
  const rangeS = maxS - minS || 1
  const scorePoints = scores.map((v, i) => {
    const x = padL + (i / (scores.length - 1)) * W
    const y = padT + H - ((v - minS) / rangeS) * H
    return `${x},${y}`
  }).join(" ")
  const step = Math.ceil(dates.length / 5)
  const labelIndices = dates.reduce((acc, d, i) => {
    if (i % step === 0 || i === dates.length - 1) acc.push(i)
    return acc
  }, [])
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c6fcd" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#7c6fcd" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((pct, i) => {
        const y = padT + H - pct * H
        const val = Math.round(minS + pct * rangeS)
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL+W} y2={y} stroke="#e8e4dc" strokeWidth="0.5"/>
            <text x={padL-4} y={y+4} textAnchor="end" fontSize={9} fill="#9a9690">{val}</text>
          </g>
        )
      })}
      <polygon
        points={`${padL},${padT+H} ${scorePoints} ${padL+W},${padT+H}`}
        fill="url(#scoreGrad)"/>
      <polyline points={scorePoints} fill="none" stroke="#7c6fcd"
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {scores.map((v, i) => {
        const x = padL + (i / (scores.length - 1)) * W
        const y = padT + H - ((v - minS) / rangeS) * H
        return <circle key={i} cx={x} cy={y} r="3" fill="#7c6fcd"/>
      })}
      {labelIndices.map((idx) => {
        const x = padL + (idx / (dates.length - 1)) * W
        const d = dates[idx]
        const label = `${d.slice(4,6)}/${d.slice(6,8)}`
        return <text key={idx} x={x} y={height-4} textAnchor="middle" fontSize={9} fill="#9a9690">{label}</text>
      })}
    </svg>
  )
}

function SentimentHistoryChart({ history, width = 500 }) {
  if (!history || history.length < 2) return null
  const height = 80
  const padL = 36, padR = 16, padT = 8, padB = 8
  const W = width - padL - padR
  const H = height - padT - padB
  const sentiments = history.map(h => h.avg_sentiment || 0)
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      <line x1={padL} y1={padT+H/2} x2={padL+W} y2={padT+H/2}
        stroke="#e8e4dc" strokeWidth="1" strokeDasharray="3 3"/>
      {sentiments.map((v, i) => {
        const x = padL + (i / sentiments.length) * W
        const barW = Math.max(2, W / sentiments.length - 2)
        const zeroY = padT + H/2
        const barH = Math.abs((v / 2) * H)
        const y = v >= 0 ? zeroY - barH : zeroY
        return (
          <rect key={i} x={x} y={y} width={barW} height={Math.max(1, barH)}
            fill={v > 0.1 ? "#5a9e3a" : v < -0.1 ? "#d95f5f" : "#c8841a"}
            opacity="0.7" rx="1"/>
        )
      })}
      <text x={padL-4} y={padT+8} textAnchor="end" fontSize={8} fill="#9a9690">+1</text>
      <text x={padL-4} y={padT+H/2+4} textAnchor="end" fontSize={8} fill="#9a9690">0</text>
      <text x={padL-4} y={padT+H} textAnchor="end" fontSize={8} fill="#9a9690">-1</text>
    </svg>
  )
}

function Modal({ ticker, data, onClose }) {
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState(null)
  const t = [...(data.top5_stocks||[]), ...(data.top5_etfs||[])].find(x => x.ticker === ticker)

  useEffect(() => {
    setDetail(null)
    setHistory(null)
    axios.get(`${API}/api/ticker/${ticker}/detail`).then(r => setDetail(r.data))
    axios.get(`${API}/api/history/${ticker}`).then(r => setHistory(r.data.history))
  }, [ticker])

  const r = t?.reasoning || {}
  const p = detail?.price_data || {}
  const priceHistory = p.price_history || t?.price_history || []
  const headlines = detail?.headlines || []

  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,background:"rgba(20,18,15,0.6)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:"1rem",backdropFilter:"blur(2px)"
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"#faf8f4",borderRadius:20,padding:"1.75rem",
        width:"100%",maxWidth:580,maxHeight:"88vh",
        overflowY:"auto",border:"1px solid #e8e4dc",
        boxShadow:"0 24px 64px rgba(0,0,0,0.15)"
      }}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <span style={{fontSize:26,fontWeight:600,letterSpacing:"-0.5px"}}>{ticker}</span>
              <span style={{fontSize:11,padding:"3px 9px",borderRadius:20,fontWeight:500,
                background:t?.is_etf?"#ede9fe":"#dcfce7",color:t?.is_etf?"#5b21b6":"#166534"}}>
                {t?.is_etf?"ETF":"Stock"}
              </span>
              {(t?.volume_spike||p.volume_spike) > 1.5 && (
                <span style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:"#fef3c7",color:"#92400e",fontWeight:500}}>
                  ⚡ {(t?.volume_spike||p.volume_spike)}x vol
                </span>
              )}
            </div>
            <div style={{fontSize:13,color:"#9a9690"}}>{t?.sector}</div>
          </div>
          <button onClick={onClose} style={{background:"#f0ede8",border:"none",borderRadius:8,
            width:32,height:32,cursor:"pointer",fontSize:16,color:"#9a9690",
            display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        {/* Price row */}
        <div style={{background:"#f0ede8",borderRadius:14,padding:"16px 18px",marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:20}}>
            <div>
              <div style={{fontSize:30,fontWeight:600,letterSpacing:"-1px",marginBottom:2}}>
                ${fmt(t?.latest_close || p.latest_close)}
              </div>
              <div style={{fontSize:15,fontWeight:500,marginBottom:14,
                color:t?.week_change_pct>=0?"#5a9e3a":"#d95f5f"}}>
                {t?.week_change_pct>=0?"▲":"▼"} {Math.abs(t?.week_change_pct||0).toFixed(2)}% this week
              </div>
              {priceHistory.length > 1
                ? <><Sparkline data={priceHistory} width={220} height={44}/>
                    <div style={{fontSize:10,color:"#b0ada8",marginTop:3}}>30-day price history</div></>
                : <div style={{fontSize:12,color:"#b0ada8",height:44,display:"flex",alignItems:"center"}}>
                    Loading chart...
                  </div>
              }
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <ScoreArc value={t?.composite_score||0}/>
              <div style={{fontSize:10,color:"#9a9690",marginTop:2}}>score</div>
            </div>
          </div>
        </div>

        {/* 52w range */}
        {(p.year_high||t?.year_high) > 0 && (
          <div style={{marginBottom:16}}>
            <YearBar low={p.year_low||t?.year_low} high={p.year_high||t?.year_high}
              current={t?.latest_close||p.latest_close}/>
          </div>
        )}

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
          {[
            {label:"Market cap", value:fmtCap(p.market_cap||t?.market_cap)},
            {label:"P/E ratio", value:(p.pe_ratio||t?.pe_ratio) ? fmt(p.pe_ratio||t?.pe_ratio,1) : "—"},
            {label:"Revenue growth", value: t?.revenue_growth != null ? `${t.revenue_growth > 0 ? "+" : ""}${t.revenue_growth}%` : "—"},
            {label:"Profit margin", value: t?.profit_margin != null ? `${t.profit_margin}%` : "—"},
            {label:"Debt/Equity", value: t?.debt_equity != null ? fmt(t.debt_equity,2) : "—"},
            {label:"Earnings beats", value: t?.earnings_surprise || "—"},
            {label:"RSI", value: t?.rsi || "—"},
            {label:"Institutions", value: t?.major_institutions != null ? `${t.major_institutions} major` : "—"},
            {label:"Insider filings", value: t?.insider_count != null ? `${t.insider_count} Form 4s` : "—"},
          ].map(m => (
            <div key={m.label} style={{background:"#f0ede8",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"#9a9690",marginBottom:3}}>{m.label}</div>
              <div style={{fontSize:14,fontWeight:600}}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Confluence indicator */}
        {t?.bullish_signals != null && (
          <div style={{
            marginBottom:16,borderRadius:12,padding:"12px 16px",
            background: t.bullish_signals >= 5 ? "#f0fdf4" : t.bullish_signals >= 4 ? "#fffbeb" : "#f5f3ef",
            border: `1px solid ${t.bullish_signals >= 5 ? "#86efac" : t.bullish_signals >= 4 ? "#fde68a" : "#e8e4dc"}`
          }}>
            <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:8,
              textTransform:"uppercase",letterSpacing:"0.07em"}}>Signal confluence</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{display:"flex",gap:4}}>
                {[1,2,3,4,5,6,7].map(i => (
                  <div key={i} style={{width:20,height:20,borderRadius:4,
                    background: i <= t.bullish_signals
                      ? t.bullish_signals >= 5 ? "#5a9e3a"
                      : t.bullish_signals >= 4 ? "#c8841a" : "#9a9690"
                      : "#e8e4dc",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:10,color:"#fff",fontWeight:600
                  }}>{i <= t.bullish_signals ? "✓" : ""}</div>
                ))}
              </div>
              <div style={{fontSize:13,color:"#3d3a36",fontWeight:500}}>
                {t.bullish_signals}/7 signals aligned
                {t.bullish_signals >= 5 && " — highest conviction"}
                {t.bullish_signals === 4 && " — strong setup"}
                {t.bullish_signals <= 3 && " — mixed signals"}
              </div>
            </div>
          </div>
        )}

        {/* Signal bars */}
        <div style={{background:"#f0ede8",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:12,
            textTransform:"uppercase",letterSpacing:"0.07em"}}>Signal breakdown</div>
          {[
            {label:"Price + RSI + breakout", value:t?.price_score||0, color:"#4f8ef7"},
            {label:"FinBERT sentiment", value:t?.sentiment_score||0,
              color:(t?.avg_sentiment||0)>0.1?"#5a9e3a":(t?.avg_sentiment||0)<-0.1?"#d95f5f":"#c8841a"},
            {label:"Social buzz", value:t?.buzz_score||0, color:"#7c6fcd"},
            {label:"StockTwits", value:t?.st_score||0, color:"#0ea5e9"},
            {label:"Fundamentals", value:t?.fundamental_score||50, color:"#059669"},
            {label:"Insider activity", value: t?.insider_count > 0 ? 75 : 50, color:"#dc2626"},
            {label:"Institutions", value: Math.min(100, (t?.major_institutions||0) * 20 + 40), color:"#7c3aed"},
          ].map(b => (
            <div key={b.label} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{fontSize:12,color:"#6b6862",width:120,flexShrink:0}}>{b.label}</div>
              <div style={{flex:1,background:"#e8e4dc",borderRadius:4,height:7}}>
                <div style={{width:`${b.value}%`,height:7,borderRadius:4,background:b.color}}/>
              </div>
              <div style={{fontSize:12,fontWeight:600,width:32,textAlign:"right"}}>{fmt(b.value,0)}</div>
            </div>
          ))}
        </div>

        {/* Historical charts */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:8,
            textTransform:"uppercase",letterSpacing:"0.07em"}}>Score history</div>
          <HistoryChart history={history} width={500}/>
          {history && history.length > 1 && (
            <>
              <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:4,marginTop:12,
                textTransform:"uppercase",letterSpacing:"0.07em"}}>Sentiment trend</div>
              <SentimentHistoryChart history={history} width={500}/>
            </>
          )}
        </div>

        {/* Signal interpretation */}
        {r.signal_call && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:10,
              textTransform:"uppercase",letterSpacing:"0.07em"}}>Signal interpretation</div>
            <div style={{borderRadius:12,padding:"12px 16px",marginBottom:10,
              background:r.signal_color==="green"?"#f0fdf4":r.signal_color==="red"?"#fef2f2":"#fffbeb",
              border:`1px solid ${r.signal_color==="green"?"#86efac":r.signal_color==="red"?"#fca5a5":"#fde68a"}`}}>
              <div style={{fontSize:12,fontWeight:700,letterSpacing:"0.05em",marginBottom:4,
                color:r.signal_color==="green"?"#166534":r.signal_color==="red"?"#991b1b":"#92400e"}}>
                {r.signal_call}
              </div>
              <div style={{fontSize:13,lineHeight:1.5,
                color:r.signal_color==="green"?"#166534":r.signal_color==="red"?"#991b1b":"#78350f"}}>
                {r.signal_desc}
              </div>
            </div>
            <div style={{background:"#f5f3ef",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:600,color:"#7c6fcd",marginBottom:4}}>Reddit signal</div>
              <div style={{fontSize:12,color:"#3d3a36",lineHeight:1.5}}>{r.reddit_interp}</div>
            </div>
            <div style={{background:"#f5f3ef",borderRadius:10,padding:"10px 14px"}}>
              <div style={{fontSize:11,fontWeight:600,marginBottom:4,
                color:(t?.avg_sentiment||0)>0.1?"#166534":(t?.avg_sentiment||0)<-0.1?"#991b1b":"#92400e"}}>
                Sentiment signal
              </div>
              <div style={{fontSize:12,color:"#3d3a36",lineHeight:1.5}}>{r.sentiment_interp}</div>
            </div>
          </div>
        )}

        {/* Why picked */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:8,
            textTransform:"uppercase",letterSpacing:"0.07em"}}>Why this pick</div>
          {r.thesis && (
            <div style={{fontSize:13,color:"#3d3a36",fontStyle:"italic",marginBottom:10,
              borderLeft:"3px solid #7c6fcd",paddingLeft:10,lineHeight:1.5}}>{r.thesis}</div>
          )}
          {(r.reasons||[]).map((reason,i) => (
            <div key={i} style={{display:"flex",gap:8,fontSize:13,color:"#3d3a36",marginBottom:5}}>
              <span style={{color:"#5a9e3a",flexShrink:0}}>✓</span>{reason}
            </div>
          ))}
        </div>

        {/* Watch out */}
        {(r.watches||[]).filter(w => w !== "monitor for broader market shifts").length > 0 && (
          <div style={{background:"#fff8ed",border:"1px solid #f5d98b",borderRadius:12,
            padding:"12px 14px",marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:"#92400e",marginBottom:8,
              textTransform:"uppercase",letterSpacing:"0.07em"}}>Watch out for</div>
            {r.watches.map((w,i) => (
              <div key={i} style={{display:"flex",gap:8,fontSize:13,color:"#78350f",marginBottom:4}}>
                <span style={{flexShrink:0}}>⚠</span>{w}
              </div>
            ))}
          </div>
        )}

        {/* Dependencies */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {r.related_etfs?.length > 0 && (
            <div style={{background:"#f0ede8",borderRadius:12,padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:8,
                textTransform:"uppercase",letterSpacing:"0.07em"}}>Related ETFs</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {r.related_etfs.map(e => (
                  <button key={e} onClick={()=>onClose(e)} style={{
                    fontSize:12,fontFamily:"monospace",fontWeight:600,
                    padding:"3px 10px",borderRadius:8,border:"1px solid #d4d0c8",
                    background:"#fff",color:"#5b21b6",cursor:"pointer"}}>{e}</button>
                ))}
              </div>
            </div>
          )}
          {r.watch_also?.length > 0 && (
            <div style={{background:"#f0ede8",borderRadius:12,padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:8,
                textTransform:"uppercase",letterSpacing:"0.07em"}}>Watch also</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {r.watch_also.map(e => (
                  <span key={e} style={{fontSize:12,fontFamily:"monospace",fontWeight:600,
                    padding:"3px 10px",borderRadius:8,border:"1px solid #d4d0c8",
                    background:"#fff",color:"#3d3a36"}}>{e}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Earnings */}
        {(p.earnings_date||t?.earnings_date) && (
          <div style={{background:"#fff8ed",border:"1px solid #f5d98b",borderRadius:10,
            padding:"10px 14px",marginBottom:16,fontSize:13,color:"#78350f",fontWeight:500}}>
            📅 Earnings date: {p.earnings_date||t?.earnings_date}
          </div>
        )}

        {/* News */}
        {!detail && (
          <div style={{fontSize:12,color:"#9a9690",textAlign:"center",padding:"1rem"}}>
            Loading news...
          </div>
        )}
        {detail && headlines.length > 0 && (
          <div>
            <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:8,
              textTransform:"uppercase",letterSpacing:"0.07em"}}>Recent news</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {headlines.map((h,i) => (
                <a key={i} href={h.url} target="_blank" rel="noreferrer" style={{
                  display:"block",padding:"10px 12px",background:"#f0ede8",
                  borderRadius:10,textDecoration:"none",color:"#3d3a36",
                  borderLeft:"3px solid #d4d0c8"}}>
                  <div style={{fontSize:13,lineHeight:1.4,marginBottom:3}}>{h.title}</div>
                  <div style={{fontSize:10,color:"#9a9690"}}>{h.source}</div>
                </a>
              ))}
            </div>
          </div>
        )}
        {detail && headlines.length === 0 && (
          <div style={{fontSize:12,color:"#b0ada8",textAlign:"center",padding:"0.5rem"}}>
            No news headlines found for {ticker} this week
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryTab({ onTickerClick }) {
  const [allHistory, setAllHistory] = useState(null)
  const [selectedTickers, setSelectedTickers] = useState([])

  useEffect(() => {
    axios.get(`${API}/api/history?days=30`).then(r => {
      setAllHistory(r.data.history)
      const tickers = Object.keys(r.data.history).slice(0, 6)
      setSelectedTickers(tickers)
    })
  }, [])

  if (!allHistory) return (
    <div style={{padding:"2rem",color:"#9a9690",fontSize:13,textAlign:"center"}}>
      Loading history...
    </div>
  )

  const tickers = Object.keys(allHistory).filter(t => allHistory[t].length > 0)
    .sort((a,b) => {
      const aScore = allHistory[a][allHistory[a].length-1]?.composite_score || 0
      const bScore = allHistory[b][allHistory[b].length-1]?.composite_score || 0
      return bScore - aScore
    })

 if (tickers.length === 0) return (
    <div style={{background:"#faf8f4",borderRadius:16,padding:"3rem 2rem",
      border:"1px solid #e8e4dc",textAlign:"center"}}>
      <div style={{fontSize:15,fontWeight:500,marginBottom:8}}>No history yet</div>
      <div style={{fontSize:13,color:"#9a9690",lineHeight:1.6}}>
        History builds automatically each time the pipeline runs.<br/>
        Give it a week of daily runs and the history charts will be genuinely powerful
        for spotting trends before the crowd does.
      </div>
    </div>
  )

  return (
    <div>

      {/* Insight banner */}
      <div style={{background:"#ede9fe",border:"1px solid #c4b5fd",
        borderRadius:16,padding:"1.25rem 1.5rem",marginBottom:"1.5rem"}}>
        <div style={{fontSize:14,fontWeight:600,color:"#5b21b6",marginBottom:6}}>
          History builds over time
        </div>
        <div style={{fontSize:13,color:"#6b6862",lineHeight:1.6,marginBottom:12}}>
          Give it a week of daily runs and the history charts will be genuinely powerful
          for spotting trends before the crowd does. Each morning at 7am a new snapshot
          is saved — you'll see which stocks consistently score high vs which ones spike
          once and fade.
        </div>
        <div style={{display:"flex",gap:10}}>
          {[
            {label:"Days tracked", value: allHistory[tickers[0]]?.length || 1},
            {label:"Tickers in history", value: tickers.length},
            {label:"Next run", value:"7:00 AM"},
          ].map(m => (
            <div key={m.label} style={{background:"rgba(255,255,255,0.7)",borderRadius:10,
              padding:"8px 14px",flex:1,textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:700,color:"#5b21b6"}}>{m.value}</div>
              <div style={{fontSize:10,color:"#9a9690",marginTop:2}}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:"#9a9690",marginBottom:10,
          textTransform:"uppercase",letterSpacing:"0.08em"}}>
          Select tickers to compare (up to 8)
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {tickers.map(t => {
            const hist = allHistory[t]
            const latest = hist[hist.length-1]
            const isEtf = latest?.is_etf
            return (
              <button key={t} onClick={() => {
                setSelectedTickers(prev =>
                  prev.includes(t)
                    ? prev.filter(x => x !== t)
                    : [...prev, t].slice(0, 8)
                )
              }} style={{
                fontSize:11,fontFamily:"monospace",fontWeight:600,
                padding:"4px 12px",borderRadius:8,cursor:"pointer",
                border: selectedTickers.includes(t) ? "1.5px solid #7c6fcd" : "1px solid #e8e4dc",
                background: selectedTickers.includes(t)
                  ? isEtf ? "#ede9fe" : "#dcfce7"
                  : "#faf8f4",
                color: selectedTickers.includes(t)
                  ? isEtf ? "#5b21b6" : "#166534"
                  : "#6b6862"
              }}>{t}</button>
            )
          })}
        </div>
      </div>

      {selectedTickers.length === 0 && (
        <div style={{fontSize:13,color:"#9a9690",textAlign:"center",padding:"2rem"}}>
          Select tickers above to view their history charts
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}}>
        {selectedTickers.map(ticker => {
          const hist = allHistory[ticker] || []
          if (hist.length === 0) return null
          const latest = hist[hist.length-1]
          const first = hist[0]
          const scoreDelta = latest.composite_score - first.composite_score
          const trend = scoreDelta > 2 ? "↑ rising" : scoreDelta < -2 ? "↓ falling" : "→ stable"
          const trendColor = scoreDelta > 2 ? "#5a9e3a" : scoreDelta < -2 ? "#d95f5f" : "#9a9690"

          return (
            <div key={ticker} style={{background:"#faf8f4",borderRadius:16,
              padding:"16px 18px",border:"1px solid #e8e4dc"}}>
              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <button onClick={() => onTickerClick(ticker)} style={{
                    fontFamily:"monospace",fontWeight:700,fontSize:16,
                    background:"none",border:"none",cursor:"pointer",
                    color:"#3d3a36",padding:0,textDecoration:"underline",
                    textDecorationColor:"#d4d0c8"
                  }}>{ticker}</button>
                  <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,fontWeight:500,
                    background:latest.is_etf?"#ede9fe":"#dcfce7",
                    color:latest.is_etf?"#5b21b6":"#166534"}}>
                    {latest.is_etf?"ETF":"Stock"}
                  </span>
                  <span style={{fontSize:11,color:"#9a9690"}}>{latest.sector}</span>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:15,fontWeight:700}}>{latest.composite_score}/100</div>
                  <div style={{fontSize:11,color:trendColor,fontWeight:500}}>{trend}</div>
                </div>
              </div>

              <div style={{marginBottom:6}}>
                <div style={{fontSize:10,color:"#9a9690",marginBottom:4}}>Composite score</div>
                <HistoryChart history={hist} width={460}/>
              </div>

              {hist.length > 1 && (
                <div>
                  <div style={{fontSize:10,color:"#9a9690",marginBottom:2,marginTop:8}}>Sentiment</div>
                  <SentimentHistoryChart history={hist} width={460}/>
                </div>
              )}

              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",marginTop:10,paddingTop:10,
                borderTop:"0.5px solid #e8e4dc"}}>
                <span style={{fontSize:11,color:"#9a9690"}}>
                  {hist.length} day{hist.length !== 1 ? "s" : ""} tracked
                </span>
                <div style={{display:"flex",gap:12}}>
                  <span style={{fontSize:11,color:"#9a9690"}}>
                    Price: <span style={{fontWeight:600,
                      color:latest.week_change_pct>=0?"#5a9e3a":"#d95f5f"}}>
                      {latest.week_change_pct>=0?"+":""}{fmt(latest.week_change_pct)}%
                    </span>
                  </span>
                  <span style={{fontSize:11,color:"#9a9690"}}>
                    Score Δ: <span style={{fontWeight:600,color:trendColor}}>
                      {scoreDelta>=0?"+":""}{scoreDelta.toFixed(1)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TickerCard({ t, rank, onClick }) {
  const up = t.week_change_pct >= 0
  return (
    <div onClick={() => onClick(t.ticker)} style={{
      background:"#faf8f4",borderRadius:16,padding:"16px",cursor:"pointer",
      border: rank === 1 ? "1.5px solid #7c6fcd" : "1px solid #e8e4dc",
      transition:"transform 0.15s, box-shadow 0.15s",
      boxShadow: rank === 1 ? "0 4px 20px rgba(124,111,205,0.15)" : "none"
    }}
    onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.08)" }}
    onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow=rank===1?"0 4px 20px rgba(124,111,205,0.15)":"none" }}
    >
      {rank === 1 && (
        <div style={{fontSize:10,background:"#ede9fe",color:"#5b21b6",padding:"2px 8px",
          borderRadius:10,fontWeight:600,display:"inline-block",marginBottom:8}}>
          top pick
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,fontFamily:"monospace",letterSpacing:"-0.3px"}}>{t.ticker}</div>
          <div style={{fontSize:10,color:"#9a9690",marginTop:1}}>{t.sector}</div>
        </div>
        <ScoreArc value={t.composite_score}/>
      </div>
      <div style={{marginBottom:8}}>
        <Sparkline data={t.price_history} width={160} height={28}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:18,fontWeight:600}}>${fmt(t.latest_close)}</span>
        <span style={{fontSize:13,fontWeight:600,color:up?"#5a9e3a":"#d95f5f"}}>
          {up?"+":""}{fmt(t.week_change_pct)}%
        </span>
      </div>
      {t.reasoning?.thesis && (
        <div style={{fontSize:11,color:"#6b6862",lineHeight:1.4,marginBottom:8,
          borderLeft:"2px solid #d4d0c8",paddingLeft:8}}>
          {t.reasoning.thesis}
        </div>
      )}
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {t.avg_sentiment > 0.1
          ? <span style={{fontSize:10,background:"#dcfce7",color:"#166534",padding:"2px 7px",borderRadius:8,fontWeight:500}}>bullish</span>
          : t.avg_sentiment < -0.1
          ? <span style={{fontSize:10,background:"#fee2e2",color:"#991b1b",padding:"2px 7px",borderRadius:8,fontWeight:500}}>bearish</span>
          : <span style={{fontSize:10,background:"#f3f4f6",color:"#6b7280",padding:"2px 7px",borderRadius:8,fontWeight:500}}>neutral</span>
        }
        {t.mentions > 0 && (
          <span style={{fontSize:10,background:"#ede9fe",color:"#5b21b6",padding:"2px 7px",borderRadius:8,fontWeight:500}}>
            {t.mentions} mentions
          </span>
        )}
        {t.volume_spike > 1.5 && (
          <span style={{fontSize:10,background:"#fef3c7",color:"#92400e",padding:"2px 7px",borderRadius:8,fontWeight:500}}>
            ⚡ {t.volume_spike}x vol
          </span>
        )}
        {t.earnings_date && (
          <span style={{fontSize:10,background:"#fff8ed",color:"#92400e",padding:"2px 7px",borderRadius:8,fontWeight:500}}>
            📅 {t.earnings_date}
          </span>
        )}
      </div>
      <div style={{marginTop:10,fontSize:11,color:"#9a9690",textAlign:"center"}}>
        click for full analysis →
      </div>
    </div>
  )
}

function SectorBar({ sectors }) {
  const max = Math.max(...sectors.map(s => Math.abs(s.avg_change)))
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {sectors.map(s => (
        <div key={s.sector} style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:12,color:"#6b6862",width:160,flexShrink:0,textAlign:"right"}}>{s.sector}</div>
          <div style={{flex:1,background:"#e8e4dc",borderRadius:4,height:8}}>
            <div style={{width:`${(Math.abs(s.avg_change)/max)*100}%`,height:8,borderRadius:4,
              background:s.avg_change>=0?"#5a9e3a":"#d95f5f",transition:"width 0.5s"}}/>
          </div>
          <div style={{fontSize:12,fontWeight:600,width:56,color:s.avg_change>=0?"#5a9e3a":"#d95f5f"}}>
            {s.avg_change>=0?"+":""}{s.avg_change.toFixed(2)}%
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
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {sectors.map(s => (
          <button key={s.sector} onClick={() => setActive(s)} style={{
            fontSize:12,padding:"6px 14px",borderRadius:20,cursor:"pointer",fontWeight:500,
            border:active?.sector===s.sector?"1.5px solid #7c6fcd":"1px solid #e8e4dc",
            background:active?.sector===s.sector?"#ede9fe":"#faf8f4",
            color:active?.sector===s.sector?"#5b21b6":"#6b6862"
          }}>{s.sector}</button>
        ))}
      </div>
      {active && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
          {active.top_5.map(t => (
            <div key={t.ticker} onClick={() => onTickerClick(t.ticker)} style={{
              background:"#f5f3ef",borderRadius:12,padding:"12px 14px",cursor:"pointer",
              border:"1px solid #e8e4dc",transition:"background 0.15s"
            }}
            onMouseEnter={e=>e.currentTarget.style.background="#edeae4"}
            onMouseLeave={e=>e.currentTarget.style.background="#f5f3ef"}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontFamily:"monospace",fontWeight:700,fontSize:14}}>{t.ticker}</span>
                  <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,fontWeight:500,
                    background:t.is_etf?"#ede9fe":"#dcfce7",color:t.is_etf?"#5b21b6":"#166534"}}>
                    {t.is_etf?"ETF":"Stock"}
                  </span>
                </div>
                <span style={{fontSize:14,fontWeight:700,color:t.week_change_pct>=0?"#5a9e3a":"#d95f5f"}}>
                  {t.week_change_pct>=0?"+":""}{t.week_change_pct.toFixed(2)}%
                </span>
              </div>
              <div style={{background:"#e8e4dc",borderRadius:3,height:5,marginBottom:6}}>
                <div style={{width:`${t.composite_score}%`,height:5,borderRadius:3,
                  background:t.composite_score>=55?"#5a9e3a":t.composite_score>=45?"#c8841a":"#d95f5f"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"#9a9690"}}>Score: {t.composite_score}</span>
                <span style={{fontSize:11,color:"#9a9690"}}>→ full analysis</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StrategiesTab({ onTickerClick }) {
  const [strategies, setStrategies] = useState(null)
  const [amount, setAmount] = useState(100)
  const [activeStrategy, setActiveStrategy] = useState(0)

  useEffect(() => {
    axios.get(`${API}/api/strategies`).then(r => setStrategies(r.data))
  }, [])

  if (!strategies) return (
    <div style={{padding:"2rem",color:"#9a9690",fontSize:13,textAlign:"center"}}>
      Building strategies from live data...
    </div>
  )

  const strategy = strategies.strategies[activeStrategy]

  const riskColors = {
    1: {bg:"#f0fdf4", border:"#86efac", text:"#166534", label:"Low risk"},
    2: {bg:"#fffbeb", border:"#fde68a", text:"#92400e", label:"Medium risk"},
    3: {bg:"#fef2f2", border:"#fca5a5", text:"#991b1b", label:"High risk"},
  }
  const rc = riskColors[strategy.risk_level]

  return (
    <div>
      {/* Header */}
      <div style={{background:"#faf8f4",borderRadius:16,padding:"1.25rem 1.5rem",
        border:"1px solid #e8e4dc",marginBottom:"1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Investment strategies</div>
            <div style={{fontSize:13,color:"#9a9690"}}>
              Built from live scores — updated every time the pipeline runs
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,color:"#6b6862"}}>I have</span>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",
                fontSize:14,color:"#3d3a36",fontWeight:500}}>$</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
                style={{width:100,paddingLeft:24,paddingRight:8,paddingTop:6,paddingBottom:6,
                  border:"1px solid #e8e4dc",borderRadius:8,fontSize:14,fontWeight:600,
                  background:"#f5f3ef",color:"#3d3a36",outline:"none"}}
              />
            </div>
            <span style={{fontSize:13,color:"#6b6862"}}>to invest</span>
          </div>
        </div>

        {/* Strategy selector */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
          {strategies.strategies.map((s, i) => (
            <button key={s.name} onClick={() => setActiveStrategy(i)} style={{
              padding:"12px 14px",borderRadius:12,cursor:"pointer",textAlign:"left",
              border: activeStrategy===i
                ? `1.5px solid ${riskColors[s.risk_level].border}`
                : "1px solid #e8e4dc",
              background: activeStrategy===i
                ? riskColors[s.risk_level].bg
                : "#f5f3ef",
            }}>
              <div style={{fontSize:18,marginBottom:4}}>{s.emoji}</div>
              <div style={{fontSize:13,fontWeight:600,color:"#3d3a36",marginBottom:2}}>{s.name}</div>
              <div style={{fontSize:11,color:"#9a9690"}}>{s.expected_horizon}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Active strategy detail */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 340px",gap:14}}>

        {/* Allocations */}
        <div style={{background:"#faf8f4",borderRadius:16,padding:"1.25rem 1.5rem",
          border:"1px solid #e8e4dc"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <span style={{fontSize:20}}>{strategy.emoji}</span>
            <div>
              <div style={{fontSize:15,fontWeight:700}}>{strategy.name} portfolio</div>
              <div style={{fontSize:12,color:"#9a9690"}}>{strategy.tagline}</div>
            </div>
          </div>

          <div style={{fontSize:13,color:"#6b6862",lineHeight:1.6,
            padding:"10px 0",borderBottom:"0.5px solid #e8e4dc",marginBottom:14}}>
            {strategy.description}
          </div>

          {/* Allocation bars */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {strategy.allocations.map(a => {
              const dollars = ((a.allocation_pct / 100) * amount).toFixed(2)
              return (
                <div key={a.ticker} style={{background:"#f5f3ef",borderRadius:12,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <button onClick={() => onTickerClick(a.ticker)} style={{
                        fontFamily:"monospace",fontWeight:700,fontSize:15,
                        background:"none",border:"none",cursor:"pointer",
                        color:"#3d3a36",padding:0,
                        textDecoration:"underline",textDecorationColor:"#d4d0c8"
                      }}>{a.ticker}</button>
                      <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,fontWeight:500,
                        background:a.type==="ETF"?"#ede9fe":"#dcfce7",
                        color:a.type==="ETF"?"#5b21b6":"#166534"}}>
                        {a.type}
                      </span>
                      <span style={{fontSize:11,color:"#9a9690"}}>{a.sector}</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:15,fontWeight:700,color:"#3d3a36"}}>
                        ${dollars}
                      </div>
                      <div style={{fontSize:11,color:"#9a9690"}}>{a.allocation_pct}%</div>
                    </div>
                  </div>

                  {/* Allocation bar */}
                  <div style={{background:"#e8e4dc",borderRadius:4,height:6,marginBottom:8}}>
                    <div style={{
                      width:`${a.allocation_pct}%`,height:6,borderRadius:4,
                      background:a.type==="ETF"?"#7c6fcd":"#5a9e3a"
                    }}/>
                  </div>

                  <div style={{fontSize:11,color:"#6b6862",marginBottom:6,lineHeight:1.4}}>
                    {a.rationale}
                  </div>

                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:10,color:"#9a9690"}}>⏱ {a.horizon}</span>
                    {a.week_change_pct != null && (
                      <span style={{fontSize:10,fontWeight:500,
                        color:a.week_change_pct>=0?"#5a9e3a":"#d95f5f"}}>
                        {a.week_change_pct>=0?"+":""}{a.week_change_pct.toFixed(1)}% this week
                      </span>
                    )}
                    {a.earnings_date && (
                      <span style={{fontSize:10,background:"#fff8ed",color:"#92400e",
                        padding:"1px 6px",borderRadius:6}}>
                        📅 {a.earnings_date}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel — summary */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Risk badge */}
          <div style={{background:rc.bg,border:`1px solid ${rc.border}`,
            borderRadius:14,padding:"14px 16px"}}>
            <div style={{fontSize:11,fontWeight:600,color:rc.text,marginBottom:6,
              textTransform:"uppercase",letterSpacing:"0.07em"}}>Risk level</div>
            <div style={{display:"flex",gap:4,marginBottom:8}}>
              {[1,2,3].map(i => (
                <div key={i} style={{flex:1,height:8,borderRadius:4,
                  background:i<=strategy.risk_level?rc.border:"#e8e4dc"}}/>
              ))}
            </div>
            <div style={{fontSize:13,fontWeight:600,color:rc.text}}>{rc.label}</div>
          </div>

          {/* Split summary */}
          <div style={{background:"#faf8f4",borderRadius:14,padding:"14px 16px",
            border:"1px solid #e8e4dc"}}>
            <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:12,
              textTransform:"uppercase",letterSpacing:"0.07em"}}>Allocation split</div>
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",
                fontSize:12,marginBottom:4}}>
                <span style={{color:"#5a9e3a",fontWeight:500}}>Stocks</span>
                <span style={{fontWeight:600}}>${((strategy.stock_pct/100)*amount).toFixed(2)}</span>
              </div>
              <div style={{background:"#e8e4dc",borderRadius:4,height:8}}>
                <div style={{width:`${strategy.stock_pct}%`,height:8,borderRadius:4,background:"#5a9e3a"}}/>
              </div>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",
                fontSize:12,marginBottom:4}}>
                <span style={{color:"#7c6fcd",fontWeight:500}}>ETFs</span>
                <span style={{fontWeight:600}}>${((strategy.etf_pct/100)*amount).toFixed(2)}</span>
              </div>
              <div style={{background:"#e8e4dc",borderRadius:4,height:8}}>
                <div style={{width:`${strategy.etf_pct}%`,height:8,borderRadius:4,background:"#7c6fcd"}}/>
              </div>
            </div>
          </div>

          {/* Horizon */}
          <div style={{background:"#faf8f4",borderRadius:14,padding:"14px 16px",
            border:"1px solid #e8e4dc"}}>
            <div style={{fontSize:11,fontWeight:600,color:"#9a9690",marginBottom:8,
              textTransform:"uppercase",letterSpacing:"0.07em"}}>Time horizon</div>
            <div style={{fontSize:14,fontWeight:600,color:"#3d3a36",marginBottom:4}}>
              {strategy.expected_horizon}
            </div>
            <div style={{fontSize:12,color:"#9a9690"}}>
              {strategy.risk_level === 3 && "Monitor daily — momentum can shift fast"}
              {strategy.risk_level === 2 && "Check weekly — rebalance monthly"}
              {strategy.risk_level === 1 && "Set and forget — review every 3 months"}
            </div>
          </div>

          {/* Warnings */}
          <div style={{background:"#fff8ed",border:"1px solid #f5d98b",
            borderRadius:14,padding:"14px 16px"}}>
            <div style={{fontSize:11,fontWeight:600,color:"#92400e",marginBottom:8,
              textTransform:"uppercase",letterSpacing:"0.07em"}}>Keep in mind</div>
            {strategy.warnings.map((w,i) => (
              <div key={i} style={{display:"flex",gap:6,fontSize:12,
                color:"#78350f",marginBottom:6,lineHeight:1.4}}>
                <span style={{flexShrink:0}}>⚠</span>{w}
              </div>
            ))}
            <div style={{fontSize:11,color:"#9a9690",marginTop:8,
              paddingTop:8,borderTop:"0.5px solid #f5d98b"}}>
              Not financial advice — based on algorithmic signals only.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState(null)
  const [activeTab, setActiveTab] = useState("dashboard")

  const fetchData = useCallback(() => {
    axios.get(`${API}/api/summary`).then(res => {
      setData(res.data)
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
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",
      background:"#faf8f4",color:"#9a9690",fontFamily:"system-ui"}}>
      Loading market data...
    </div>
  )

  return (
    <div style={{background:"#f5f3ef",minHeight:"100vh",fontFamily:"system-ui,sans-serif",color:"#3d3a36"}}>
      {selectedTicker && <Modal ticker={selectedTicker} data={data} onClose={handleModalClose}/>}

      {/* Top bar */}
      <div style={{background:"#faf8f4",borderBottom:"1px solid #e8e4dc",padding:"0 2rem",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        position:"sticky",top:0,zIndex:50,height:56}}>
        <div style={{display:"flex",alignItems:"center",gap:24}}>
          <div style={{fontSize:16,fontWeight:700,letterSpacing:"-0.5px"}}>Market Intelligence</div>
          <div style={{display:"flex",gap:2}}>
            {["dashboard","history","strategies"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                fontSize:12,fontWeight:500,padding:"6px 14px",borderRadius:8,
                border:"none",cursor:"pointer",
                background:activeTab===tab?"#ede9fe":"transparent",
                color:activeTab===tab?"#5b21b6":"#6b6862"
              }}>{tab.charAt(0).toUpperCase()+tab.slice(1)}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:11,color:"#9a9690"}}>
            {data.total_tickers} tickers · {new Date(data.generated_at).toLocaleString()}
          </span>
          <span style={{fontSize:11,background:"#dcfce7",color:"#166534",
            padding:"4px 12px",borderRadius:20,fontWeight:600}}>● Live</span>
          <button onClick={handleRefresh} disabled={refreshing} style={{
            fontSize:12,padding:"6px 14px",borderRadius:8,fontWeight:500,
            border:"1px solid #e8e4dc",background:refreshing?"#f5f3ef":"#faf8f4",
            color:refreshing?"#9a9690":"#3d3a36",cursor:refreshing?"not-allowed":"pointer"
          }}>
            {refreshing?"Refreshing...":"↻ Refresh"}
          </button>
        </div>
      </div>

      <div style={{maxWidth:1080,margin:"0 auto",padding:"2rem 1.5rem"}}>
        {activeTab === "history" ? (
          <HistoryTab onTickerClick={handleTickerClick}/>
        ) : activeTab === "strategies" ? (
          <StrategiesTab onTickerClick={handleTickerClick}/>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:"2rem"}}>
              {[
                {label:"Top sector", value:data.top_sector, sub:`+${data.top_sector_change}% avg this week`},
                {label:"Tickers tracked", value:data.total_tickers, sub:"across all sectors"},
                {label:"Top stock pick", value:data.top5_stocks?.[0]?.ticker, sub:`score ${data.top5_stocks?.[0]?.composite_score}/100`},
                {label:"Top ETF pick", value:data.top5_etfs?.[0]?.ticker, sub:`score ${data.top5_etfs?.[0]?.composite_score}/100`},
              ].map(m => (
                <div key={m.label} style={{background:"#faf8f4",borderRadius:14,padding:"16px 18px",border:"1px solid #e8e4dc"}}>
                  <div style={{fontSize:11,color:"#9a9690",marginBottom:6,fontWeight:500}}>{m.label}</div>
                  <div style={{fontSize:22,fontWeight:700,letterSpacing:"-0.5px"}}>{m.value}</div>
                  <div style={{fontSize:11,color:"#9a9690",marginTop:4}}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Sector momentum */}
            <div style={{background:"#faf8f4",borderRadius:16,padding:"1.25rem 1.5rem",
              border:"1px solid #e8e4dc",marginBottom:"2rem"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9a9690",marginBottom:16,
                textTransform:"uppercase",letterSpacing:"0.08em"}}>
                Sector momentum this week
              </div>
              <SectorBar sectors={data.sectors}/>
            </div>

            {/* Top 5 Stocks */}
            <div style={{marginBottom:"2rem"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:14}}>
                <div style={{fontSize:16,fontWeight:700}}>Top 5 Stocks</div>
                <div style={{fontSize:12,color:"#9a9690"}}>ranked by composite score · click for full analysis</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12}}>
                {(data.top5_stocks||[]).map((t,i) => (
                  <TickerCard key={t.ticker} t={t} rank={i+1} onClick={handleTickerClick}/>
                ))}
              </div>
            </div>

            {/* Top 5 ETFs */}
            <div style={{marginBottom:"2rem"}}>
              <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:14}}>
                <div style={{fontSize:16,fontWeight:700}}>Top 5 ETFs</div>
                <div style={{fontSize:12,color:"#9a9690"}}>diversified exposure · click for full analysis</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:12}}>
                {(data.top5_etfs||[]).map((t,i) => (
                  <TickerCard key={t.ticker} t={t} rank={i+1} onClick={handleTickerClick}/>
                ))}
              </div>
            </div>

            {/* Sector drill-down */}
            <div style={{background:"#faf8f4",borderRadius:16,padding:"1.25rem 1.5rem",border:"1px solid #e8e4dc"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#9a9690",marginBottom:14,
                textTransform:"uppercase",letterSpacing:"0.08em"}}>
                Sector drill-down
              </div>
              <SectorDrilldown sectors={data.sectors} onTickerClick={handleTickerClick}/>
            </div>
          </>
        )}
      </div>
    </div>
  )
}