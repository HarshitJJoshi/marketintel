import requests
import json
import os
from datetime import datetime, timedelta

HEADERS = {"User-Agent": "marketintel harshit@personal.com"}

def get_cik_for_ticker(ticker):
    url = "https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&dateRange=custom&startdt=2020-01-01&enddt=2026-01-01&forms=4"
    try:
        r = requests.get(
            f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company={ticker}&type=4&dateb=&owner=include&count=1&search_text=&output=atom",
            headers=HEADERS, timeout=10
        )
        return None
    except:
        return None

def get_insider_transactions(ticker, days_back=90):
    """
    Fetch recent Form 4 insider transactions for a ticker
    Returns list of buy/sell transactions
    """
    try:
        # Step 1 — get CIK from ticker mapping
        mapping_url = "https://www.sec.gov/files/company_tickers.json"
        r = requests.get(mapping_url, headers=HEADERS, timeout=10)
        tickers_map = r.json()

        cik = None
        for entry in tickers_map.values():
            if entry.get("ticker", "").upper() == ticker.upper():
                cik = str(entry["cik_str"]).zfill(10)
                break

        if not cik:
            return []

        # Step 2 — get recent Form 4 filings
        filings_url = f"https://data.sec.gov/submissions/CIK{cik}.json"
        r = requests.get(filings_url, headers=HEADERS, timeout=10)
        data = r.json()

        filings = data.get("filings", {}).get("recent", {})
        forms = filings.get("form", [])
        dates = filings.get("filingDate", [])
        accessions = filings.get("accessionNumber", [])

        cutoff = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")
        transactions = []

        for i, form in enumerate(forms):
            if form != "4":
                continue
            if dates[i] < cutoff:
                continue

            transactions.append({
                "form": form,
                "date": dates[i],
                "accession": accessions[i],
                "ticker": ticker
            })

        return transactions[:10]  # last 10 Form 4s

    except Exception as e:
        return []

def get_insider_signal(ticker):
    """
    Returns insider signal: bullish/bearish/neutral + details
    """
    transactions = get_insider_transactions(ticker)
    if not transactions:
        return {"signal": "neutral", "count": 0, "details": "No recent insider filings"}

    # We have Form 4 filings — that's the signal
    # More filings = more insider activity
    count = len(transactions)
    latest_date = transactions[0]["date"] if transactions else None

    return {
        "signal": "active",
        "count": count,
        "latest_date": latest_date,
        "details": f"{count} Form 4 filing(s) in last 90 days",
        "ticker": ticker
    }

def collect_insider_signals(tickers):
    print(f"Fetching insider transactions for {len(tickers)} tickers...")
    results = {}

    for ticker in tickers:
        signal = get_insider_signal(ticker)
        results[ticker] = signal
        if signal["count"] > 0:
            print(f"  → {ticker}: {signal['details']}")
        else:
            print(f"  → {ticker}: no recent filings")

    return results

def save_insider_data(data):
    os.makedirs("data/raw", exist_ok=True)
    filename = f"data/raw/insider_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
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
        tickers = [p["ticker"] for p in prices if not p.get("is_etf")][:20]
    else:
        tickers = []

    if tickers:
        data = collect_insider_signals(tickers)
        save_insider_data(data)
    else:
        print("No price data found. Run yfinance collector first.")