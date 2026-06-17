from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import json
import math
import os
from datetime import datetime

app = FastAPI(title="MarketIntel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"]
)

pipeline_status = {"running": False, "last_run": None, "last_error": None}

def load_latest_scores():
    files = sorted([
        f for f in os.listdir("data/processed")
        if f.startswith("scores_") and f.endswith(".json")
    ])
    if not files:
        return None
    with open(f"data/processed/{files[-1]}") as f:
        return json.load(f)

def run_pipeline_task():
    pipeline_status["running"] = True
    pipeline_status["last_error"] = None
    try:
        import sys
        sys.path.insert(0, os.getcwd())
        from scheduler import run_pipeline
        run_pipeline()
        pipeline_status["last_run"] = datetime.utcnow().isoformat()
    except Exception as e:
        pipeline_status["last_error"] = str(e)
    finally:
        pipeline_status["running"] = False

DEPENDENCIES = {
    "NVDA": {"related_etfs": ["SOXX","SMH","XLK","QQQ"], "watch": ["AMD","TSMC","ASML"], "thesis": "AI chip demand, data center capex"},
    "AMD":  {"related_etfs": ["SOXX","SMH","XLK"], "watch": ["NVDA","INTC"], "thesis": "AI/CPU market share gains"},
    "MSFT": {"related_etfs": ["XLK","QQQ","SPY"], "watch": ["GOOGL","AMZN"], "thesis": "Azure cloud + Copilot AI adoption"},
    "META": {"related_etfs": ["XLK","QQQ"], "watch": ["GOOGL","SNAP"], "thesis": "Ad revenue recovery + AI infra spend"},
    "GOOGL":{"related_etfs": ["XLK","QQQ"], "watch": ["MSFT","META"], "thesis": "Search + cloud + Gemini AI"},
    "AAPL": {"related_etfs": ["XLK","QQQ","SPY"], "watch": ["MSFT","GOOGL"], "thesis": "iPhone cycle + services growth"},
    "AMZN": {"related_etfs": ["XLK","QQQ"], "watch": ["MSFT","GOOGL"], "thesis": "AWS cloud + ad business"},
    "TSLA": {"related_etfs": ["ICLN","XLK"], "watch": ["RIVN","NIO"], "thesis": "EV demand + energy storage + FSD"},
    "PLTR": {"related_etfs": ["XLK"], "watch": ["CRWD","PANW"], "thesis": "Govt AI contracts + AIP enterprise"},
    "CRWD": {"related_etfs": ["XLK"], "watch": ["PANW","ZS"], "thesis": "Endpoint security + AI-driven SOC"},
    "PANW": {"related_etfs": ["XLK"], "watch": ["CRWD","ZS"], "thesis": "Platform consolidation in cybersecurity"},
    "FSLR": {"related_etfs": ["ICLN","QCLN"], "watch": ["ENPH","NEE"], "thesis": "US solar manufacturing + IRA tailwinds"},
    "ENPH": {"related_etfs": ["ICLN"], "watch": ["FSLR","NEE"], "thesis": "Residential solar + battery storage"},
    "LLY":  {"related_etfs": ["XLV","IBB"], "watch": ["NVO","MRNA"], "thesis": "GLP-1 obesity drug dominance"},
    "MRNA": {"related_etfs": ["XLV","IBB"], "watch": ["PFE","BNTX"], "thesis": "mRNA platform beyond COVID"},
    "JPM":  {"related_etfs": ["XLF"], "watch": ["BAC","GS"], "thesis": "Rate environment + investment banking"},
    "GS":   {"related_etfs": ["XLF"], "watch": ["MS","JPM"], "thesis": "Deal flow recovery + trading revenue"},
    "V":    {"related_etfs": ["XLF"], "watch": ["MA","PYPL"], "thesis": "Consumer spend + cross-border transactions"},
    "SOXX": {"related_etfs": [], "watch": ["NVDA","AMD","AMAT"], "thesis": "Broad semiconductor exposure"},
    "SMH":  {"related_etfs": [], "watch": ["NVDA","TSM","ASML"], "thesis": "Top-heavy semi ETF, NVDA dominant"},
    "XLK":  {"related_etfs": [], "watch": ["AAPL","MSFT","NVDA"], "thesis": "Tech sector broad exposure"},
    "XLV":  {"related_etfs": [], "watch": ["LLY","UNH","JNJ"], "thesis": "Healthcare defensive + biotech upside"},
    "XLF":  {"related_etfs": [], "watch": ["JPM","BAC","GS"], "thesis": "Financials, rate-sensitive"},
    "ICLN": {"related_etfs": [], "watch": ["ENPH","FSLR","NEE"], "thesis": "Clean energy policy plays"},
    "QQQ":  {"related_etfs": [], "watch": ["AAPL","MSFT","NVDA"], "thesis": "Nasdaq 100, tech-heavy"},
    "SPY":  {"related_etfs": [], "watch": ["QQQ","IWM"], "thesis": "Broad S&P 500 market exposure"},
}

def generate_reasoning(ticker_data, price_data_map):
    ticker = ticker_data["ticker"]
    price_chg = ticker_data.get("week_change_pct", 0)
    sentiment = ticker_data.get("avg_sentiment", 0)
    mentions = ticker_data.get("mentions", 0)
    buzz = ticker_data.get("buzz_score", 0)
    price_score = ticker_data.get("price_score", 0)
    reddit_score = ticker_data.get("total_reddit_score", 0)
    p = price_data_map.get(ticker, {})
    vol_spike = p.get("volume_spike", 1.0)

    # New signal fields
    revenue_growth = ticker_data.get("revenue_growth")
    profit_margin = ticker_data.get("profit_margin")
    debt_equity = ticker_data.get("debt_equity")
    rsi = ticker_data.get("rsi")
    major_institutions = ticker_data.get("major_institutions", 0)
    insider_count = ticker_data.get("insider_count", 0)
    bullish_signals = ticker_data.get("bullish_signals", 0)

    # Initialize lists FIRST
    reasons = []
    watches = []

    # Price signals
    if price_score > 70:
        reasons.append(f"strong price momentum (+{price_chg:.1f}% this week)")
    elif price_score > 55:
        reasons.append(f"positive price action (+{price_chg:.1f}% this week)")
    if mentions > 5:
        reasons.append(f"high Reddit activity ({mentions} mentions)")
    if sentiment > 0.2:
        reasons.append("strongly bullish social sentiment")
    elif sentiment > 0.1:
        reasons.append("positive social sentiment")
    if vol_spike > 2:
        reasons.append(f"unusual volume ({vol_spike}x average) — institutional interest likely")
    if buzz > 60:
        reasons.append("trending across multiple platforms")

    # Fundamental signals
    if revenue_growth and revenue_growth > 15:
        reasons.append(f"strong revenue growth (+{revenue_growth}% YoY)")
    if profit_margin and profit_margin > 20:
        reasons.append(f"high profit margin ({profit_margin}%)")
    if major_institutions >= 2:
        reasons.append(f"{major_institutions} major institutions holding (Blackrock/Vanguard/Fidelity)")
    if insider_count > 0:
        reasons.append(f"{insider_count} insider Form 4 filing(s) — management activity detected")
    if rsi and rsi < 35:
        reasons.append(f"RSI {rsi} — oversold, potential bounce setup")
    if bullish_signals >= 5:
        reasons.append(f"rare high-confluence setup — {bullish_signals}/7 signals aligned")

    if not reasons:
        reasons.append("composite signal from price, sentiment and buzz")

    # Watches
    if sentiment < -0.1 and price_chg > 0:
        watches.append("price rising despite bearish sentiment — could reverse")
    if vol_spike > 3:
        watches.append("extreme volume spike may indicate short-term volatility")
    if mentions == 0:
        watches.append("no social signal — driven purely by price momentum")
    if price_chg > 15:
        watches.append("large weekly gain — watch for pullback")
    if sentiment < -0.2:
        watches.append("negative crowd sentiment despite high score")
    if debt_equity and debt_equity > 2:
        watches.append(f"high debt/equity ratio ({debt_equity}) — vulnerable to rate rises")
    if rsi and rsi > 70:
        watches.append(f"RSI {rsi} — overbought, momentum may slow")
    if revenue_growth and revenue_growth < 0:
        watches.append(f"negative revenue growth ({revenue_growth}%) — fundamentals weakening")
    if not watches:
        watches.append("monitor for broader market shifts")

    if mentions == 0:
        reddit_interp = "Not on Reddit's radar this week — price move is institutional or news-driven, not retail crowd."
    elif mentions <= 3:
        reddit_interp = f"Low Reddit chatter ({mentions} mentions). Early stage — crowd hasn't piled in yet, which can mean opportunity before momentum builds."
    elif mentions <= 8:
        reddit_interp = f"Moderate Reddit interest ({mentions} mentions). Growing awareness but not overcrowded — a reasonable entry window if fundamentals agree."
    else:
        reddit_interp = f"High Reddit buzz ({mentions} mentions). Crowd is heavily engaged — momentum is strong but be careful of buying at the peak of hype."

    if reddit_score > 2000:
        reddit_interp += " Posts are getting strong upvotes — high conviction from the community."
    elif reddit_score > 500:
        reddit_interp += " Decent community engagement on those posts."
    elif reddit_score < 50 and mentions > 3:
        reddit_interp += " Mentioned often but posts aren't getting upvoted much — could be noise."

    if sentiment > 0.3:
        sentiment_interp = "Strongly bullish — the language used around this stock is very positive. People are excited. Good momentum signal but watch for overconfidence."
    elif sentiment > 0.1:
        sentiment_interp = "Mildly bullish — more positive than negative discussion. Supportive signal for a potential entry."
    elif sentiment > -0.1:
        sentiment_interp = "Neutral — mixed or balanced discussion. No strong crowd conviction either way. Let price action lead."
    elif sentiment > -0.3:
        sentiment_interp = "Mildly bearish — more negative than positive discussion. Could mean concerns are building. Tread carefully."
    else:
        sentiment_interp = "Strongly bearish — crowd sentiment is negative. This could be a contrarian opportunity OR a warning sign — cross-check with fundamentals before acting."

    if sentiment > 0.1 and mentions > 5 and price_chg > 0:
        signal_call = "STRONG SIGNAL"
        signal_color = "green"
        signal_desc = "Price momentum, bullish sentiment, and Reddit buzz all aligned. Strongest setup this tool can identify."
    elif sentiment > 0.1 and price_chg > 0:
        signal_call = "BULLISH"
        signal_color = "green"
        signal_desc = "Positive price action backed by bullish sentiment. Solid setup."
    elif sentiment < -0.1 and price_chg > 3:
        signal_call = "WATCH CAREFULLY"
        signal_color = "amber"
        signal_desc = "Price is rising but crowd sentiment is negative. Could reverse — wait for sentiment to confirm before entering."
    elif price_chg > 5 and mentions == 0:
        signal_call = "PRICE ONLY"
        signal_color = "amber"
        signal_desc = "Strong price move with no social signal. Likely institutional — follow the money but no crowd confirmation yet."
    elif sentiment < -0.2 and price_chg < 0:
        signal_call = "AVOID SHORT TERM"
        signal_color = "red"
        signal_desc = "Both price and sentiment are negative. Not a good short-term entry."
    else:
        signal_call = "NEUTRAL"
        signal_color = "amber"
        signal_desc = "Mixed signals. No strong case for or against right now."

    deps = DEPENDENCIES.get(ticker, {"related_etfs": [], "watch": [], "thesis": ""})

    return {
        "reasons": reasons,
        "watches": watches,
        "related_etfs": deps["related_etfs"],
        "watch_also": deps["watch"],
        "thesis": deps["thesis"],
        "reddit_interp": reddit_interp,
        "sentiment_interp": sentiment_interp,
        "signal_call": signal_call,
        "signal_color": signal_color,
        "signal_desc": signal_desc
    }

@app.get("/")
def root():
    return {"status": "ok", "message": "MarketIntel API running"}

def sanitize_floats(obj):
    """Replace inf/nan with None for JSON serialization"""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_floats(v) for v in obj]
    return obj

@app.get("/api/summary")
def get_summary():
    data = load_latest_scores()
    if not data:
        return {"error": "No scored data found. Run scheduler.py first."}

    scores = data["scores"]
    sectors = data["sectors"]

    price_map = {}
    price_files = sorted([f for f in os.listdir("data/raw") if f.startswith("prices_")])
    if price_files:
        with open(f"data/raw/{price_files[-1]}") as f:
            for p in json.load(f):
                price_map[p["ticker"]] = p

    stocks = [s for s in scores if not s.get("is_etf")]
    etfs   = [s for s in scores if s.get("is_etf")]

    top5_stocks = stocks[:5]
    top5_etfs   = etfs[:5]

    for t in top5_stocks + top5_etfs:
        t["reasoning"] = generate_reasoning(t, price_map)
        p = price_map.get(t["ticker"], {})
        t["volume_spike"]  = p.get("volume_spike", 1.0)
        t["earnings_date"] = p.get("earnings_date")
        t["price_history"] = p.get("price_history", [])
        t["year_high"]     = p.get("year_high")
        t["year_low"]      = p.get("year_low")
        t["market_cap"]    = p.get("market_cap")
        t["pe_ratio"]      = p.get("pe_ratio")
        t["latest_close"]  = p.get("latest_close")

    top_sector = sectors[0] if sectors else {}

    return sanitize_floats({
        "generated_at":      data["generated_at"],
        "total_tickers":     len(scores),
        "top_sector":        top_sector.get("sector", ""),
        "top_sector_change": top_sector.get("avg_change", 0),
        "top5_stocks":       top5_stocks,
        "top5_etfs":         top5_etfs,
        "top5":              top5_stocks[:5],
        "sectors":           sectors
    })

@app.get("/api/sectors")
def get_sectors():
    data = load_latest_scores()
    if not data:
        return {"error": "No data found"}
    return {"sectors": data["sectors"]}

@app.get("/api/ticker/{ticker}/detail")
def get_ticker_detail(ticker: str):
    ticker = ticker.upper()
    data = load_latest_scores()
    if not data:
        return {"error": "No data found"}

    score_data = next((s for s in data["scores"] if s["ticker"] == ticker), {})

    price_data = {}
    price_files = sorted([f for f in os.listdir("data/raw") if f.startswith("prices_")])
    if price_files:
        with open(f"data/raw/{price_files[-1]}") as f:
            for p in json.load(f):
                if p["ticker"] == ticker:
                    price_data = p

    COMPANY_NAMES = {
        "MSFT": ["microsoft"], "AAPL": ["apple"], "NVDA": ["nvidia"],
        "AMD": ["amd", "advanced micro"], "GOOGL": ["google", "alphabet"],
        "AMZN": ["amazon"], "META": ["meta", "facebook"], "TSLA": ["tesla"],
        "JPM": ["jpmorgan", "jp morgan"], "BAC": ["bank of america"],
        "GS": ["goldman sachs", "goldman"], "V": ["visa"], "MA": ["mastercard"],
        "LLY": ["eli lilly", "lilly"], "JNJ": ["johnson & johnson", "j&j"],
        "UNH": ["unitedhealth", "united health"], "MRNA": ["moderna"],
        "ENPH": ["enphase"], "NEE": ["nextera"], "FSLR": ["first solar"],
        "PLTR": ["palantir"], "CRWD": ["crowdstrike"], "PANW": ["palo alto"],
        "SOXX": ["semiconductor"], "SMH": ["semiconductor"],
        "XLK": ["technology etf"], "XLV": ["healthcare etf"],
        "XLF": ["financial etf"], "ICLN": ["clean energy"],
        "QQQ": ["nasdaq", "qqq"], "SPY": ["s&p 500", "spy etf"]
    }

    search_terms = [ticker.lower()] + COMPANY_NAMES.get(ticker, [])

    headlines = []
    rss_files = sorted([f for f in os.listdir("data/raw") if f.startswith("rss_")])
    if rss_files:
        with open(f"data/raw/{rss_files[-1]}") as f:
            for a in json.load(f):
                text = f"{a.get('title', '')} {a.get('summary', '')}".lower()
                if any(term in text for term in search_terms):
                    headlines.append({
                        "title":        a.get("title", ""),
                        "source":       a.get("source", ""),
                        "url":          a.get("url", ""),
                        "published_at": a.get("published_at", "")
                    })

    return {
        "ticker":     ticker,
        "score_data": score_data,
        "price_data": price_data,
        "headlines":  headlines[:8]
    }

@app.get("/api/ticker/{ticker}")
def get_ticker(ticker: str):
    data = load_latest_scores()
    if not data:
        return {"error": "No data found"}
    ticker = ticker.upper()
    match = next((s for s in data["scores"] if s["ticker"] == ticker), None)
    if not match:
        return {"error": f"{ticker} not found"}
    return match

@app.get("/api/top")
def get_top(limit: int = 10):
    data = load_latest_scores()
    if not data:
        return {"error": "No data found"}
    return {"tickers": data["scores"][:limit]}

@app.post("/api/refresh")
def trigger_refresh(background_tasks: BackgroundTasks):
    if pipeline_status["running"]:
        return {"status": "already_running", "message": "Pipeline already running"}
    background_tasks.add_task(run_pipeline_task)
    return {"status": "started", "message": "Pipeline started in background"}

@app.get("/api/status")
def get_status():
    return pipeline_status

@app.get("/api/history/{ticker}")
def get_ticker_history(ticker: str, days: int = 30):
    from scoring.history import load_ticker_history
    ticker = ticker.upper()
    history = load_ticker_history(ticker, days=days)
    return {"ticker": ticker, "history": history}

@app.get("/api/history")
def get_all_history(days: int = 14):
    from scoring.history import load_all_history
    return {"history": load_all_history(days=days)}

@app.get("/api/strategies")
def get_strategies():
    data = load_latest_scores()
    if not data:
        return {"error": "No data found"}

    scores = data["scores"]
    sectors = data["sectors"]

    # Load price data for extra context
    price_map = {}
    price_files = sorted([f for f in os.listdir("data/raw") if f.startswith("prices_")])
    if price_files:
        with open(f"data/raw/{price_files[-1]}") as f:
            for p in json.load(f):
                price_map[p["ticker"]] = p

    stocks = [s for s in scores if not s.get("is_etf")]
    etfs = [s for s in scores if s.get("is_etf")]

    def enrich(t):
        p = price_map.get(t["ticker"], {})
        return {
            **t,
            "latest_close": p.get("latest_close"),
            "volume_spike": p.get("volume_spike", 1.0),
            "year_high": p.get("year_high"),
            "year_low": p.get("year_low"),
            "earnings_date": p.get("earnings_date"),
            "market_cap": p.get("market_cap"),
            "pe_ratio": p.get("pe_ratio"),
        }

    def momentum_score(t):
        return (
            t.get("week_change_pct", 0) * 0.4 +
            t.get("avg_sentiment", 0) * 20 +
            t.get("stocktwits_score", 0) * 15 +
            t.get("mentions", 0) * 0.5
        )

    def safety_score(t):
        vol = price_map.get(t["ticker"], {}).get("volume_spike", 1.0)
        chg = t.get("week_change_pct", 0)
        pe = price_map.get(t["ticker"], {}).get("pe_ratio") or 0
        # Penalize negative price movement heavily for conservative
        price_penalty = 30 if chg < 0 else 0
        safety = 100 - (vol * 10) - (abs(chg) * 0.5) - (max(0, pe - 30) * 0.2) - price_penalty
        return max(0, safety)

    top_stocks = [enrich(s) for s in stocks[:15]]
    top_etfs = [enrich(e) for e in etfs[:8]]

    # Sort by different criteria
    momentum_stocks = sorted(top_stocks, key=momentum_score, reverse=True)
    safe_stocks = sorted(top_stocks, key=lambda t: (
        t.get("composite_score", 0) * 0.4 +
        safety_score(t) * 0.6
    ), reverse=True)

    def build_aggressive():
        picks = [s for s in momentum_stocks if s.get("week_change_pct", 0) > 0][:3]
        if len(picks) < 3:
            picks = momentum_stocks[:3]
        etf_pick = top_etfs[0] if top_etfs else None
        allocations = []
        for i, t in enumerate(picks):
            pct = [50, 30, 15][i]
            allocations.append({
                "ticker": t["ticker"],
                "type": "Stock",
                "sector": t["sector"],
                "allocation_pct": pct,
                "composite_score": t["composite_score"],
                "week_change_pct": t["week_change_pct"],
                "rationale": f"Score {t['composite_score']}/100 — {'+' if t['week_change_pct'] >= 0 else ''}{t['week_change_pct']:.1f}% momentum this week",
                "horizon": "Short to medium term (days–weeks)",
                "earnings_date": t.get("earnings_date"),
            })
        if etf_pick:
            allocations.append({
                "ticker": etf_pick["ticker"],
                "type": "ETF",
                "sector": etf_pick["sector"],
                "allocation_pct": 5,
                "composite_score": etf_pick["composite_score"],
                "week_change_pct": etf_pick["week_change_pct"],
                "rationale": "Small ETF hedge to reduce single-stock risk",
                "horizon": "Flexible",
                "earnings_date": None,
            })
        return {
            "name": "Aggressive",
            "emoji": "🔥",
            "tagline": "High risk, high reward — momentum-driven picks",
            "risk_level": 3,
            "expected_horizon": "Days to weeks",
            "description": "Bets on the strongest momentum signals from Reddit, StockTwits and price action. These are the stocks the crowd is most excited about right now. Volatile — could move 10-20% either way quickly.",
            "stock_pct": 95,
            "etf_pct": 5,
            "allocations": allocations,
            "warnings": [
                "High volatility — only invest what you can afford to lose",
                "Momentum can reverse fast — set stop losses",
                "Check earnings dates before entering",
            ]
        }

    def build_balanced():
        picks = [s for s in top_stocks if s.get("composite_score", 0) >= 50][:2]
        if len(picks) < 2:
            picks = top_stocks[:2]
        etf_picks = top_etfs[:2]
        allocations = []
        stock_allocs = [35, 25]
        etf_allocs = [25, 15]
        for i, t in enumerate(picks):
            pct = stock_allocs[i] if i < len(stock_allocs) else 10
            allocations.append({
                "ticker": t["ticker"],
                "type": "Stock",
                "sector": t["sector"],
                "allocation_pct": pct,
                "composite_score": t["composite_score"],
                "week_change_pct": t["week_change_pct"],
                "rationale": f"Strong composite score {t['composite_score']}/100 with confirmed social signal",
                "horizon": "Medium term (1–3 months)",
                "earnings_date": t.get("earnings_date"),
            })
        for i, e in enumerate(etf_picks):
            pct = etf_allocs[i] if i < len(etf_allocs) else 10
            allocations.append({
                "ticker": e["ticker"],
                "type": "ETF",
                "sector": e["sector"],
                "allocation_pct": pct,
                "composite_score": e["composite_score"],
                "week_change_pct": e["week_change_pct"],
                "rationale": f"Sector ETF providing broad exposure with lower single-stock risk",
                "horizon": "Medium to long term",
                "earnings_date": None,
            })
        return {
            "name": "Balanced",
            "emoji": "⚖️",
            "tagline": "Mix of conviction stocks and sector ETFs",
            "risk_level": 2,
            "expected_horizon": "1 to 3 months",
            "description": "Combines the top scoring stocks with sector ETFs for diversification. You get exposure to momentum plays while ETFs cushion against individual stock blowups.",
            "stock_pct": 60,
            "etf_pct": 40,
            "allocations": allocations,
            "warnings": [
                "Still exposed to sector-wide downturns",
                "Rebalance monthly as scores update",
            ]
        }

    def build_conservative():
        etf_picks = top_etfs[:3]
        safe_pick = safe_stocks[0] if safe_stocks else None
        allocations = []
        etf_allocs = [40, 30, 20]
        for i, e in enumerate(etf_picks):
            pct = etf_allocs[i] if i < len(etf_allocs) else 10
            allocations.append({
                "ticker": e["ticker"],
                "type": "ETF",
                "sector": e["sector"],
                "allocation_pct": pct,
                "composite_score": e["composite_score"],
                "week_change_pct": e["week_change_pct"],
                "rationale": f"Diversified ETF exposure — reduced single-stock risk",
                "horizon": "Long term (6+ months)",
                "earnings_date": None,
            })
        if safe_pick:
            allocations.append({
                "ticker": safe_pick["ticker"],
                "type": "Stock",
                "sector": safe_pick["sector"],
                "allocation_pct": 10,
                "composite_score": safe_pick["composite_score"],
                "week_change_pct": safe_pick["week_change_pct"],
                "rationale": f"Single high-conviction stock with score {safe_pick['composite_score']}/100 and stable signals",
                "horizon": "Long term",
                "earnings_date": safe_pick.get("earnings_date"),
            })
        return {
            "name": "Conservative",
            "emoji": "🛡️",
            "tagline": "ETF-heavy, low volatility, long term",
            "risk_level": 1,
            "expected_horizon": "6+ months",
            "description": "Mostly ETFs for broad market exposure with one high-conviction stock. Designed to grow steadily over time with minimal panic-inducing volatility.",
            "stock_pct": 10,
            "etf_pct": 90,
            "allocations": allocations,
            "warnings": [
                "Lower upside — these won't 10x",
                "Best held for 6+ months to see meaningful returns",
            ]
        }

    return {
        "generated_at": data["generated_at"],
        "strategies": [
            build_aggressive(),
            build_balanced(),
            build_conservative(),
        ]
    }

@app.get("/api/events")
def get_events(days: int = 14):
    try:
        with open("data/processed/events.json") as f:
            data = json.load(f)
        return data
    except:
        from collectors.events_collector import get_upcoming_events
        events = get_upcoming_events(days_ahead=days)
        return {"events": events}