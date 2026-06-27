import yfinance as yf
import json
import os
from datetime import datetime

def get_vix():
    """
    Fetch VIX (CBOE Volatility Index) from yfinance
    VIX measures expected market volatility over next 30 days
    
    VIX < 15 = Low volatility, complacent market (caution — too calm)
    VIX 15-20 = Normal range
    VIX 20-30 = Elevated anxiety
    VIX 30-40 = High fear, potential buying opportunity
    VIX > 40 = Extreme panic (historically strong buy signal)
    """
    try:
        vix = yf.Ticker("^VIX")
        hist = vix.history(period="5d")

        if hist.empty:
            return {"value": None, "signal": "neutral", "context": "VIX data unavailable"}

        current = round(float(hist["Close"].iloc[-1]), 2)
        prev = round(float(hist["Close"].iloc[-2]), 2) if len(hist) >= 2 else current
        change = round(current - prev, 2)
        change_pct = round(((current - prev) / prev) * 100, 2) if prev > 0 else 0

        # 30-day history for trend
        hist_30 = vix.history(period="1mo")
        avg_30 = round(float(hist_30["Close"].mean()), 2) if not hist_30.empty else current
        vix_30d_high = round(float(hist_30["Close"].max()), 2) if not hist_30.empty else current
        vix_30d_low = round(float(hist_30["Close"].min()), 2) if not hist_30.empty else current

        # Signal interpretation
        if current < 15:
            signal = "complacent"
            market_bias = "cautious"
            context = f"VIX {current} — extremely low volatility. Market complacent. Risk of sudden spike."
        elif current < 20:
            signal = "calm"
            market_bias = "neutral"
            context = f"VIX {current} — normal range. No unusual fear or complacency."
        elif current < 30:
            signal = "elevated"
            market_bias = "mildly_bullish"
            context = f"VIX {current} — elevated anxiety. Markets nervous but not panicking."
        elif current < 40:
            signal = "fearful"
            market_bias = "bullish"
            context = f"VIX {current} — high fear. Historically good entry point for patient investors."
        else:
            signal = "panic"
            market_bias = "strongly_bullish"
            context = f"VIX {current} — extreme panic. Historically one of the strongest buy signals."

        # Rising vs falling VIX
        trend = "rising" if change > 0 else "falling" if change < 0 else "flat"
        if trend == "rising" and current > 20:
            context += " VIX rising — fear increasing, be cautious short term."
        elif trend == "falling" and current > 20:
            context += " VIX falling — fear easing, potential relief rally ahead."

        data = {
            "value": current,
            "previous": prev,
            "change": change,
            "change_pct": change_pct,
            "trend": trend,
            "avg_30d": avg_30,
            "high_30d": vix_30d_high,
            "low_30d": vix_30d_low,
            "signal": signal,
            "market_bias": market_bias,
            "context": context,
            "timestamp": datetime.utcnow().isoformat()
        }

        direction = "↑" if change > 0 else "↓" if change < 0 else "→"
        print(f"  VIX: {current} {direction}{abs(change)} ({signal}) — {market_bias}")
        return data

    except Exception as e:
        print(f"  VIX failed: {e}")
        return {
            "value": None,
            "signal": "neutral",
            "market_bias": "neutral",
            "context": "Could not fetch VIX",
            "timestamp": datetime.utcnow().isoformat()
        }

def save_vix(data):
    os.makedirs("data/processed", exist_ok=True)
    filename = "data/processed/vix.json"
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Saved to {filename}")
    return filename

if __name__ == "__main__":
    data = get_vix()
    save_vix(data)
    print(f"\nVIX: {data['value']} — {data['signal']}")
    print(f"Context: {data['context']}")