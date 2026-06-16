import yfinance as yf
import json
import os
from datetime import datetime

def get_options_signal(ticker):
    """
    Analyze options flow for unusual activity
    High call/put ratio = bullish institutional bet
    Unusual volume = smart money moving
    """
    try:
        stock = yf.Ticker(ticker)
        
        # Get nearest expiration options
        expirations = stock.options
        if not expirations:
            return {"signal": "neutral", "score": 50, "details": "no options data"}
        
        # Use nearest expiration
        nearest = expirations[0]
        chain = stock.option_chain(nearest)
        
        calls = chain.calls
        puts = chain.puts
        
        if calls.empty or puts.empty:
            return {"signal": "neutral", "score": 50, "details": "no chain data"}

        # Total volume
        call_volume = calls["volume"].fillna(0).sum()
        put_volume = puts["volume"].fillna(0).sum()
        total_volume = call_volume + put_volume

        if total_volume == 0:
            return {"signal": "neutral", "score": 50, "details": "no volume"}

        # Put/Call ratio — below 0.7 is bullish, above 1.3 is bearish
        pc_ratio = put_volume / call_volume if call_volume > 0 else 1.0

        # Unusual volume — compare to open interest
        call_oi = calls["openInterest"].fillna(0).sum()
        put_oi = puts["openInterest"].fillna(0).sum()
        total_oi = call_oi + put_oi

        volume_to_oi = total_volume / total_oi if total_oi > 0 else 0
        unusual = volume_to_oi > 0.1  # 10% of OI traded = unusual

        # Implied volatility
        avg_call_iv = calls["impliedVolatility"].fillna(0).mean()
        avg_put_iv = puts["impliedVolatility"].fillna(0).mean()
        iv_skew = avg_put_iv - avg_call_iv  # positive = fear, negative = greed

        # Score 0-100
        # Low PC ratio = bullish
        if pc_ratio < 0.5:
            score = 80
            signal = "strongly bullish"
        elif pc_ratio < 0.7:
            score = 70
            signal = "bullish"
        elif pc_ratio < 1.0:
            score = 55
            signal = "mildly bullish"
        elif pc_ratio < 1.3:
            score = 45
            signal = "mildly bearish"
        elif pc_ratio < 1.5:
            score = 35
            signal = "bearish"
        else:
            score = 20
            signal = "strongly bearish"

        # Boost if unusual volume
        if unusual:
            score = min(100, score + 10)

        return {
            "ticker": ticker,
            "signal": signal,
            "score": score,
            "pc_ratio": round(pc_ratio, 3),
            "call_volume": int(call_volume),
            "put_volume": int(put_volume),
            "unusual_activity": unusual,
            "volume_to_oi": round(volume_to_oi, 3),
            "iv_skew": round(iv_skew, 4),
            "expiration": nearest,
            "details": f"P/C ratio {round(pc_ratio,2)} — {signal}"
        }

    except Exception as e:
        return {"ticker": ticker, "signal": "neutral", "score": 50, "details": str(e)}

def collect_options_flow(tickers):
    print(f"Fetching options flow for {len(tickers)} tickers...")
    results = {}

    for ticker in tickers:
        data = get_options_signal(ticker)
        results[ticker] = data
        signal = data.get("signal", "neutral")
        pc = data.get("pc_ratio", "—")
        unusual = "⚡ UNUSUAL" if data.get("unusual_activity") else ""
        print(f"  → {ticker}: {signal} (P/C: {pc}) {unusual}")

    return results

def save_options(data):
    os.makedirs("data/raw", exist_ok=True)
    filename = f"data/raw/options_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(filename, "w") as f:
        json.dump(data, f, indent=2, default=lambda x: bool(x) if hasattr(x, 'item') else str(x))
    print(f"Saved to {filename}")
    return filename

if __name__ == "__main__":
    price_files = sorted([
        f for f in os.listdir("data/raw")
        if f.startswith("prices_") and f.endswith(".json")
    ])
    if price_files:
        with open(f"data/raw/{price_files[-1]}") as f:
            prices = json.load(f)
        # Only stocks with options, no ETFs
        tickers = [p["ticker"] for p in prices
                  if p["ticker"] not in ["SPY","QQQ","SOXX","SMH","XLK","XLV","XLF","ICLN"]][:20]
    else:
        tickers = []

    if tickers:
        data = collect_options_flow(tickers)
        save_options(data)

        print(f"\nOptions flow summary:")
        sorted_data = sorted(data.items(), 
                           key=lambda x: x[1].get("score", 50), 
                           reverse=True)
        for ticker, d in sorted_data[:10]:
            unusual = "⚡" if d.get("unusual_activity") else " "
            print(f"  {unusual}{ticker:<6} score:{d.get('score',50):>4}  "
                  f"P/C:{d.get('pc_ratio','—')}  {d.get('signal','—')}")