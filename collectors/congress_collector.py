import json
import os
import re
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

def get_congress_trades(days_back=45, max_pages=10):
    """
    Scrape congressional stock trades from Capitol Trades
    Uses Playwright + stealth to bypass bot detection
    Parses DOM table rows directly
    """
    print("Fetching congressional trades from Capitol Trades...")
    all_trades = []
    cutoff = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 800},
            locale='en-US',
            timezone_id='America/New_York'
        )
        page = context.new_page()
        Stealth().apply_stealth_sync(page)

        for page_num in range(1, max_pages + 1):
            try:
                url = f"https://www.capitoltrades.com/trades?pageSize=96&page={page_num}"
                page.goto(url, timeout=60000)
                page.wait_for_timeout(5000)

                rows = page.query_selector_all('tr')
                page_trades = []
                stop_early = False

                for row in rows:
                    try:
                        text = row.inner_text()
                        if not text.strip() or "POLITICIAN" in text or "No results" in text:
                            continue

                        parts = [p.strip() for p in text.split('\t') if p.strip()]
                        if len(parts) < 6:
                            continue

                        # Parse politician name — first part before party info
                        politician_raw = parts[0]
                        name_lines = politician_raw.split('\n')
                        politician = name_lines[0].strip()

                        # Parse issuer/ticker — look for TICKER:US pattern
                        ticker = ""
                        issuer = ""
                        for part in parts[1:4]:
                            ticker_match = re.search(r'([A-Z]{1,6}(?:[/\.][A-Z]{1,2})?):US', part)
                            if ticker_match:
                                ticker = ticker_match.group(1)
                                issuer = part.split('\n')[0].strip()
                                break

                        if not ticker:
                            continue

                        # Parse published date — "25 Jun 2026" format
                        pub_date = ""
                        traded_date = ""
                        for part in parts:
                            date_match = re.search(r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})', part)
                            if date_match:
                                day, month, year = date_match.groups()
                                month_num = {"Jan":"01","Feb":"02","Mar":"03","Apr":"04","May":"05","Jun":"06",
                                           "Jul":"07","Aug":"08","Sep":"09","Oct":"10","Nov":"11","Dec":"12"}[month]
                                date_str = f"{year}-{month_num}-{day.zfill(2)}"
                                if not pub_date:
                                    pub_date = date_str
                                elif not traded_date:
                                    traded_date = date_str
                                    break

                        # Use traded date for filtering, fall back to published
                        trade_date = traded_date or pub_date

                        # Stop if we've gone past our cutoff
                        if trade_date and trade_date < cutoff:
                            stop_early = True
                            break

                        # Parse transaction type
                        tx_type = ""
                        for part in parts:
                            if part.upper() in ["BUY", "SELL", "PURCHASE", "SALE", "EXCHANGE"]:
                                tx_type = part.upper()
                                break

                        if not tx_type:
                            continue

                        page_trades.append({
                            "ticker": ticker,
                            "issuer": issuer,
                            "type": "buy" if tx_type in ["BUY", "PURCHASE", "EXCHANGE"] else "sell",
                            "representative": politician,
                            "date": trade_date,
                            "pub_date": pub_date
                        })

                    except Exception:
                        continue

                all_trades.extend(page_trades)
                print(f"  Page {page_num}: {len(page_trades)} trades (total: {len(all_trades)})")

                if stop_early:
                    print(f"  Reached cutoff date {cutoff}, stopping")
                    break

                if len(page_trades) < 10:
                    break

            except Exception as e:
                print(f"  Page {page_num} error: {e}")
                break

        browser.close()

    print(f"  Total trades collected: {len(all_trades)}")

    if not all_trades:
        return {}

    return aggregate_by_ticker(all_trades)

def aggregate_by_ticker(trades):
    """Aggregate trades by ticker and compute signals"""
    ticker_data = {}

    for trade in trades:
        ticker = trade.get("ticker", "").upper().strip()
        if not ticker or len(ticker) > 6:
            continue

        tx_type = trade.get("type", "").lower()
        representative = trade.get("representative", "Unknown").strip()
        date = trade.get("date", "")

        is_buy = "buy" in tx_type
        is_sell = "sell" in tx_type

        if not is_buy and not is_sell:
            continue

        if ticker not in ticker_data:
            ticker_data[ticker] = {
                "ticker": ticker,
                "buys": 0,
                "sells": 0,
                "total_trades": 0,
                "recent_buyers": [],
                "recent_sellers": [],
                "latest_date": date,
                "signal": "neutral",
                "congress_score": 50
            }

        ticker_data[ticker]["total_trades"] += 1

        if is_buy:
            ticker_data[ticker]["buys"] += 1
            if representative and representative not in ticker_data[ticker]["recent_buyers"]:
                ticker_data[ticker]["recent_buyers"].append(representative)
        elif is_sell:
            ticker_data[ticker]["sells"] += 1
            if representative and representative not in ticker_data[ticker]["recent_sellers"]:
                ticker_data[ticker]["recent_sellers"].append(representative)

        if date > ticker_data[ticker]["latest_date"]:
            ticker_data[ticker]["latest_date"] = date

    # Score each ticker
    for ticker, data in ticker_data.items():
        buys = data["buys"]
        sells = data["sells"]
        unique_buyers = len(data["recent_buyers"])
        unique_sellers = len(data["recent_sellers"])

        if unique_buyers >= 3 and buys > sells:
            data["signal"] = "strong_buy_cluster"
            data["congress_score"] = 90
        elif unique_buyers >= 2 and buys > sells:
            data["signal"] = "buy_cluster"
            data["congress_score"] = 75
        elif buys > sells * 2:
            data["signal"] = "bullish"
            data["congress_score"] = 65
        elif sells > buys * 2:
            data["signal"] = "bearish"
            data["congress_score"] = 35
        elif unique_sellers >= 3:
            data["signal"] = "sell_cluster"
            data["congress_score"] = 20
        else:
            data["signal"] = "neutral"
            data["congress_score"] = 50

        data["recent_buyers"] = data["recent_buyers"][:5]
        data["recent_sellers"] = data["recent_sellers"][:5]

        if data["signal"] != "neutral":
            print(f"  → {ticker}: {buys}B/{sells}S "
                  f"({unique_buyers} unique buyers) — {data['signal']}")

    return ticker_data

def save_congress_data(data):
    os.makedirs("data/processed", exist_ok=True)
    filename = "data/processed/congress_trades.json"
    with open(filename, "w") as f:
        json.dump({
            "generated_at": datetime.utcnow().isoformat(),
            "tickers": data
        }, f, indent=2)
    print(f"  Saved {len(data)} tickers to {filename}")
    return filename

if __name__ == "__main__":
    data = get_congress_trades(days_back=45, max_pages=10)
    if data:
        save_congress_data(data)
        signals = [(t, d) for t, d in data.items() if d["signal"] != "neutral"]
        signals.sort(key=lambda x: x[1]["congress_score"], reverse=True)
        print(f"\nTop congressional signals ({len(signals)} active tickers):")
        for ticker, d in signals[:10]:
            print(f"  {ticker:<6} {d['signal']:<20} "
                  f"{d['buys']}B/{d['sells']}S score:{d['congress_score']}")
    else:
        print("No data — congress collector will be skipped in pipeline")