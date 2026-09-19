"""
Congress Collector - Capitol Trades Scraper
Scrapes congressional stock trades from Capitol Trades using Playwright + stealth.
Outputs both raw individual trades AND aggregated per-ticker summaries.
"""

import json
import os
import re
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MONTH_MAP = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
    "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
    "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
}

PARTIES = {"Republican", "Democrat", "Independent"}
CHAMBERS = {"House", "Senate"}
BUY_TYPES = {"buy", "purchase", "exchange"}
SELL_TYPES = {"sell", "sale"}


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _parse_date(text):
    """Extract a YYYY-MM-DD date from '25 Jun 2026' style strings."""
    m = re.search(r"(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})", text)
    if not m:
        return ""
    day, month, year = m.groups()
    return f"{year}-{MONTH_MAP[month]}-{day.zfill(2)}"


def _parse_size(text):
    """
    Extract the dollar-range bucket from a cell.
    Capitol Trades shows ranges like '1K-15K', '15K-50K', '50K-100K', etc.
    The dash can be an ASCII hyphen or an en-dash.
    """
    # Normalize en-dashes / em-dashes to hyphens
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    m = re.search(r"(\d+K?)\s*-\s*(\d+K?)", text, re.IGNORECASE)
    if m:
        return f"${m.group(1)}-${m.group(2)}"
    # Single value like '>1M' or '>5M'
    m2 = re.search(r"(>?\$?\d+[KMB])", text, re.IGNORECASE)
    if m2:
        return m2.group(1)
    return ""


def _parse_politician_cell(cell_text):
    """
    The politician cell stacks: Name, Party, Chamber, State (newline-separated).
    Example inner_text: 'Lisa McClain\nRepublican\nHouse\nMI'
    """
    lines = [ln.strip() for ln in cell_text.strip().split("\n") if ln.strip()]
    name = lines[0] if lines else ""
    party = ""
    chamber = ""
    state = ""

    for ln in lines[1:]:
        if ln in PARTIES:
            party = ln
        elif ln in CHAMBERS:
            chamber = ln
        elif re.match(r"^[A-Z]{2}$", ln):
            state = ln

    return name, party, chamber, state


def _parse_issuer_cell(cell_text):
    """
    The issuer cell stacks: Company Name, TICKER:US (newline-separated).
    Example: 'Agree Realty Corp\nADC:US'
    Returns (issuer_name, ticker).
    """
    lines = [ln.strip() for ln in cell_text.strip().split("\n") if ln.strip()]
    ticker = ""
    issuer = ""

    for ln in lines:
        m = re.search(r"([A-Z]{1,6}(?:[/\.][A-Z]{1,2})?):US", ln)
        if m:
            ticker = m.group(1)
        else:
            # First non-ticker line is the company name
            if not issuer:
                issuer = ln

    return issuer, ticker


def _parse_tx_type(text):
    """Determine buy or sell from the type cell."""
    lower = text.strip().lower()
    if lower in BUY_TYPES:
        return "buy"
    if lower in SELL_TYPES:
        return "sell"
    return ""


# ---------------------------------------------------------------------------
# Scraper
# ---------------------------------------------------------------------------

def get_congress_trades(days_back=45, max_pages=10):
    """
    Scrape congressional stock trades from Capitol Trades.
    Returns a dict with both 'trades' (raw list) and 'tickers' (aggregated).
    """
    print("Fetching congressional trades from Capitol Trades...")
    all_trades = []
    cutoff = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
            locale="en-US",
            timezone_id="America/New_York",
        )
        page = context.new_page()
        Stealth().apply_stealth_sync(page)

        for page_num in range(1, max_pages + 1):
            try:
                url = f"https://www.capitoltrades.com/trades?pageSize=96&page={page_num}"
                page.goto(url, timeout=60000)
                page.wait_for_timeout(5000)

                rows = page.query_selector_all("tr")
                page_trades = []
                stop_early = False

                for row in rows:
                    try:
                        cells = row.query_selector_all("td")
                        if not cells or len(cells) < 8:
                            continue

                        cell_texts = [c.inner_text().strip() for c in cells]

                        # ----- Politician (cell 0) -----
                        politician, party, chamber, state = _parse_politician_cell(cell_texts[0])
                        if not politician:
                            continue

                        # ----- Issuer / Ticker (cell 1) -----
                        issuer, ticker = _parse_issuer_cell(cell_texts[1])
                        if not ticker:
                            continue

                        # ----- Published date (cell 2) -----
                        pub_date = _parse_date(cell_texts[2])

                        # ----- Traded date (cell 3) -----
                        traded_date = _parse_date(cell_texts[3])

                        trade_date = traded_date or pub_date

                        # Stop if past cutoff
                        if trade_date and trade_date < cutoff:
                            stop_early = True
                            break

                        # ----- Filed After (cell 4) - skip, derived -----

                        # ----- Owner (cell 5) -----
                        owner = cell_texts[5].strip() if len(cell_texts) > 5 else ""

                        # ----- Type (cell 6) -----
                        tx_type = _parse_tx_type(cell_texts[6]) if len(cell_texts) > 6 else ""
                        if not tx_type:
                            continue

                        # ----- Size / Amount (cell 7) -----
                        amount = _parse_size(cell_texts[7]) if len(cell_texts) > 7 else ""

                        # ----- Price (cell 8) -----
                        price = cell_texts[8].strip() if len(cell_texts) > 8 else ""

                        page_trades.append({
                            "ticker": ticker,
                            "issuer": issuer,
                            "type": tx_type,
                            "representative": politician,
                            "party": party,
                            "chamber": chamber,
                            "state": state,
                            "owner": owner,
                            "date": trade_date,
                            "pub_date": pub_date,
                            "amount": amount,
                            "price": price,
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
        return {"trades": [], "tickers": {}}

    # Sort trades newest first
    all_trades.sort(key=lambda t: t.get("date", ""), reverse=True)

    return {
        "trades": all_trades,
        "tickers": aggregate_by_ticker(all_trades),
    }


# ---------------------------------------------------------------------------
# Aggregation (unchanged logic, enriched output)
# ---------------------------------------------------------------------------

def aggregate_by_ticker(trades):
    """Aggregate trades by ticker and compute signals."""
    ticker_data = {}

    for trade in trades:
        ticker = trade.get("ticker", "").upper().strip()
        if not ticker or len(ticker) > 6:
            continue

        tx_type = trade.get("type", "").lower()
        representative = trade.get("representative", "Unknown").strip()
        party = trade.get("party", "")
        date = trade.get("date", "")

        is_buy = tx_type == "buy"
        is_sell = tx_type == "sell"
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
                "buyer_parties": [],
                "seller_parties": [],
                "latest_date": date,
                "signal": "neutral",
                "congress_score": 50,
            }

        td = ticker_data[ticker]
        td["total_trades"] += 1

        if is_buy:
            td["buys"] += 1
            if representative and representative not in td["recent_buyers"]:
                td["recent_buyers"].append(representative)
            if party and party not in td["buyer_parties"]:
                td["buyer_parties"].append(party)
        else:
            td["sells"] += 1
            if representative and representative not in td["recent_sellers"]:
                td["recent_sellers"].append(representative)
            if party and party not in td["seller_parties"]:
                td["seller_parties"].append(party)

        if date and date > td["latest_date"]:
            td["latest_date"] = date

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

        # Cap display lists
        data["recent_buyers"] = data["recent_buyers"][:5]
        data["recent_sellers"] = data["recent_sellers"][:5]

        if data["signal"] != "neutral":
            print(
                f"  -> {ticker}: {buys}B/{sells}S "
                f"({unique_buyers} unique buyers) -- {data['signal']}"
            )

    return ticker_data


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def save_congress_data(result):
    """
    Save both raw trades and aggregated ticker data.
    result = {"trades": [...], "tickers": {...}}
    """
    os.makedirs("data/processed", exist_ok=True)

    payload = {
        "generated_at": datetime.utcnow().isoformat(),
        "trade_count": len(result.get("trades", [])),
        "ticker_count": len(result.get("tickers", {})),
        "trades": result.get("trades", []),
        "tickers": result.get("tickers", {}),
    }

    filename = "data/processed/congress_trades.json"
    with open(filename, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"  Saved {payload['trade_count']} trades, {payload['ticker_count']} tickers to {filename}")
    return filename


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    result = get_congress_trades(days_back=45, max_pages=10)
    trades = result.get("trades", [])
    tickers = result.get("tickers", {})

    if trades:
        save_congress_data(result)

        signals = [(t, d) for t, d in tickers.items() if d["signal"] != "neutral"]
        signals.sort(key=lambda x: x[1]["congress_score"], reverse=True)

        print(f"\nTop congressional signals ({len(signals)} active tickers):")
        for ticker, d in signals[:10]:
            print(
                f"  {ticker:<6} {d['signal']:<20} "
                f"{d['buys']}B/{d['sells']}S score:{d['congress_score']}"
            )

        print(f"\nRecent trades sample:")
        for t in trades[:5]:
            print(
                f"  {t['representative']:<20} {t['party']:<12} "
                f"{t['type']:<5} {t['ticker']:<6} {t['amount']:<15} {t['date']}"
            )
    else:
        print("No data -- congress collector will be skipped in pipeline")
