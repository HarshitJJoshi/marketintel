import json
import os
from datetime import datetime
from time import sleep
from pytrends.request import TrendReq

def get_trends_signal(tickers, timeframe="now 7-d"):
    """
    Get Google Trends search interest for tickers
    Rising search interest often precedes price moves by 1-2 days
    """
    print(f"Fetching Google Trends for {len(tickers)} tickers...")
    pytrends = TrendReq(hl="en-US", tz=360)
    
    results = {}
    
    # Google Trends max 5 keywords per request
    chunks = [tickers[i:i+5] for i in range(0, len(tickers), 5)]
    
    for chunk in chunks:
        try:
            pytrends.build_payload(chunk, timeframe=timeframe, geo="US")
            interest = pytrends.interest_over_time()
            
            if interest.empty:
                for ticker in chunk:
                    results[ticker] = {"score": 0, "trend": "flat", "signal": "no data"}
                continue

            for ticker in chunk:
                if ticker not in interest.columns:
                    results[ticker] = {"score": 0, "trend": "flat", "signal": "no data"}
                    continue

                values = interest[ticker].tolist()
                if not values:
                    results[ticker] = {"score": 0, "trend": "flat", "signal": "no data"}
                    continue

                latest = values[-1]
                avg = sum(values) / len(values) if values else 0
                peak = max(values) if values else 0

                # Trend direction
                if len(values) >= 3:
                    recent_avg = sum(values[-3:]) / 3
                    early_avg = sum(values[:3]) / 3
                    if recent_avg > early_avg * 1.3:
                        trend = "rising"
                    elif recent_avg < early_avg * 0.7:
                        trend = "falling"
                    else:
                        trend = "stable"
                else:
                    trend = "stable"

                # Signal strength 0-100
                if avg > 0:
                    relative_interest = (latest / avg) * 50
                else:
                    relative_interest = 0

                signal_score = min(100, relative_interest)

                signal = "strong" if signal_score > 70 else "moderate" if signal_score > 40 else "weak"

                results[ticker] = {
                    "score": round(signal_score, 1),
                    "latest_interest": latest,
                    "avg_interest": round(avg, 1),
                    "peak_interest": peak,
                    "trend": trend,
                    "signal": signal
                }

                print(f"  → {ticker}: interest {latest} (avg {round(avg,1)}) trend: {trend}")

            sleep(1)  # be polite to Google

        except Exception as e:
            print(f"  Chunk {chunk} failed: {e}")
            for ticker in chunk:
                results[ticker] = {"score": 0, "trend": "flat", "signal": "error"}
            sleep(2)

    return results

def save_trends(data):
    os.makedirs("data/raw", exist_ok=True)
    filename = f"data/raw/trends_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    print(f"Saved to {filename}")
    return filename

if __name__ == "__main__":
    # Load dynamic watchlist from latest prices
    price_files = sorted([
        f for f in os.listdir("data/raw")
        if f.startswith("prices_") and f.endswith(".json")
    ])
    if price_files:
        with open(f"data/raw/{price_files[-1]}") as f:
            prices = json.load(f)
        # Only stocks, no ETFs, top 20
        tickers = [p["ticker"] for p in prices 
                  if p["ticker"] not in ["SPY","QQQ","SOXX","SMH","XLK","XLV","XLF","ICLN"]][:20]
    else:
        tickers = ["AAPL","MSFT","NVDA","AMD","META"]

    data = get_trends_signal(tickers)
    if data:
        save_trends(data)
        print(f"\nTrends summary:")
        for ticker, d in sorted(data.items(), key=lambda x: x[1].get("score",0), reverse=True)[:10]:
            print(f"  {ticker:<6} score:{d['score']:>5.1f}  trend:{d['trend']}")