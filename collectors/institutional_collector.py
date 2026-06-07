import requests
import json
import os
from datetime import datetime

HEADERS = {"User-Agent": "marketintel harshit@personal.com"}

def get_institutional_ownership(ticker):
    """
    Get institutional ownership data from SEC EDGAR 13F filings
    Uses yfinance as primary source since it aggregates this cleanly
    """
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        inst = stock.institutional_holders

        if inst is None or inst.empty:
            return {"ticker": ticker, "signal": "neutral", "details": "No data"}

        # Top holders and their % held
        holders = []
        for _, row in inst.head(10).iterrows():
            holders.append({
                "holder": str(row.get("Holder", "")),
                "shares": int(row.get("Shares", 0)),
                "pct_held": round(float(row.get("% Out", 0)), 4)
            })

        total_inst_pct = sum(h["pct_held"] for h in holders)

        # Check major institutions
        major = ["Blackrock", "Vanguard", "Fidelity", "State Street",
                 "JPMorgan", "Goldman", "Morgan Stanley"]
        major_holders = [h for h in holders
                        if any(m.lower() in h["holder"].lower() for m in major)]

        signal = "bullish" if len(major_holders) >= 2 else "neutral"

        return {
            "ticker": ticker,
            "signal": signal,
            "total_inst_pct": round(total_inst_pct, 2),
            "major_holders": major_holders,
            "top_holders": holders[:5],
            "major_count": len(major_holders),
            "details": f"{len(major_holders)} major institutions holding"
        }

    except Exception as e:
        return {"ticker": ticker, "signal": "neutral", "details": str(e)}

def collect_institutional_data(tickers):
    print(f"Fetching institutional ownership for {len(tickers)} tickers...")
    results = {}

    for ticker in tickers:
        data = get_institutional_ownership(ticker)
        results[ticker] = data
        major = data.get("major_count", 0)
        total = data.get("total_inst_pct", 0)
        print(f"  → {ticker}: {major} major institutions, {total}% held")

    return results

def save_institutional_data(data):
    os.makedirs("data/raw", exist_ok=True)
    filename = f"data/raw/institutional_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
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
        tickers = [p["ticker"] for p in prices][:25]
    else:
        tickers = []

    if tickers:
        data = collect_institutional_data(tickers)
        save_institutional_data(data)
    else:
        print("No price data found.")