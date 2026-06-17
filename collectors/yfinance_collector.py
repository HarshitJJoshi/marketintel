import yfinance as yf
import json
import os
from datetime import datetime

# Small seed list — just the ones we always want regardless of news
SEED_WATCHLIST = [
    "SPY", "QQQ",           # broad market always tracked
    "NVDA", "MSFT", "AAPL", # mega caps always relevant
    "SOXX", "XLK", "XLF", "XLV", "ICLN"  # sector ETFs
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
    """
    Build watchlist dynamically:
    1. Start with seed list
    2. Add all tickers NLP found this week
    3. Add S&P 500 movers from yfinance screener
    4. Deduplicate and validate
    """
    watchlist = set(SEED_WATCHLIST)

    # Add user watchlist tickers
    user_tickers = load_user_watchlist()
    watchlist.update(user_tickers)

    # Add NLP-discovered tickers
    for t in nlp_tickers:
        if len(t) <= 5 and t.isalpha():
            watchlist.add(t.upper())

    # Add top S&P 500 movers this week
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
    # Use a representative sample of S&P 500 sectors
    sp500_sample = [
        # Tech
        "AAPL","MSFT","NVDA","AMD","GOOGL","AMZN","META","TSLA","ORCL","CRM",
        "ADBE","INTC","QCOM","TXN","AMAT","LRCX","KLAC","MRVL","AVGO","MU",
        # Finance
        "JPM","BAC","WFC","GS","MS","C","BLK","SCHW","AXP","V","MA","COF",
        # Healthcare
        "LLY","JNJ","UNH","ABBV","MRK","PFE","TMO","ABT","DHR","ISRG","MRNA",
        # Energy
        "XOM","CVX","COP","SLB","EOG","MPC","PSX","VLO",
        # Consumer
        "AMZN","HD","MCD","NKE","SBUX","TGT","WMT","COST","LOW","TJX",
        # Industrial
        "CAT","DE","GE","HON","MMM","UPS","FDX","BA","LMT","RTX",
        # Clean energy
        "ENPH","NEE","FSLR","PLUG","BE","SEDG",
        # Cybersecurity
        "CRWD","PANW","ZS","PLTR","NET","S","FTNT",
        # ETFs
        "SOXX","SMH","XLK","XLV","XLF","ICLN","XLE","XLY","XLI","XLB"
    ]

    results = []
    for ticker in sp500_sample:
        try:
            hist = yf.Ticker(ticker).history(period="5d")
            if len(hist) >= 2:
                chg = ((hist["Close"].iloc[-1] - hist["Close"].iloc[0]) / hist["Close"].iloc[0]) * 100
                results.append((ticker, chg))
        except:
            pass

    # Return top N movers by absolute change
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

def get_price_data(tickers):
    print(f"Fetching price data for {len(tickers)} tickers...")
    results = []

    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="1mo")
            info = stock.info

            # --- Fundamentals ---
            def safe(key, default=None):
                val = info.get(key)
                return val if val not in [None, "N/A", float("inf")] else default

            # Revenue growth YoY
            revenue_growth = safe("revenueGrowth")
            if revenue_growth:
                revenue_growth = round(revenue_growth * 100, 2)

            # Profit margin trend
            profit_margin = safe("profitMargins")
            if profit_margin:
                profit_margin = round(profit_margin * 100, 2)

            # Debt to equity
            debt_equity = safe("debtToEquity")
            if debt_equity:
                debt_equity = round(debt_equity / 100, 2)

            # Earnings surprise history
            earnings_surprise = None
            try:
                # Try earnings_history first
                earnings_hist = ticker_obj.earnings_history
                if earnings_hist is not None and not earnings_hist.empty:
                    cols = earnings_hist.columns.tolist()
                    # Try different column names yfinance uses
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

            # Fallback — use earnings_dates if available
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

            # Sector average PE for relative comparison
            sector_pe_map = {
                "Technology": 35, "AI & Semiconductors": 40,
                "Healthcare": 25, "Finance": 15,
                "Consumer": 22, "Clean Energy": 30,
                "Cybersecurity": 45, "Other": 25
            }
            pe_ratio = safe("trailingPE")
            if pe_ratio:
                pe_ratio = round(float(pe_ratio), 2)

            # Fundamental score 0-100
            fund_score = 50  # baseline
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

            if hist.empty:
                continue

            week_hist = hist.tail(5)
            week_open = float(week_hist["Close"].iloc[0])
            latest_close = float(week_hist["Close"].iloc[-1])
            week_change_pct = ((latest_close - week_open) / week_open) * 100

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
                "pe_ratio": round(float(info.get("trailingPE", 0)), 2) if info.get("trailingPE") else None,
                "earnings_date": earnings_date,
                "collected_at": datetime.utcnow().isoformat(),
                "revenue_growth": revenue_growth,
                "profit_margin": profit_margin,
                "debt_equity": debt_equity,
                "earnings_surprise": earnings_surprise,
                "pe_ratio": pe_ratio,
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