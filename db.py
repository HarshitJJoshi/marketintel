"""
db.py — Supabase persistence layer for MarketIntel
Called at the end of each pipeline run to save all data to Postgres.
JSON files remain as local backup/fallback.
"""

import os
import math
import json
from datetime import datetime, date
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

_sb = None

def get_client():
    global _sb
    if _sb is not None:
        return _sb
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("  ⚠ Supabase env vars not set — skipping DB save")
        return None
    try:
        from supabase import create_client
        _sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        return _sb
    except Exception as e:
        print(f"  ⚠ Supabase connection failed: {e}")
        return None

def clean(val):
    """Replace nan/inf/None-like floats with None"""
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

def save_scores(scores: list, run_date: str = None) -> bool:
    """
    Save composite scores to Supabase scores table.
    Called after scoring engine runs.
    """
    sb = get_client()
    if not sb:
        return False

    if not run_date:
        run_date = str(date.today())

    rows = []
    for s in scores:
        rows.append(clean_dict({
            "date": run_date,
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

    try:
        sb.table("scores").upsert(rows, on_conflict="date,ticker").execute()
        print(f"  ✓ Supabase: {len(rows)} scores saved for {run_date}")
        return True
    except Exception as e:
        print(f"  ✗ Supabase scores save failed: {e}")
        return False

def save_price_data(prices: list, run_date: str = None) -> bool:
    """
    Save price + fundamentals to Supabase price_data table.
    Called after yfinance collector runs.
    """
    sb = get_client()
    if not sb:
        return False

    if not run_date:
        run_date = str(date.today())

    rows = []
    for p in prices:
        rows.append(clean_dict({
            "date": run_date,
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

    try:
        sb.table("price_data").upsert(rows, on_conflict="date,ticker").execute()
        print(f"  ✓ Supabase: {len(rows)} price rows saved for {run_date}")
        return True
    except Exception as e:
        print(f"  ✗ Supabase price save failed: {e}")
        return False

def save_congress(congress_data: dict) -> bool:
    """
    Save congressional trading signals to Supabase.
    Clears and reinserts — always fresh data.
    """
    sb = get_client()
    if not sb or not congress_data:
        return False

    rows = []
    for ticker, info in congress_data.items():
        rows.append({
            "ticker": ticker,
            "signal": info.get("signal"),
            "buys": info.get("buys", 0),
            "sells": info.get("sells", 0),
            "congress_score": info.get("congress_score"),
            "scraped_at": datetime.utcnow().isoformat(),
        })

    try:
        sb.table("congress_trades").delete().neq("id", 0).execute()
        sb.table("congress_trades").insert(rows).execute()
        print(f"  ✓ Supabase: {len(rows)} congress signals saved")
        return True
    except Exception as e:
        print(f"  ✗ Supabase congress save failed: {e}")
        return False

def save_macro(fear_greed: dict, vix: dict) -> bool:
    """
    Save daily Fear & Greed + VIX snapshot to Supabase.
    """
    sb = get_client()
    if not sb:
        return False

    today = str(date.today())
    row = {
        "date": today,
        "fear_greed": fear_greed.get("value") if fear_greed else None,
        "fear_greed_desc": fear_greed.get("description") if fear_greed else None,
        "fear_greed_sig": fear_greed.get("signal") if fear_greed else None,
        "vix": vix.get("value") if vix else None,
        "vix_signal": vix.get("signal") if vix else None,
    }

    try:
        sb.table("macro_data").upsert(row, on_conflict="date").execute()
        print(f"  ✓ Supabase: macro data saved for {today}")
        return True
    except Exception as e:
        print(f"  ✗ Supabase macro save failed: {e}")
        return False

def save_all(scores: list, prices: list, congress_data: dict,
             fear_greed: dict = None, vix: dict = None) -> None:
    """
    Save everything to Supabase in one call.
    Called at the end of run_pipeline().
    """
    run_date = str(date.today())
    print("\n  Saving to Supabase...")
    save_scores(scores, run_date)
    save_price_data(prices, run_date)
    if congress_data:
        save_congress(congress_data)
    if fear_greed or vix:
        save_macro(fear_greed or {}, vix or {})
