import fear_and_greed
import json
import os
from datetime import datetime

def get_fear_greed():
    """
    Fetch CNN Fear & Greed Index
    0-25 = Extreme Fear (historically strong buy signal)
    25-45 = Fear
    45-55 = Neutral
    55-75 = Greed
    75-100 = Extreme Greed (caution)
    """
    try:
        index = fear_and_greed.get()
        value = round(float(index.value), 1)
        description = index.description

        if value <= 25:
            context = "Extreme Fear — historically a strong buying opportunity. Market oversold."
            signal = "contrarian_buy"
            market_bias = "bullish"
        elif value <= 45:
            context = "Fear — market nervous. Good time to look for value in quality names."
            signal = "cautious_buy"
            market_bias = "mildly_bullish"
        elif value <= 55:
            context = "Neutral — no strong directional signal from sentiment."
            signal = "neutral"
            market_bias = "neutral"
        elif value <= 75:
            context = "Greed — market optimistic. Be selective, don't chase momentum."
            signal = "cautious"
            market_bias = "mildly_bearish"
        else:
            context = "Extreme Greed — market euphoric. High risk of correction."
            signal = "caution"
            market_bias = "bearish"

        data = {
            "value": value,
            "description": description,
            "signal": signal,
            "market_bias": market_bias,
            "context": context,
            "timestamp": datetime.utcnow().isoformat()
        }

        print(f"  Fear & Greed: {value} ({description}) — {signal}")
        return data

    except Exception as e:
        print(f"  Fear & Greed failed: {e}")
        return {
            "value": None,
            "description": "unavailable",
            "signal": "neutral",
            "market_bias": "neutral",
            "context": "Could not fetch Fear & Greed Index",
            "timestamp": datetime.utcnow().isoformat()
        }

def save_fear_greed(data):
    os.makedirs("data/processed", exist_ok=True)
    filename = "data/processed/fear_greed.json"
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Saved to {filename}")
    return filename

if __name__ == "__main__":
    data = get_fear_greed()
    save_fear_greed(data)
    print(f"\nFear & Greed: {data['value']} — {data['description']}")
    print(f"Context: {data['context']}")