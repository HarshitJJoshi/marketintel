from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import json
import math
import os
from datetime import datetime, date
from dotenv import load_dotenv

load_dotenv()

# ─── Supabase client ──────────────────────────────────────────────
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

sb: Client = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        test = sb.table("scores").select("ticker").limit(1).execute()
        print(f"✓ Supabase connected — {len(test.data)} rows")
    except Exception as e:
        print(f"⚠ Supabase connection failed: {type(e).__name__}: {e}")
        sb = None
else:
    print(f"⚠ Supabase env vars missing")

app = FastAPI(title="MarketIntel API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

pipeline_status = {"running": False, "last_run": None, "last_error": None}

# ─── Data loading — Supabase first, JSON fallback ─────────────────

def get_latest_scores_from_supabase():
    """Load latest scores from Supabase, deduped by ticker (keep highest score)"""
    try:
        today = str(date.today())
        result = sb.table("scores").select("*").eq("date", today).order("composite_score", desc=True).execute()
        if not result.data:
            # Fallback to most recent date if today has no data
            result = sb.table("scores").select("*").order("date", desc=True).order("composite_score", desc=True).limit(400).execute()

        # Deduplicate — keep highest score per ticker
        seen = {}
        for row in (result.data or []):
            ticker = row["ticker"]
            if ticker not in seen or (row.get("composite_score") or 0) > (seen[ticker].get("composite_score") or 0):
                seen[ticker] = row
        return list(seen.values())
    except Exception as e:
        print(f"Supabase scores fetch failed: {e}")
        return []

def get_latest_price_map_from_supabase():
    """Load most recent price row per ticker — not filtered by today"""
    try:
        result = sb.table("price_data").select("*").order("date", desc=True).limit(300).execute()
        price_map = {}
        for p in (result.data or []):
            if p["ticker"] not in price_map:
                price_map[p["ticker"]] = p
        return price_map
    except Exception as e:
        print(f"Supabase price fetch failed: {e}")
        return {}

def get_macro_from_supabase():
    """Load macro data from Supabase"""
    try:
        today = str(date.today())
        result = sb.table("macro_data").select("*").eq("date", today).execute()
        if result.data:
            return result.data[0]
        result = sb.table("macro_data").select("*").order("date", desc=True).limit(1).execute()
        return result.data[0] if result.data else {}
    except Exception as e:
        print(f"Supabase macro fetch failed: {e}")
        return {}

def load_latest_scores():
    """Load scores — Supabase first, JSON fallback"""
    if sb:
        scores = get_latest_scores_from_supabase()
        if scores:
            # Reconstruct sector summary
            sectors = build_sector_summary(scores)
            return {
                "generated_at": scores[0].get("created_at", datetime.utcnow().isoformat()) if scores else datetime.utcnow().isoformat(),
                "scores": scores,
                "sectors": sectors
            }

    # JSON fallback
    files = sorted([f for f in os.listdir("data/processed") if f.startswith("scores_") and f.endswith(".json")])
    if not files:
        return None
    with open(f"data/processed/{files[-1]}") as f:
        return json.load(f)

def get_price_map():
    """Load price map — Supabase first, JSON fallback"""
    if sb:
        price_map = get_latest_price_map_from_supabase()
        if price_map:
            return price_map

    # JSON fallback
    price_map = {}
    price_files = sorted([f for f in os.listdir("data/raw") if f.startswith("prices_")])
    if price_files:
        with open(f"data/raw/{price_files[-1]}") as f:
            for p in json.load(f):
                price_map[p["ticker"]] = p
    return price_map

def build_sector_summary(scores):
    """Rebuild sector summary from flat scores list"""
    sector_data = {}
    for s in scores:
        sector = s.get("sector", "Other")
        if sector not in sector_data:
            sector_data[sector] = {"sector": sector, "tickers": [], "avg_change": 0, "top_score": 0}
        sector_data[sector]["tickers"].append(s)

    result = []
    for sector, data in sector_data.items():
        tickers = data["tickers"]
        valid = [t["week_change_pct"] for t in tickers if t.get("week_change_pct") is not None]
        data["avg_change"] = round(sum(valid) / len(valid), 2) if valid else 0
        data["top_score"] = round(max(t["composite_score"] for t in tickers if t.get("composite_score")), 1)
        data["top_5"] = sorted(tickers, key=lambda x: x.get("composite_score", 0), reverse=True)[:5]
        result.append(data)

    return sorted(result, key=lambda x: x["avg_change"], reverse=True)

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

# ─── Helpers ──────────────────────────────────────────────────────

def sanitize_floats(obj):
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_floats(v) for v in obj]
    return obj

def enrich_ticker(t, price_map):
    p = price_map.get(t["ticker"], {})
    return {
        **t,
        "volume_spike":  p.get("volume_spike", 1.0),
        "earnings_date": t.get("earnings_date") or p.get("earnings_date"),
        "price_history": p.get("price_history", []),
        "year_high":     p.get("year_high"),
        "year_low":      p.get("year_low"),
        "market_cap":    p.get("market_cap"),
        "pe_ratio":      p.get("pe_ratio"),
        "latest_close":  t.get("latest_close") or p.get("latest_close"),
    }

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
    "COST": {"related_etfs": ["XLY"], "watch": ["WMT","TGT"], "thesis": "Membership model + pricing power"},
    "DHR":  {"related_etfs": ["XLV"], "watch": ["TMO","ABT"], "thesis": "Life sciences tools + diagnostics"},
    "NET":  {"related_etfs": ["XLK"], "watch": ["CRWD","ZS"], "thesis": "Edge network + Zero Trust security"},
    "UNH":  {"related_etfs": ["XLV"], "watch": ["CVS","HUM"], "thesis": "Managed care + Optum health services"},
    "ABBV": {"related_etfs": ["XLV"], "watch": ["LLY","JNJ"], "thesis": "Humira successor + immunology pipeline"},
}

def generate_reasoning(ticker_data, price_data_map):
    ticker = ticker_data["ticker"]
    price_chg = ticker_data.get("week_change_pct", 0) or 0
    sentiment = ticker_data.get("avg_sentiment", 0) or 0
    mentions = ticker_data.get("mentions", 0) or 0
    buzz = ticker_data.get("buzz_score", 0) or 0
    price_score = ticker_data.get("price_score", 0) or 0
    reddit_score = ticker_data.get("total_reddit_score", 0) or 0
    p = price_data_map.get(ticker, {})
    vol_spike = p.get("volume_spike", 1.0) or 1.0
    revenue_growth = ticker_data.get("revenue_growth")
    profit_margin = ticker_data.get("profit_margin")
    debt_equity = ticker_data.get("debt_equity")
    rsi = ticker_data.get("rsi")
    major_institutions = ticker_data.get("major_institutions", 0) or 0
    insider_count = ticker_data.get("insider_count", 0) or 0
    bullish_signals = ticker_data.get("bullish_signals", 0) or 0

    reasons = []
    watches = []

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
        reasons.append(f"rare high-confluence setup — {bullish_signals}/12 signals aligned")
    if not reasons:
        reasons.append("composite signal from price, sentiment and buzz")

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
        reddit_interp = f"Low Reddit chatter ({mentions} mentions). Early stage — crowd hasn't piled in yet."
    elif mentions <= 8:
        reddit_interp = f"Moderate Reddit interest ({mentions} mentions). Growing awareness but not overcrowded."
    else:
        reddit_interp = f"High Reddit buzz ({mentions} mentions). Crowd heavily engaged — momentum strong but watch for peak hype."

    if reddit_score > 2000:
        reddit_interp += " Posts getting strong upvotes — high conviction from the community."
    elif reddit_score > 500:
        reddit_interp += " Decent community engagement."
    elif reddit_score < 50 and mentions > 3:
        reddit_interp += " Mentioned often but low upvotes — could be noise."

    if sentiment > 0.3:
        sentiment_interp = "Strongly bullish — very positive language around this stock."
    elif sentiment > 0.1:
        sentiment_interp = "Mildly bullish — more positive than negative discussion. Supportive signal."
    elif sentiment > -0.1:
        sentiment_interp = "Neutral — mixed discussion. No strong crowd conviction either way."
    elif sentiment > -0.3:
        sentiment_interp = "Mildly bearish — more negative than positive. Tread carefully."
    else:
        sentiment_interp = "Strongly bearish — negative crowd sentiment. Cross-check fundamentals before acting."

    if sentiment > 0.1 and mentions > 5 and price_chg > 0:
        signal_call, signal_color = "STRONG SIGNAL", "green"
        signal_desc = "Price momentum, bullish sentiment, and Reddit buzz all aligned."
    elif sentiment > 0.1 and price_chg > 0:
        signal_call, signal_color = "BULLISH", "green"
        signal_desc = "Positive price action backed by bullish sentiment. Solid setup."
    elif sentiment < -0.1 and price_chg > 3:
        signal_call, signal_color = "WATCH CAREFULLY", "amber"
        signal_desc = "Price rising but crowd sentiment negative. Could reverse."
    elif price_chg > 5 and mentions == 0:
        signal_call, signal_color = "PRICE ONLY", "amber"
        signal_desc = "Strong price move with no social signal. Likely institutional."
    elif sentiment < -0.2 and price_chg < 0:
        signal_call, signal_color = "AVOID SHORT TERM", "red"
        signal_desc = "Both price and sentiment negative. Not a good short-term entry."
    else:
        signal_call, signal_color = "NEUTRAL", "amber"
        signal_desc = "Mixed signals. No strong case for or against right now."

    deps = DEPENDENCIES.get(ticker, {"related_etfs": [], "watch": [], "thesis": ""})
    return {
        "reasons": reasons, "watches": watches,
        "related_etfs": deps["related_etfs"], "watch_also": deps["watch"],
        "thesis": deps["thesis"], "reddit_interp": reddit_interp,
        "sentiment_interp": sentiment_interp, "signal_call": signal_call,
        "signal_color": signal_color, "signal_desc": signal_desc
    }

# ─── API Endpoints ────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "MarketIntel API", "supabase": sb is not None}

@app.get("/api/summary")
def get_summary():
    data = load_latest_scores()
    if not data:
        return {"error": "No scored data found. Run scheduler.py first."}

    scores = data["scores"]
    sectors = data["sectors"]
    price_map = get_price_map()

    stocks = sorted([s for s in scores if not s.get("is_etf")], key=lambda x: x.get("composite_score", 0), reverse=True)
    etfs = sorted([s for s in scores if s.get("is_etf")], key=lambda x: x.get("composite_score", 0), reverse=True)

    top5_stocks = stocks[:5]
    top5_etfs = etfs[:5]

    for t in top5_stocks + top5_etfs:
        t["reasoning"] = generate_reasoning(t, price_map)
        p = price_map.get(t["ticker"], {})
        t["volume_spike"] = p.get("volume_spike", 1.0)
        t["earnings_date"] = t.get("earnings_date") or p.get("earnings_date")
        t["price_history"] = p.get("price_history", [])
        t["year_high"] = p.get("year_high")
        t["year_low"] = p.get("year_low")
        t["market_cap"] = p.get("market_cap")
        t["pe_ratio"] = p.get("pe_ratio")
        t["latest_close"] = t.get("latest_close") or p.get("latest_close")

    top_sector = sectors[0] if sectors else {}
    return sanitize_floats({
        "generated_at": data["generated_at"],
        "total_tickers": len(scores),
        "top_sector": top_sector.get("sector", ""),
        "top_sector_change": top_sector.get("avg_change", 0),
        "top5_stocks": top5_stocks,
        "top5_etfs": top5_etfs,
        "top5": top5_stocks[:5],
        "sectors": sectors
    })

@app.get("/api/scores")
def get_all_scores():
    data = load_latest_scores()
    if not data:
        return {"error": "No data found"}
    scores = data["scores"]
    price_map = get_price_map()
    enriched = []
    for t in scores:
        t = enrich_ticker(t, price_map)
        t["reasoning"] = generate_reasoning(t, price_map)
        enriched.append(t)
    return sanitize_floats({
        "generated_at": data["generated_at"],
        "total": len(enriched),
        "scores": enriched
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
    price_map = get_price_map()
    price_data = price_map.get(ticker, {})

    COMPANY_NAMES = {
        "MSFT": ["microsoft"], "AAPL": ["apple"], "NVDA": ["nvidia"],
        "AMD": ["amd", "advanced micro"], "GOOGL": ["google", "alphabet"],
        "AMZN": ["amazon"], "META": ["meta", "facebook"], "TSLA": ["tesla"],
        "JPM": ["jpmorgan"], "BAC": ["bank of america"], "GS": ["goldman sachs"],
        "V": ["visa"], "MA": ["mastercard"], "LLY": ["eli lilly", "lilly"],
        "JNJ": ["johnson"], "UNH": ["unitedhealth"], "MRNA": ["moderna"],
        "ENPH": ["enphase"], "NEE": ["nextera"], "FSLR": ["first solar"],
        "PLTR": ["palantir"], "CRWD": ["crowdstrike"], "PANW": ["palo alto"],
        "SOXX": ["semiconductor"], "SMH": ["semiconductor"],
        "XLK": ["technology etf"], "XLV": ["healthcare etf"],
        "XLF": ["financial etf"], "ICLN": ["clean energy"],
        "QQQ": ["nasdaq"], "SPY": ["s&p 500"],
        "COST": ["costco"], "SBUX": ["starbucks"], "NET": ["cloudflare"],
        "ABBV": ["abbvie"], "DHR": ["danaher"], "TMO": ["thermo fisher"],
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
                        "title": a.get("title", ""),
                        "source": a.get("source", ""),
                        "url": a.get("url", ""),
                        "published_at": a.get("published_at", "")
                    })

    return sanitize_floats({
        "ticker": ticker,
        "score_data": score_data,
        "price_data": price_data,
        "headlines": headlines[:8]
    })

@app.get("/api/ticker/{ticker}")
def get_ticker(ticker: str):
    ticker = ticker.upper()

    # Try Supabase first
    if sb:
        try:
            today = str(date.today())
            result = sb.table("scores").select("*").eq("ticker", ticker).eq("date", today).execute()
            if result.data:
                return result.data[0]
            # Try most recent date
            result = sb.table("scores").select("*").eq("ticker", ticker).order("date", desc=True).limit(1).execute()
            if result.data:
                return result.data[0]
        except Exception as e:
            print(f"Supabase ticker fetch failed: {e}")

    # JSON fallback
    data = load_latest_scores()
    if not data:
        return {"error": "No data found"}
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
        return {"status": "already_running"}
    background_tasks.add_task(run_pipeline_task)
    return {"status": "started", "message": "Pipeline started in background"}

@app.get("/api/status")
def get_status():
    return pipeline_status

@app.get("/api/debug")
def debug():
    return {
        "supabase_url_set": bool(SUPABASE_URL),
        "supabase_key_set": bool(SUPABASE_SERVICE_KEY),
        "sb_connected": sb is not None,
    }

@app.get("/api/history/{ticker}")
def get_ticker_history(ticker: str, days: int = 30):
    ticker = ticker.upper()

    # Try Supabase first
    if sb:
        try:
            result = sb.table("scores").select(
                "date,composite_score,avg_sentiment,week_change_pct,rsi,is_etf,sector,"
                "price_score,sentiment_score,buzz_score,st_score,fundamental_score,options_score,"
                "search_trend,unusual_options,momentum_30d,volatility_30d,trend_direction"
            ).eq("ticker", ticker).order("date", desc=True).limit(days).execute()
            history = list(reversed(result.data or []))
            return sanitize_floats({"ticker": ticker, "history": history})
        except Exception as e:
            print(f"Supabase history fetch failed: {e}")

    # JSON fallback
    from scoring.history import load_ticker_history
    history = load_ticker_history(ticker, days=days)
    return sanitize_floats({"ticker": ticker, "history": history})

@app.get("/api/history")
def get_all_history(days: int = 14):
    # Try Supabase first
    if sb:
        try:
            result = sb.table("scores").select(
                "date,ticker,composite_score,avg_sentiment,week_change_pct,rsi,is_etf,sector,"
                "price_score,sentiment_score,buzz_score,st_score,fundamental_score,options_score,"
                "search_trend,unusual_options,momentum_30d,volatility_30d,trend_direction"
            ).order("date", desc=True).limit(days * 200).execute()

            # Group by ticker
            history_map = {}
            for row in reversed(result.data or []):
                t = row["ticker"]
                if t not in history_map:
                    history_map[t] = []
                history_map[t].append(row)

            return sanitize_floats({"history": history_map})
        except Exception as e:
            print(f"Supabase all history fetch failed: {e}")

    # JSON fallback
    from scoring.history import load_all_history
    return sanitize_floats({"history": load_all_history(days=days)})

@app.get("/api/strategies")
def get_strategies():
    data = load_latest_scores()
    if not data:
        return {"error": "No data found"}

    scores = data["scores"]
    price_map = get_price_map()

    stocks = sorted([s for s in scores if not s.get("is_etf")], key=lambda x: x.get("composite_score", 0), reverse=True)
    etfs = sorted([s for s in scores if s.get("is_etf")], key=lambda x: x.get("composite_score", 0), reverse=True)

    def enrich(t):
        p = price_map.get(t["ticker"], {})
        return {**t,
            "latest_close": t.get("latest_close") or p.get("latest_close"),
            "volume_spike": p.get("volume_spike", 1.0),
            "year_high": p.get("year_high"), "year_low": p.get("year_low"),
            "earnings_date": t.get("earnings_date") or p.get("earnings_date"),
            "market_cap": p.get("market_cap"), "pe_ratio": p.get("pe_ratio")}

    def momentum_score(t):
        mom_30d = t.get("momentum_30d") or 0
        week_chg = t.get("week_change_pct", 0) or 0
        vol_tag = t.get("volatility_tag", "unknown")
        trend = t.get("trend_direction", "unknown")
        vol_bonus = 1.3 if vol_tag == "high" else 1.0 if vol_tag == "medium" else 0.8
        trend_bonus = 1.2 if trend == "uptrend" else 0.8 if trend == "downtrend" else 1.0
        return (mom_30d * 0.4 + week_chg * 0.3 + (t.get("avg_sentiment") or 0) * 15 +
                (t.get("mentions") or 0) * 0.3) * vol_bonus * trend_bonus

    def safety_score(t):
        vol_tag = t.get("volatility_tag", "unknown")
        beta = t.get("beta") or 1.0
        trend = t.get("trend_direction", "unknown")
        mom_30d = t.get("momentum_30d") or 0
        chg = t.get("week_change_pct", 0) or 0
        pe = t.get("pe_ratio") or 0
        return max(0,
            (30 if vol_tag == "low" else 15 if vol_tag == "medium" else 0) +
            (20 if beta < 0.8 else 10 if beta < 1.2 else 0) +
            (20 if trend == "uptrend" else 5 if trend == "sideways" else 0) +
            (15 if mom_30d > 5 else 5 if mom_30d > 0 else 0) -
            (max(0, (pe - 30) * 0.3) if pe > 30 else 0) -
            (20 if chg < 0 else 0))

    def balanced_score(t):
        trend = t.get("trend_direction", "unknown")
        vol_tag = t.get("volatility_tag", "unknown")
        mom_30d = t.get("momentum_30d") or 0
        trend_bonus = 1.2 if trend == "uptrend" else 0.9 if trend == "downtrend" else 1.0
        vol_penalty = 0.85 if vol_tag == "high" else 1.0
        return (t.get("composite_score") or 0) * trend_bonus * vol_penalty + mom_30d * 0.3

    def build_rationale(t, style="balanced"):
        parts = [f"Score {t.get('composite_score', 0)}/100"]
        mom = t.get("momentum_30d")
        if mom is not None: parts.append(f"{mom:+.1f}% over 30 days")
        trend = t.get("trend_direction", "")
        if trend in ["uptrend", "downtrend", "sideways"]: parts.append(f"{trend} confirmed")
        if style == "aggressive" and t.get("volatility_30d"): parts.append(f"vol {t['volatility_30d']:.0f}% annualized")
        if style == "conservative" and t.get("beta"): parts.append(f"beta {t['beta']:.1f}")
        return " | ".join(parts)

    top_stocks = [enrich(s) for s in stocks[:15]]
    top_etfs = [enrich(e) for e in etfs[:8]]
    momentum_stocks = sorted(top_stocks, key=momentum_score, reverse=True)
    safe_stocks = sorted(top_stocks, key=safety_score, reverse=True)
    balanced_stocks = sorted(top_stocks, key=balanced_score, reverse=True)

    def build_aggressive():
        picks = [s for s in momentum_stocks if (s.get("week_change_pct") or 0) > 0 and (s.get("momentum_30d") or 0) > 0][:3]
        if len(picks) < 3: picks = momentum_stocks[:3]
        etf_pick = top_etfs[0] if top_etfs else None
        allocations = []
        for i, t in enumerate(picks):
            allocations.append({"ticker": t["ticker"], "type": "Stock", "sector": t["sector"],
                "allocation_pct": [50, 30, 15][i], "composite_score": t["composite_score"],
                "week_change_pct": t["week_change_pct"], "momentum_30d": t.get("momentum_30d"),
                "volatility_30d": t.get("volatility_30d"), "trend_direction": t.get("trend_direction"),
                "rationale": build_rationale(t, "aggressive"), "horizon": "Days to weeks",
                "earnings_date": t.get("earnings_date")})
        if etf_pick:
            allocations.append({"ticker": etf_pick["ticker"], "type": "ETF", "sector": etf_pick["sector"],
                "allocation_pct": 5, "composite_score": etf_pick["composite_score"],
                "week_change_pct": etf_pick["week_change_pct"],
                "rationale": "Small ETF hedge", "horizon": "Flexible", "earnings_date": None})
        return {"name": "Aggressive", "emoji": "🔥", "tagline": "High volatility + strong 30d momentum",
            "risk_level": 3, "expected_horizon": "Days to weeks", "stock_pct": 95, "etf_pct": 5,
            "description": "Picks stocks with strongest 30-day momentum and upward trend, weighted for volatility.",
            "allocations": allocations,
            "warnings": ["High volatility — only invest what you can afford to lose",
                "Momentum can reverse fast — set stop losses", "Check earnings dates before entering"]}

    def build_balanced():
        picks = [s for s in balanced_stocks if (s.get("composite_score") or 0) >= 50
                 and s.get("trend_direction") in ["uptrend", "sideways"]][:2]
        if len(picks) < 2: picks = balanced_stocks[:2]
        etf_picks = top_etfs[:2]
        allocations = []
        for i, t in enumerate(picks):
            allocations.append({"ticker": t["ticker"], "type": "Stock", "sector": t["sector"],
                "allocation_pct": [35, 25][i], "composite_score": t["composite_score"],
                "week_change_pct": t["week_change_pct"], "momentum_30d": t.get("momentum_30d"),
                "trend_direction": t.get("trend_direction"), "rationale": build_rationale(t, "balanced"),
                "horizon": "1 to 3 months", "earnings_date": t.get("earnings_date")})
        for i, e in enumerate(etf_picks):
            allocations.append({"ticker": e["ticker"], "type": "ETF", "sector": e["sector"],
                "allocation_pct": [25, 15][i], "composite_score": e["composite_score"],
                "week_change_pct": e["week_change_pct"],
                "rationale": "Sector ETF — broad exposure, lower single-stock risk",
                "horizon": "Medium to long term", "earnings_date": None})
        return {"name": "Balanced", "emoji": "⚖️", "tagline": "Strong scores + confirmed 30d trends + ETFs",
            "risk_level": 2, "expected_horizon": "1 to 3 months", "stock_pct": 60, "etf_pct": 40,
            "description": "Picks stocks where 30-day trend confirms the score. Paired with sector ETFs.",
            "allocations": allocations,
            "warnings": ["Still exposed to sector-wide downturns", "Rebalance monthly as scores update"]}

    def build_conservative():
        picks = [s for s in safe_stocks if s.get("volatility_tag") in ["low", "medium"]
                 and s.get("trend_direction") != "downtrend"][:1]
        if not picks: picks = safe_stocks[:1]
        etf_picks = top_etfs[:3]
        allocations = []
        for i, e in enumerate(etf_picks):
            allocations.append({"ticker": e["ticker"], "type": "ETF", "sector": e["sector"],
                "allocation_pct": [40, 30, 20][i], "composite_score": e["composite_score"],
                "week_change_pct": e["week_change_pct"],
                "rationale": "Diversified ETF — broad market exposure, reduced risk",
                "horizon": "Long term (6+ months)", "earnings_date": None})
        if picks:
            t = picks[0]
            allocations.append({"ticker": t["ticker"], "type": "Stock", "sector": t["sector"],
                "allocation_pct": 10, "composite_score": t["composite_score"],
                "week_change_pct": t["week_change_pct"], "momentum_30d": t.get("momentum_30d"),
                "volatility_30d": t.get("volatility_30d"), "beta": t.get("beta"),
                "trend_direction": t.get("trend_direction"), "rationale": build_rationale(t, "conservative"),
                "horizon": "Long term", "earnings_date": t.get("earnings_date")})
        return {"name": "Conservative", "emoji": "🛡️", "tagline": "Low volatility + low beta + steady uptrend",
            "risk_level": 1, "expected_horizon": "6+ months", "stock_pct": 10, "etf_pct": 90,
            "description": "ETF-heavy with one low-volatility stock filtered for low beta and confirmed trend.",
            "allocations": allocations,
            "warnings": ["Lower upside — designed for stability", "Best held 6+ months", "Still subject to broad market drawdowns"]}

    return sanitize_floats({"generated_at": data["generated_at"],
        "strategies": [build_aggressive(), build_balanced(), build_conservative()]})

@app.get("/api/events")
def get_events(days: int = 14):
    """Build events from Supabase price_data (earnings) + hardcoded Fed dates."""
    from datetime import datetime, timedelta

    # Hardcoded Fed meeting calendar
    FED_DATES = [
        {"date": "2026-01-28", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-01-29", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-03-18", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-03-19", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-05-06", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-05-07", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-06-17", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-06-18", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-07-28", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-07-29", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-09-15", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-09-16", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-11-04", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-11-05", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-12-15", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-12-16", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
    ]

    today = datetime.utcnow().date()
    horizon = today + timedelta(days=days)
    events = []

    # Fed events
    for e in FED_DATES:
        try:
            d = datetime.strptime(e["date"], "%Y-%m-%d").date()
            if today <= d <= horizon:
                days_away = (d - today).days
                events.append({
                    **e,
                    "days_away": days_away,
                    "is_today": days_away == 0,
                    "is_tomorrow": days_away == 1,
                })
        except: pass

    # Earnings from Supabase price_data
    if sb:
        try:
            result = sb.table("price_data").select("ticker,earnings_date").not_.is_("earnings_date", "null").execute()
            seen = set()
            for row in (result.data or []):
                ticker = row.get("ticker")
                edate = row.get("earnings_date")
                if not edate or ticker in seen:
                    continue
                seen.add(ticker)
                try:
                    d = datetime.strptime(edate, "%Y-%m-%d").date()
                    if today <= d <= horizon:
                        days_away = (d - today).days
                        events.append({
                            "date": edate,
                            "event": f"{ticker} Earnings",
                            "type": "earnings",
                            "impact": "medium",
                            "days_away": days_away,
                            "is_today": days_away == 0,
                            "is_tomorrow": days_away == 1,
                            "ticker": ticker,
                        })
                except: pass
        except Exception as e:
            print(f"Earnings fetch failed: {e}")

    events.sort(key=lambda x: x["days_away"])
    return {"events": events}

@app.get("/api/congress")
def get_congress():
    """Return congressional trading signals from Supabase."""
    if not sb:
        return {"trades": [], "tickers": []}
    try:
        result = sb.table("congress_trades").select("*").execute()
        rows = result.data or []
        # Group by ticker for aggregate view
        tickers = {}
        for r in rows:
            t = r["ticker"]
            if t not in tickers:
                tickers[t] = {
                    "ticker": t,
                    "buys": r.get("buys", 0),
                    "sells": r.get("sells", 0),
                    "signal": r.get("signal"),
                    "congress_score": r.get("congress_score"),
                }
        return {
            "trades": rows,
            "tickers": list(tickers.values()),
            "total": len(rows),
        }
    except Exception as e:
        print(f"Congress fetch failed: {e}")
        return {"trades": [], "tickers": []}

@app.get("/api/watchlist")
def get_watchlist():
    try:
        with open("data/watchlist.json") as f:
            return json.load(f)
    except:
        return {"tickers": []}

@app.post("/api/watchlist/{ticker}")
def add_to_watchlist(ticker: str):
    ticker = ticker.upper().strip()
    try:
        import yfinance as yf
        info = yf.Ticker(ticker).info
        if not info.get("regularMarketPrice") and not info.get("currentPrice"):
            return {"success": False, "error": f"{ticker} not found on markets"}
        try:
            with open("data/watchlist.json") as f:
                data = json.load(f)
        except:
            data = {"tickers": []}
        if ticker not in data["tickers"]:
            data["tickers"].append(ticker)
            with open("data/watchlist.json", "w") as f:
                json.dump(data, f, indent=2)
        return {"success": True, "ticker": ticker,
                "message": f"{ticker} added — will appear in history after next pipeline run"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.delete("/api/watchlist/{ticker}")
def remove_from_watchlist(ticker: str):
    ticker = ticker.upper().strip()
    try:
        with open("data/watchlist.json") as f:
            data = json.load(f)
        data["tickers"] = [t for t in data["tickers"] if t != ticker]
        with open("data/watchlist.json", "w") as f:
            json.dump(data, f, indent=2)
        return {"success": True, "ticker": ticker}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/fear-greed")
def get_fear_greed():
    # Try Supabase first
    if sb:
        try:
            macro = get_macro_from_supabase()
            if macro.get("fear_greed"):
                return {"value": macro["fear_greed"], "description": macro.get("fear_greed_desc"),
                        "signal": macro.get("fear_greed_sig")}
        except: pass
    try:
        with open("data/processed/fear_greed.json") as f:
            return json.load(f)
    except:
        return {"value": None, "description": "unavailable", "signal": "neutral", "context": ""}

@app.get("/api/vix")
def get_vix():
    # Try Supabase first
    if sb:
        try:
            macro = get_macro_from_supabase()
            if macro.get("vix"):
                return {"value": macro["vix"], "signal": macro.get("vix_signal")}
        except: pass
    try:
        with open("data/processed/vix.json") as f:
            return json.load(f)
    except:
        return {"value": None, "signal": "neutral", "context": ""}