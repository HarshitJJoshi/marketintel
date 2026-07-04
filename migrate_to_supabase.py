"""
migrate_to_supabase.py
Reads all existing JSON files and pushes data into Supabase.
Run once: python migrate_to_supabase.py
"""

import json
import os
import math
from datetime import datetime, date
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def clean(val):
    """Replace nan/inf with None for Supabase"""
    if isinstance(val, float):
        if math.isnan(val) or math.isinf(val):
            return None
    return val

def clean_dict(d):
    if isinstance(d, dict):
        return {k: clean_dict(v) for k, v in d.items()}
    if isinstance(d, list):
        return [clean_dict(v) for v in d]
    return clean(d)

def extract_date_from_filename(filename):
    """Extract date from scores_20260627_1935.json"""
    try:
        parts = filename.replace(".json", "").split("_")
        datestr = parts[1]
        return date(int(datestr[:4]), int(datestr[4:6]), int(datestr[6:8]))
    except:
        return date.today()

# ─── Migrate scores ───────────────────────────────────────────────
def migrate_scores():
    print("\n── Migrating scores ──")
    files = sorted([f for f in os.listdir("data/processed") if f.startswith("scores_") and f.endswith(".json")])
    print(f"Found {len(files)} score files")

    for filename in files:
        run_date = extract_date_from_filename(filename)
        print(f"  Processing {filename} → {run_date}")

        with open(f"data/processed/{filename}") as f:
            data = json.load(f)

        scores = data.get("scores", [])
        rows = []

        for s in scores:
            rows.append(clean_dict({
                "date": str(run_date),
                "ticker": s.get("ticker"),
                "sector": s.get("sector"),
                "composite_score": s.get("composite_score"),
                "week_change_pct": s.get("week_change_pct"),
                "momentum_30d": s.get("momentum_30d"),
                "volatility_30d": s.get("volatility_30d"),
                "trend_direction": s.get("trend_direction"),
                "trend_strength": s.get("trend_strength"),
                "beta": s.get("beta"),
                "volatility_tag": s.get("volatility_tag"),
                "avg_sentiment": s.get("avg_sentiment"),
                "mentions": s.get("mentions"),
                "total_reddit_score": s.get("total_reddit_score"),
                "stocktwits_score": s.get("stocktwits_score"),
                "bullish_signals": s.get("bullish_signals"),
                "price_score": s.get("price_score"),
                "sentiment_score": s.get("sentiment_score"),
                "buzz_score": s.get("buzz_score"),
                "st_score": s.get("st_score"),
                "fundamental_score": s.get("fundamental_score"),
                "analyst_score": s.get("analyst_score"),
                "short_score": s.get("short_score"),
                "congress_score": s.get("congress_score"),
                "insider_count": s.get("insider_count"),
                "major_institutions": s.get("major_institutions"),
                "trends_score": s.get("trends_score"),
                "options_score": s.get("options_score"),
                "rsi": s.get("rsi"),
                "analyst_target": s.get("analyst_target"),
                "analyst_upside": s.get("analyst_upside"),
                "analyst_rating": s.get("analyst_rating"),
                "analyst_action": s.get("analyst_action"),
                "recent_upgrades": s.get("recent_upgrades"),
                "recent_downgrades": s.get("recent_downgrades"),
                "short_float_pct": s.get("short_float_pct"),
                "short_ratio": s.get("short_ratio"),
                "short_signal": s.get("short_signal"),
                "congress_signal": s.get("congress_signal"),
                "congress_buys": s.get("congress_buys"),
                "congress_sells": s.get("congress_sells"),
                "congress_buyers": s.get("congress_buyers", []),
                "revenue_growth": s.get("revenue_growth"),
                "profit_margin": s.get("profit_margin"),
                "debt_equity": s.get("debt_equity"),
                "earnings_surprise": s.get("earnings_surprise"),
                "unusual_options": s.get("unusual_options", False),
                "search_trend": s.get("search_trend"),
                "is_etf": s.get("is_etf", False),
                "latest_close": s.get("latest_close"),
                "earnings_date": s.get("earnings_date"),
            }))

        if rows:
            result = supabase.table("scores").upsert(rows, on_conflict="date,ticker").execute()
            print(f"    ✓ {len(rows)} scores inserted")

# ─── Migrate price data ───────────────────────────────────────────
def migrate_price_data():
    print("\n── Migrating price data ──")
    files = sorted([f for f in os.listdir("data/raw") if f.startswith("prices_") and f.endswith(".json")])
    print(f"Found {len(files)} price files")

    for filename in files:
        run_date = extract_date_from_filename(filename)
        print(f"  Processing {filename} → {run_date}")

        with open(f"data/raw/{filename}") as f:
            prices = json.load(f)

        rows = []
        for p in prices:
            rows.append(clean_dict({
                "date": str(run_date),
                "ticker": p.get("ticker"),
                "latest_close": p.get("latest_close"),
                "week_open": p.get("week_open"),
                "week_change_pct": p.get("week_change_pct"),
                "week_high": p.get("week_high"),
                "week_low": p.get("week_low"),
                "avg_volume": p.get("avg_volume"),
                "latest_volume": p.get("latest_volume"),
                "volume_spike": p.get("volume_spike"),
                "price_history": p.get("price_history", []),
                "year_high": p.get("year_high"),
                "year_low": p.get("year_low"),
                "market_cap": p.get("market_cap"),
                "pe_ratio": p.get("pe_ratio"),
                "earnings_date": p.get("earnings_date"),
                "revenue_growth": p.get("revenue_growth"),
                "profit_margin": p.get("profit_margin"),
                "debt_equity": p.get("debt_equity"),
                "analyst_target": p.get("analyst_target"),
                "analyst_upside": p.get("analyst_upside"),
                "analyst_rating": p.get("analyst_rating"),
                "analyst_action": p.get("analyst_action"),
                "short_float_pct": p.get("short_float_pct"),
                "short_ratio": p.get("short_ratio"),
                "short_signal": p.get("short_signal"),
                "momentum_30d": p.get("momentum_30d"),
                "volatility_30d": p.get("volatility_30d"),
                "trend_direction": p.get("trend_direction"),
                "beta": p.get("beta"),
            }))

        if rows:
            supabase.table("price_data").upsert(rows, on_conflict="date,ticker").execute()
            print(f"    ✓ {len(rows)} price rows inserted")

# ─── Migrate congress trades ──────────────────────────────────────
def migrate_congress():
    print("\n── Migrating congress trades ──")
    path = "data/processed/congress_trades.json"
    if not os.path.exists(path):
        print("  No congress_trades.json found, skipping")
        return

    with open(path) as f:
        data = json.load(f)

    tickers = data.get("tickers", {})
    rows = []

    for ticker, info in tickers.items():
        rows.append({
            "ticker": ticker,
            "signal": info.get("signal"),
            "buys": info.get("buys", 0),
            "sells": info.get("sells", 0),
            "congress_score": info.get("congress_score"),
            "scraped_at": datetime.utcnow().isoformat(),
        })

    if rows:
        # Clear and reinsert congress data (it's always fresh)
        supabase.table("congress_trades").delete().neq("id", 0).execute()
        supabase.table("congress_trades").insert(rows).execute()
        print(f"  ✓ {len(rows)} congress ticker signals inserted")

# ─── Migrate macro data ───────────────────────────────────────────
def migrate_macro():
    print("\n── Migrating macro data ──")
    today = str(date.today())
    row = {"date": today}

    if os.path.exists("data/processed/fear_greed.json"):
        with open("data/processed/fear_greed.json") as f:
            fg = json.load(f)
        row["fear_greed"] = fg.get("value")
        row["fear_greed_desc"] = fg.get("description")
        row["fear_greed_sig"] = fg.get("signal")

    if os.path.exists("data/processed/vix.json"):
        with open("data/processed/vix.json") as f:
            vix = json.load(f)
        row["vix"] = vix.get("value")
        row["vix_signal"] = vix.get("signal")

    supabase.table("macro_data").upsert(row, on_conflict="date").execute()
    print(f"  ✓ Macro data for {today} inserted")

# ─── Migrate watchlist ────────────────────────────────────────────
def migrate_watchlist():
    print("\n── Migrating watchlist ──")
    print("  Watchlist is user-specific — skipping for now (handled after auth is added)")

# ─── Run all ──────────────────────────────────────────────────────
if __name__ == "__main__":
    print("MarketIntel → Supabase Migration")
    print("=" * 40)

    migrate_scores()
    migrate_price_data()
    migrate_congress()
    migrate_macro()
    migrate_watchlist()

    print("\n" + "=" * 40)
    print("✓ Migration complete")
    print("Check your Supabase dashboard → Table Editor to verify")
