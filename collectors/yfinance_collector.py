import yfinance as yf
import json
import math
import os
import time
import random
from datetime import datetime

SEED_WATCHLIST = [
    "SPY", "QQQ",
    "NVDA", "MSFT", "AAPL",
    "SOXX", "XLK", "XLF", "XLV", "ICLN"
]

def load_user_watchlist():
    try:
        if os.path.exists("data/watchlist.json"):
            with open("data/watchlist.json") as f:
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
    watchlist.update(load_user_watchlist())
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
            closes = hist["Close"].dropna() if not hist.empty else None
            if closes is not None and len(closes) >= 2:
                chg = ((float(closes.iloc[-1]) - float(closes.iloc[0])) / float(closes.iloc[0])) * 100
                if not math.isnan(chg) and not math.isinf(chg):
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
        if hasattr(cal, 'columns') and 'Earnings Date' in cal.columns:
            return str(cal['Earnings Date'].iloc[0])[:10]
        if isinstance(cal, dict) and 'Earnings Date' in cal:
            dates = cal['Earnings Date']
            if dates:
                return str(dates[0])[:10]
    except Exception:
        pass
    return None

def get_analyst_data(stock, info):
    analyst_target = None
    analyst_upside = None
    analyst_rating = None
    recent_upgrades = 0
    recent_downgrades = 0
    analyst_action = "neutral"

    try:
        target = info.get("targetMeanPrice")
        current = info.get("currentPrice") or info.get("regularMarketPrice")
        if target and current and current > 0:
            analyst_target = round(float(target), 2)
            analyst_upside = round(((analyst_target - current) / current) * 100, 2)

        rec = info.get("recommendationKey", "")
        if rec in ["strong_buy", "buy"]:
            analyst_rating = "buy"
        elif rec in ["hold", "neutral"]:
            analyst_rating = "hold"
        elif rec in ["sell", "strong_sell"]:
            analyst_rating = "sell"

        try:
            upgrades = stock.upgrades_downgrades
            if upgrades is not None and not upgrades.empty:
                for _, row in upgrades.head(10).iterrows():
                    action = str(row.get("Action", "")).lower()
                    if action in ["up", "upgrade", "initiated", "reiterated"]:
                        grade = str(row.get("ToGrade", "")).lower()
                        if any(g in grade for g in ["buy", "outperform", "overweight", "strong buy"]):
                            recent_upgrades += 1
                        elif any(g in grade for g in ["sell", "underperform", "underweight"]):
                            recent_downgrades += 1
                    elif action in ["down", "downgrade"]:
                        recent_downgrades += 1
        except:
            pass

        if recent_upgrades >= 2 and recent_downgrades == 0:
            analyst_action = "strong_upgrade"
        elif recent_upgrades > recent_downgrades:
            analyst_action = "upgrade"
        elif recent_downgrades > recent_upgrades:
            analyst_action = "downgrade"
        elif recent_downgrades >= 2:
            analyst_action = "strong_downgrade"

    except Exception:
        pass

    return {
        "analyst_target": analyst_target,
        "analyst_upside": analyst_upside,
        "analyst_rating": analyst_rating,
        "recent_upgrades": recent_upgrades,
        "recent_downgrades": recent_downgrades,
        "analyst_action": analyst_action
    }

def get_short_interest_data(info):
    try:
        short_ratio = info.get("shortRatio")
        short_float = info.get("shortPercentOfFloat")
        shares_short = info.get("sharesShort")
        shares_short_prior = info.get("sharesShortPriorMonth")

        if short_ratio:
            short_ratio = round(float(short_ratio), 2)
        if short_float:
            short_float = round(float(short_float) * 100, 2)

        short_change = None
        if shares_short and shares_short_prior and shares_short_prior > 0:
            short_change = round(((shares_short - shares_short_prior) / shares_short_prior) * 100, 2)

        if short_float and short_float > 20:
            short_signal = "heavily_shorted"
        elif short_float and short_float > 10:
            short_signal = "elevated"
        elif short_float and short_float > 5:
            short_signal = "moderate"
        else:
            short_signal = "low"

        return {
            "short_ratio": short_ratio,
            "short_float_pct": short_float,
            "short_change_mom": short_change,
            "short_signal": short_signal
        }
    except:
        return {"short_ratio": None, "short_float_pct": None,
                "short_change_mom": None, "short_signal": "unknown"}

def calculate_historical_metrics(prices):
    """
    Calculate 30-day momentum, annualized volatility, and trend direction.
    Expects a clean list of floats with no NaN values.
    """
    if not prices or len(prices) < 10:
        return {"momentum_30d": None, "volatility_30d": None,
                "trend_direction": "unknown", "trend_strength": 0, "beta_proxy": None}

    first = prices[0]
    last = prices[-1]

    momentum_30d = round(((last - first) / first) * 100, 2) if first > 0 else 0

    daily_returns = []
    for i in range(1, len(prices)):
        if prices[i-1] > 0:
            daily_returns.append((prices[i] - prices[i-1]) / prices[i-1])

    volatility_30d = None
    if len(daily_returns) >= 5:
        mean_ret = sum(daily_returns) / len(daily_returns)
        variance = sum((r - mean_ret) ** 2 for r in daily_returns) / len(daily_returns)
        std_daily = variance ** 0.5
        vol = round(std_daily * (252 ** 0.5) * 100, 1)
        # Sanity check — ignore clearly wrong values
        volatility_30d = vol if 0 < vol < 500 else None

    trend_direction = "sideways"
    trend_strength = 0
    if len(prices) >= 10:
        mid = len(prices) // 2
        first_half_avg = sum(prices[:mid]) / mid
        second_half_avg = sum(prices[mid:]) / (len(prices) - mid)
        if first_half_avg > 0:
            pct_diff = (second_half_avg - first_half_avg) / first_half_avg * 100
            trend_strength = round(abs(pct_diff), 1)
            if pct_diff > 3:
                trend_direction = "uptrend"
            elif pct_diff < -3:
                trend_direction = "downtrend"

    return {
        "momentum_30d": momentum_30d,
        "volatility_30d": volatility_30d,
        "trend_direction": trend_direction,
        "trend_strength": trend_strength,
        "beta_proxy": None,
    }

def fetch_ticker_data(ticker, max_retries=2):
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
        if i > 0:
            time.sleep(random.uniform(0.8, 1.5))
        if i > 0 and i % 20 == 0:
            cooldown = random.uniform(3, 6)
            print(f"  [Cooldown {cooldown:.1f}s after {i} tickers...]")
            time.sleep(cooldown)

        try:
            stock, hist, info = fetch_ticker_data(ticker)
            if stock is None or hist is None:
                print(f"  → {ticker}: skipped (no data)")
                continue

            # ── Drop NaN closes — fixes intraday incomplete candles ──
            valid_closes = hist["Close"].dropna()
            if len(valid_closes) < 5:
                print(f"  → {ticker}: skipped (insufficient valid closes: {len(valid_closes)})")
                continue

            latest_close = float(valid_closes.iloc[-1])
            if math.isnan(latest_close) or math.isinf(latest_close) or latest_close <= 0:
                print(f"  → {ticker}: skipped (invalid close price)")
                continue

            # Week change using last 5 valid closes
            week_closes = valid_closes.tail(5)
            week_open = float(week_closes.iloc[0])
            week_change_pct = ((latest_close - week_open) / week_open) * 100 if week_open > 0 else 0.0
            if math.isnan(week_change_pct) or math.isinf(week_change_pct):
                week_change_pct = 0.0

            # Clean price history — no NaN, no zero, no inf
            price_history = [
                round(float(x), 2) for x in valid_closes.tolist()
                if not math.isnan(float(x)) and not math.isinf(float(x)) and float(x) > 0
            ]
            date_history = [str(d)[:10] for d in hist.index.tolist()]

            # Volume — safe fallback
            valid_volumes = hist["Volume"].dropna()
            avg_vol = float(valid_volumes.mean()) if not valid_volumes.empty else 0
            latest_vol = float(valid_volumes.iloc[-1]) if not valid_volumes.empty else 0
            volume_spike = round(latest_vol / avg_vol, 2) if avg_vol > 0 else 1.0
            if math.isnan(volume_spike) or math.isinf(volume_spike):
                volume_spike = 1.0

            # Week high/low from valid data
            valid_hist = hist.dropna(subset=["High", "Low"])
            week_valid = valid_hist.tail(5)
            week_high = round(float(week_valid["High"].max()), 2) if not week_valid.empty else latest_close
            week_low = round(float(week_valid["Low"].min()), 2) if not week_valid.empty else latest_close

            def safe(key, default=None):
                val = info.get(key)
                return val if val not in [None, "N/A", float("inf")] else default

            revenue_growth = safe("revenueGrowth")
            if revenue_growth is not None:
                revenue_growth = round(revenue_growth * 100, 2)

            profit_margin = safe("profitMargins")
            if profit_margin is not None:
                profit_margin = round(profit_margin * 100, 2)

            debt_equity = safe("debtToEquity")
            if debt_equity is not None:
                debt_equity = round(debt_equity / 100, 2)

            pe_ratio = safe("trailingPE")
            if pe_ratio is not None:
                pe_ratio = round(float(pe_ratio), 2)

            earnings_surprise = None
            try:
                earnings_hist = stock.earnings_history
                if earnings_hist is not None and not earnings_hist.empty:
                    for col in ["surprisePercent", "Surprise(%)", "epsActual"]:
                        if col in earnings_hist.columns:
                            surprises = earnings_hist[col].dropna().tolist()
                            beats = sum(1 for s in surprises[-4:] if s > 0)
                            earnings_surprise = f"{beats}/4 beats"
                            break
            except:
                pass

            if not earnings_surprise:
                try:
                    eps = info.get("epsTrailingTwelveMonths")
                    fwd = info.get("epsForward")
                    if eps and fwd:
                        earnings_surprise = "EPS growing" if fwd > eps else "EPS flat/declining"
                except:
                    pass

            # Fundamental score
            fund_score = 50
            if revenue_growth is not None:
                fund_score += 20 if revenue_growth > 15 else 10 if revenue_growth > 5 else -20 if revenue_growth < 0 else 0
            if profit_margin is not None:
                fund_score += 15 if profit_margin > 20 else 8 if profit_margin > 10 else -15 if profit_margin < 0 else 0
            if debt_equity is not None:
                fund_score += 10 if debt_equity < 1 else -10 if debt_equity > 2 else 0
            fund_score = max(0, min(100, fund_score))

            analyst = get_analyst_data(stock, info)
            adjust = {"strong_upgrade": 10, "upgrade": 5, "downgrade": -5, "strong_downgrade": -10}
            fund_score = max(0, min(100, fund_score + adjust.get(analyst["analyst_action"], 0)))

            short_data = get_short_interest_data(info)
            earnings_date = get_earnings_alert(stock)
            hist_metrics = calculate_historical_metrics(price_history)

            beta = safe("beta")
            if beta is not None:
                beta = round(float(beta), 2)
            hist_metrics["beta_proxy"] = beta

            # Print summary
            vol_tag = f" vol:{hist_metrics['volatility_30d']:.0f}%" if hist_metrics["volatility_30d"] else ""
            trend_tag = f" [{hist_metrics['trend_direction']}]"
            spike_tag = f" ⚡{volume_spike}x" if volume_spike > 1.5 else ""
            analyst_tag = ""
            if analyst["analyst_action"] in ["strong_upgrade", "upgrade"]:
                analyst_tag = f" ⬆{analyst['recent_upgrades']}up"
            elif analyst["analyst_action"] in ["strong_downgrade", "downgrade"]:
                analyst_tag = f" ⬇{analyst['recent_downgrades']}dn"
            if analyst["analyst_upside"] is not None:
                analyst_tag += f" tgt:{analyst['analyst_upside']:+.1f}%"
            short_tag = f" 🩳{short_data['short_float_pct']:.1f}%" if short_data.get("short_float_pct") and short_data["short_float_pct"] > 10 else ""

            print(f"  → {ticker}: {week_change_pct:+.2f}%{spike_tag}{analyst_tag}{short_tag}{trend_tag}{vol_tag}")

            results.append({
                "ticker": ticker,
                "latest_close": round(latest_close, 2),
                "week_open": round(week_open, 2),
                "week_change_pct": round(week_change_pct, 2),
                "week_high": week_high,
                "week_low": week_low,
                "avg_volume": round(avg_vol),
                "latest_volume": round(latest_vol),
                "volume_spike": volume_spike,
                "price_history": price_history,
                "date_history": date_history,
                "year_high": round(float(info.get("fiftyTwoWeekHigh", 0) or 0), 2),
                "year_low": round(float(info.get("fiftyTwoWeekLow", 0) or 0), 2),
                "market_cap": info.get("marketCap"),
                "pe_ratio": pe_ratio,
                "earnings_date": earnings_date,
                "collected_at": datetime.utcnow().isoformat(),
                "revenue_growth": revenue_growth,
                "profit_margin": profit_margin,
                "debt_equity": debt_equity,
                "earnings_surprise": earnings_surprise,
                "fundamental_score": fund_score,
                "analyst_target": analyst["analyst_target"],
                "analyst_upside": analyst["analyst_upside"],
                "analyst_rating": analyst["analyst_rating"],
                "analyst_action": analyst["analyst_action"],
                "recent_upgrades": analyst["recent_upgrades"],
                "recent_downgrades": analyst["recent_downgrades"],
                "short_ratio": short_data["short_ratio"],
                "short_float_pct": short_data["short_float_pct"],
                "short_change_mom": short_data["short_change_mom"],
                "short_signal": short_data["short_signal"],
                "momentum_30d": hist_metrics["momentum_30d"],
                "volatility_30d": hist_metrics["volatility_30d"],
                "trend_direction": hist_metrics["trend_direction"],
                "trend_strength": hist_metrics["trend_strength"],
                "beta": hist_metrics["beta_proxy"],
            })

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