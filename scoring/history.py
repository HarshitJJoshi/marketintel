import json
import os
import math
from datetime import datetime

HISTORY_DIR = "data/history"

def clean_value(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v

def save_daily_snapshot(scores, sentiment_data={}):
    os.makedirs(HISTORY_DIR, exist_ok=True)
    today = datetime.utcnow().strftime("%Y%m%d")
    filepath = f"{HISTORY_DIR}/snapshot_{today}.json"

    snapshot = {
        "date": today,
        "timestamp": datetime.utcnow().isoformat(),
        "tickers": {}
    }

    for s in scores:
        ticker = s["ticker"]
        sent = sentiment_data.get(ticker, {})
        record = {
            "composite_score": s["composite_score"],
            "price": s.get("latest_close"),
            "week_change_pct": s.get("week_change_pct"),
            "avg_sentiment": s.get("avg_sentiment", 0),
            "stocktwits_score": s.get("stocktwits_score", 0),
            "mentions": s.get("mentions", 0),
            "sector": s.get("sector"),
            "is_etf": s.get("is_etf", False),
            "price_score": s.get("price_score"),
            "sentiment_score": s.get("sentiment_score"),
            "buzz_score": s.get("buzz_score"),
            "st_score": s.get("st_score"),
            "fundamental_score": s.get("fundamental_score"),
            "options_score": s.get("options_score"),
            "rsi": s.get("rsi"),
            "search_trend": s.get("search_trend"),
            "unusual_options": s.get("unusual_options", False),
        }
        snapshot["tickers"][ticker] = {k: clean_value(v) for k, v in record.items()}

    with open(filepath, "w") as f:
        json.dump(snapshot, f, indent=2)

    print(f"History snapshot saved: {filepath}")
    return filepath

def load_ticker_history(ticker, days=30):
    if not os.path.exists(HISTORY_DIR):
        return []

    files = sorted([
        f for f in os.listdir(HISTORY_DIR)
        if f.startswith("snapshot_") and f.endswith(".json")
    ])[-days:]

    history = []
    for filename in files:
        with open(f"{HISTORY_DIR}/{filename}") as f:
            snapshot = json.load(f)
        if ticker in snapshot["tickers"]:
            entry = snapshot["tickers"][ticker]
            entry["date"] = snapshot["date"]
            history.append(entry)

    return history

def load_all_history(days=30):
    if not os.path.exists(HISTORY_DIR):
        return {}

    files = sorted([
        f for f in os.listdir(HISTORY_DIR)
        if f.startswith("snapshot_") and f.endswith(".json")
    ])[-days:]

    all_history = {}
    for filename in files:
        with open(f"{HISTORY_DIR}/{filename}") as f:
            snapshot = json.load(f)
        date = snapshot["date"]
        for ticker, data in snapshot["tickers"].items():
            if ticker not in all_history:
                all_history[ticker] = []
            all_history[ticker].append({**data, "date": date})

    return all_history

if __name__ == "__main__":
    # Backfill today from existing scores
    files = sorted([
        f for f in os.listdir("data/processed")
        if f.startswith("scores_") and f.endswith(".json")
    ])
    if files:
        with open(f"data/processed/{files[-1]}") as f:
            data = json.load(f)
        save_daily_snapshot(data["scores"])
        print(f"Backfilled {len(data['scores'])} tickers")