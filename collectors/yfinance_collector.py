import yfinance as yf
import json
import math
import os
import time
import random
from datetime import datetime

# Small seed list — just the ones we always want regardless of news
SEED_WATCHLIST = [
    "SPY", "QQQ",
    "NVDA", "MSFT", "AAPL",
    "SOXX", "XLK", "XLF", "XLV", "ICLN"
]

def load_user_watchlist():
    """Load user-added tickers from persistent watchlist"""
    try:
        watchlist_path = "data/watchlist.json"
        if os.path.exists(watchlist_path):
            with open(watchlist_path) as f:
                data = json.load(f)
                tickers = data.get("tickers", [])
                if tickers:
                    print(f"  Loaded {len(tickers)} user watchlist tickers: {', '.join(tickers)}")
                return tickers
    except Exception as e:
        print(f"  Watchlist load failed: {e}")
    return []

def build_dynamic_watchlist(nlp_tickers=[]):
    watchlist = set(SEED_WATCHLIST)
    user_tickers = load_user_watchlist()
    watchlist.update(user_tickers)
    for t in nlp_tickers:
        if len(t) <= 5 and t.isalpha():
            watchlist.add(t.upper())
    try:
        sp500_movers = get_sp500_movers(top_n=20)
        watchlist.update(sp500_movers)
        print(f"  Added {len(sp500_movers)} S&P 500 movers to watchlist")
    except Exception as e:
        print(f"  S&P movers fetch failed: {e}")
    print(f"  Dynamic watchlist: {len(watchlist)} tickers")
    return list(watchlist)

def get_sp500_movers(top_n=20):
    """Get top gaining and losing S&P 500 stocks this week"""
    sp500_sample = [
        "AAPL","MSFT","NVDA","AMD","GOOGL","AMZN","META","TSLA","ORCL","CRM",
        "ADBE","INTC","QCOM","TXN","AMAT","LRCX","KLAC","MRVL","AVGO","MU",
        "JPM","BAC","WFC","GS","MS","C","BLK","SCHW","AXP","V","MA","COF",
        "LLY","JNJ","UNH","ABBV","MRK","PFE","TMO","ABT","DHR","ISRG","MRNA",
        "XOM","CVX","COP","SLB","EOG","MPC","PSX","VLO",
        "AMZN","HD","MCD","NKE","SBUX","TGT","WMT","COST","LOW","TJX",
        "CAT","DE","GE","HON","MMM","UPS","FDX","BA","LMT","RTX",
        "ENPH","NEE","FSLR","PLUG","BE","SEDG",
        "CRWD","PANW","ZS","PLTR","NET","S","FTNT",
        "SOXX","SMH","XLK","XLV","XLF","ICLN","XLE","XLY","XLI","XLB"
    ]
    results = []
    for ticker in sp500_sample:
        try:
            hist = yf.Ticker(ticker).history(period="5d", timeout=10)
            if len(hist) >= 2:
                chg = ((hist["Close"].iloc[-1] - hist["Close"].iloc[0]) / hist["Close"].iloc[0]) * 100
                results.append((ticker, chg))
            time.sleep(0.3)
        except:
            pass
    results.sort(key=lambda x: abs(x[1]), reverse=True)
    return [t for t, _ in results[:top_n]]

def get_earnings_alert(ticker_obj):
    try:
        cal = ticker_obj.calendar
        if cal is None:
            return None
        if hasattr(cal, 'columns'):
            if 'Earnings Date' in cal.columns:
                return str(cal['Earnings Date'].iloc[0])[:10]
        if isinstance(cal, dict) and 'Earnings Date' in cal:
            dates = cal['Earnings Date']
            if dates:
                return str(dates[0])[:10]
    except Exception:
        pass
    return None

def fetch_ticker_data(ticker, max_retries=2):
    """
    Fetch ticker data with retries and backoff.
    Returns (stock, hist, info) or (None, None, None) on failure.
    """
    for attempt in range(max_retries):
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1mo", timeout=15)
            if hist.empty:
                if attempt < max_retries - 1:
                    time.sleep(3)
                    continue
                return None, None, None
            info = stock.info
            return stock, hist, info
        except Exception as e:
            if attempt < max_retries - 1:
                wait = (attempt + 1) * 4
                print(f"  {ticker}: attempt {attempt+1} failed, retrying in {wait}s — {str(e)[:60]}")
                time.sleep(wait)
            else:
                print(f"  → {ticker}: failed after {max_retries} attempts — {str(e)[:80]}")
                return None, None, None
    return None, None, None

def get_price_data(tickers):
    print(f"Fetching price data for {len(tickers)} tickers...")
    results = []

    for i, ticker in enumerate(tickers):
        # Polite delay between requests — prevents Yahoo Finance rate limiting
        if i > 0:
            time.sleep(random.uniform(0.8, 1.5))

        # Extra cooldown every 20 tickers
        if i > 0 and i % 20 == 0:
            cooldown = random.uniform(3, 6)
            print(f"  [Cooldown {cooldown:.1f}s after {i} tickers...]")
            time.sleep(cooldown)

        try:
            stock, hist, info = fetch_ticker_data(ticker)

            if stock is None or hist is None:
                print(f"  → {ticker}: skipped (no data)")
                continue

            # --- Fundamentals ---
            def safe(key, default=None):
                val = info.get(key)
                return val if val not in [None, "N/A", float("inf")] else default

            revenue_growth = safe("revenueGrowth")
            if revenue_growth:
                revenue_growth = round(revenue_growth * 100, 2)

            profit_margin = safe("profitMargins")
            if profit_margin:
                profit_margin = round(profit_margin * 100, 2)

            debt_equity = safe("debtToEquity")
            if debt_equity:
                debt_equity = round(debt_equity / 100, 2)

            # Earnings surprise
            earnings_surprise = None
            try:
                earnings_hist = stock.earnings_history
                if earnings_hist is not None and not earnings_hist.empty:
                    cols = earnings_hist.columns.tolist()
                    surprise_col = None
                    for col in ["surprisePercent", "Surprise(%)", "epsActual"]:
                        if col in cols:
                            surprise_col = col
                            break
                    if surprise_col:
                        surprises = earnings_hist[surprise_col].dropna().tolist()
                        beats = sum(1 for s in surprises[-4:] if s > 0)
                        earnings_surprise = f"{beats}/4 beats"
            except:
                pass

            if not earnings_surprise:
                try:
                    info_eps = info.get("epsTrailingTwelveMonths")
                    info_fwd = info.get("epsForward")
                    if info_eps and info_fwd and info_fwd > info_eps:
                        earnings_surprise = "EPS growing"
                    elif info_eps and info_fwd:
                        earnings_surprise = "EPS flat/declining"
                except:
                    pass

            pe_ratio = safe("trailingPE")
            if pe_ratio:
                pe_ratio = round(float(pe_ratio), 2)

            # Fundamental score 0-100
            fund_score = 50
            if revenue_growth is not None:
                if revenue_growth > 15:
                    fund_score += 20
                elif revenue_growth > 5:
                    fund_score += 10
                elif revenue_growth < 0:
                    fund_score -= 20
            if profit_margin is not None:
                if profit_margin > 20:
                    fund_score += 15
                elif profit_margin > 10:
                    fund_score += 8
                elif profit_margin < 0:
                    fund_score -= 15
            if debt_equity is not None:
                if debt_equity < 1:
                    fund_score += 10
                elif debt_equity > 2:
                    fund_score -= 10
            fund_score = max(0, min(100, fund_score))

            # Price calculations
            week_hist = hist.tail(5)
            week_open = float(week_hist["Close"].iloc[0])
            latest_close = float(week_hist["Close"].iloc[-1])
            week_change_pct = ((latest_close - week_open) / week_open) * 100

            if math.isnan(week_change_pct) or math.isinf(week_change_pct):
                week_change_pct = 0.0

            avg_vol = float(hist["Volume"].mean())
            latest_vol = float(hist["Volume"].iloc[-1])
            volume_spike = round(latest_vol / avg_vol, 2) if avg_vol > 0 else 1.0

            price_history = [round(float(x), 2) for x in hist["Close"].tolist()]
            date_history = [str(d)[:10] for d in hist.index.tolist()]
            earnings_date = get_earnings_alert(stock)

            results.append({
                "ticker": ticker,
                "latest_close": round(latest_close, 2),
                "week_open": round(week_open, 2),
                "week_change_pct": round(week_change_pct, 2),
                "week_high": round(float(week_hist["High"].max()), 2),
                "week_low": round(float(week_hist["Low"].min()), 2),
                "avg_volume": round(avg_vol),
                "latest_volume": round(latest_vol),
                "volume_spike": volume_spike,
                "price_history": price_history,
                "date_history": date_history,
                "year_high": round(float(info.get("fiftyTwoWeekHigh", 0)), 2),
                "year_low": round(float(info.get("fiftyTwoWeekLow", 0)), 2),
                "market_cap": info.get("marketCap", None),
                "pe_ratio": pe_ratio,
                "earnings_date": earnings_date,
                "collected_at": datetime.utcnow().isoformat(),
                "revenue_growth": revenue_growth,
                "profit_margin": profit_margin,
                "debt_equity": debt_equity,
                "earnings_surprise": earnings_surprise,
                "fundamental_score": fund_score
            })

            spike_tag = f" ⚡ vol {volume_spike}x" if volume_spike > 1.5 else ""
            print(f"  → {ticker}: {week_change_pct:+.2f}%{spike_tag}")

        except Exception as e:
            print(f"  → {ticker}: failed — {e}")

    return results

def save_price_data(data):
    os.makedirs("data/raw", exist_ok=True)
    filename = f"data/raw/prices_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    print(f"\nSaved {len(data)} tickers to {filename}")
    return filename

if __name__ == "__main__":
    watchlist = build_dynamic_watchlist()
    data = get_price_data(watchlist)
    save_price_data(data)