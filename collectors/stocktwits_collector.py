import requests
import json
import os
from datetime import datetime
from time import sleep

def get_stocktwits_messages(ticker, limit=30):
    url = f"https://api.stocktwits.com/api/2/streams/symbol/{ticker}.json"
    params = {"limit": limit}

    try:
        response = requests.get(url, params=params, timeout=10,
                                headers={"User-Agent": "Mozilla/5.0"})
        if response.status_code == 200:
            data = response.json()
            return data.get("messages", [])
        elif response.status_code == 429:
            print(f"  Rate limited on {ticker}, waiting 10s...")
            sleep(10)
            return []
        else:
            return []
    except Exception as e:
        print(f"  {ticker} failed: {e}")
        return []

def extract_sentiment(msg):
    entities = msg.get("entities") or {}
    sentiment_data = entities.get("sentiment") or {}
    return sentiment_data.get("basic")

def get_trending_tickers():
    print("Fetching StockTwits trending tickers...")
    try:
        response = requests.get(
            "https://api.stocktwits.com/api/2/trending/symbols.json",
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        if response.status_code == 200:
            data = response.json()
            symbols = data.get("symbols", [])
            tickers = [s["symbol"] for s in symbols]
            print(f"  Trending: {', '.join(tickers)}")
            return tickers
    except Exception as e:
        print(f"  Trending fetch failed: {e}")
    return []

def collect_stocktwits(tickers):
    print(f"Collecting StockTwits for {len(tickers)} tickers...")
    all_messages = []

    for ticker in tickers:
        messages = get_stocktwits_messages(ticker)

        for msg in messages:
            sentiment = extract_sentiment(msg)
            all_messages.append({
                "source": "stocktwits",
                "ticker": ticker,
                "text": msg.get("body", ""),
                "title": msg.get("body", "")[:100],
                "summary": msg.get("body", ""),
                "stocktwits_sentiment": sentiment,
                "likes": msg.get("likes", {}).get("total", 0) if msg.get("likes") else 0,
                "created_at": msg.get("created_at", ""),
                "collected_at": datetime.utcnow().isoformat(),
                "tickers": [ticker]
            })

        if messages:
            bullish = sum(1 for m in messages if extract_sentiment(m) == "Bullish")
            bearish = sum(1 for m in messages if extract_sentiment(m) == "Bearish")
            neutral = len(messages) - bullish - bearish
            print(f"  → {ticker}: {len(messages)} msgs — {bullish} bullish / {bearish} bearish / {neutral} neutral")
        else:
            print(f"  → {ticker}: no messages")

        sleep(0.5)

    print(f"\nTotal StockTwits messages: {len(all_messages)}")
    return all_messages

def save_stocktwits(messages):
    os.makedirs("data/raw", exist_ok=True)
    filename = f"data/raw/stocktwits_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(filename, "w") as f:
        json.dump(messages, f, indent=2)
    print(f"Saved to {filename}")
    return filename

if __name__ == "__main__":
    # Get trending from StockTwits
    trending = get_trending_tickers()

    # Get dynamic watchlist from latest price data
    dynamic_tickers = []
    try:
        price_files = sorted([
            f for f in os.listdir("data/raw")
            if f.startswith("prices_") and f.endswith(".json")
        ])
        if price_files:
            with open(f"data/raw/{price_files[-1]}") as f:
                prices = json.load(f)
                dynamic_tickers = [p["ticker"] for p in prices]
            print(f"Loaded {len(dynamic_tickers)} tickers from latest price data")
    except Exception as e:
        print(f"Could not load price data: {e}")

    all_tickers = list(set(dynamic_tickers + trending))
    print(f"Tracking {len(all_tickers)} tickers total\n")

    messages = collect_stocktwits(all_tickers)
    if messages:
        save_stocktwits(messages)