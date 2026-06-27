import json
import os
from datetime import datetime

SECTOR_MAP = {
    "Technology": ["AAPL", "MSFT", "GOOGL", "GOOG", "META", "SNOW", "NET", "SHOP", "XLK"],
    "AI & Semiconductors": ["NVDA", "AMD", "SOXX", "SMH"],
    "Cybersecurity": ["CRWD", "PANW", "ZS", "PLTR"],
    "Finance": ["JPM", "BAC", "GS", "V", "MA", "WFC", "C", "XLF"],
    "Healthcare": ["LLY", "JNJ", "UNH", "MRNA", "PFE", "ABBV", "XLV"],
    "Clean Energy": ["ENPH", "NEE", "FSLR", "PLUG", "BE", "ICLN"],
    "Consumer": ["COST", "SBUX", "MCD", "TGT", "WMT", "NFLX", "DIS", "UBER", "ABNB"],
    "ETF Broad": ["SPY", "QQQ"],
}

TICKER_TO_SECTOR = {}
for sector, tickers in SECTOR_MAP.items():
    for ticker in tickers:
        TICKER_TO_SECTOR[ticker] = sector

def load_latest_file(prefix):
    files = sorted([f for f in os.listdir("data/raw") if f.startswith(prefix) and f.endswith(".json")])
    if not files:
        return []
    with open(f"data/raw/{files[-1]}") as f:
        return json.load(f)

def load_latest_sentiment():
    files = sorted([f for f in os.listdir("data/processed") if f.startswith("sentiment_") and f.endswith(".json")])
    if not files:
        return {}
    with open(f"data/processed/{files[-1]}") as f:
        return json.load(f)

def load_macro_context():
    macro = {"fear_greed": None, "vix": None}
    try:
        if os.path.exists("data/processed/fear_greed.json"):
            with open("data/processed/fear_greed.json") as f:
                macro["fear_greed"] = json.load(f)
    except: pass
    try:
        if os.path.exists("data/processed/vix.json"):
            with open("data/processed/vix.json") as f:
                macro["vix"] = json.load(f)
    except: pass
    return macro

def load_congress_data():
    try:
        if os.path.exists("data/processed/congress_trades.json"):
            with open("data/processed/congress_trades.json") as f:
                return json.load(f).get("tickers", {})
    except: pass
    return {}

def normalize(value, min_val, max_val):
    if max_val == min_val:
        return 0.5
    return max(0, min(1, (value - min_val) / (max_val - min_val)))

def calculate_rsi(prices, period=14):
    if not prices or len(prices) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(prices)):
        change = prices[i] - prices[i-1]
        gains.append(max(0, change))
        losses.append(max(0, -change))
    if len(gains) < period:
        return None
    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period
    if avg_loss == 0:
        return 100
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)

def get_macro_multiplier(macro):
    multiplier = 1.0
    fg_value = macro.get("fear_greed", {}).get("value") if macro.get("fear_greed") else None
    vix_value = macro.get("vix", {}).get("value") if macro.get("vix") else None
    if fg_value is not None:
        if fg_value <= 25: multiplier += 0.05
        elif fg_value <= 45: multiplier += 0.02
        elif fg_value >= 75: multiplier -= 0.05
        elif fg_value >= 55: multiplier -= 0.02
    if vix_value is not None:
        if vix_value >= 30: multiplier += 0.03
        elif vix_value < 15: multiplier -= 0.02
    return max(0.85, min(1.15, multiplier))

def get_congress_score(congress_data, ticker):
    if not congress_data or ticker not in congress_data:
        return 0.5, "no_data"
    data = congress_data[ticker]
    return data.get("congress_score", 50) / 100, data.get("signal", "neutral")

def get_analyst_score(price):
    analyst_score = 0.5
    analyst_action = price.get("analyst_action", "neutral")
    analyst_upside = price.get("analyst_upside")
    analyst_rating = price.get("analyst_rating")
    if analyst_rating == "buy": analyst_score = 0.7
    elif analyst_rating == "sell": analyst_score = 0.3
    if analyst_upside is not None:
        if analyst_upside > 30: analyst_score = min(1.0, analyst_score + 0.2)
        elif analyst_upside > 15: analyst_score = min(1.0, analyst_score + 0.1)
        elif analyst_upside < -10: analyst_score = max(0.0, analyst_score - 0.2)
        elif analyst_upside < 0: analyst_score = max(0.0, analyst_score - 0.1)
    if analyst_action == "strong_upgrade": analyst_score = min(1.0, analyst_score + 0.15)
    elif analyst_action == "upgrade": analyst_score = min(1.0, analyst_score + 0.08)
    elif analyst_action == "downgrade": analyst_score = max(0.0, analyst_score - 0.08)
    elif analyst_action == "strong_downgrade": analyst_score = max(0.0, analyst_score - 0.15)
    return analyst_score

def get_short_interest_score(price):
    short_float = price.get("short_float_pct")
    week_change = price.get("week_change_pct", 0)
    if short_float is None:
        return 0.5
    if short_float > 20 and week_change > 5: return 0.8
    elif short_float > 20 and week_change < -3: return 0.25
    elif short_float > 10 and week_change > 3: return 0.65
    elif short_float > 10: return 0.4
    else: return 0.55

def get_historical_price_score(price):
    """
    Enhanced price score using 30-day momentum and trend direction
    alongside the 1-week change.
    """
    week_change = price.get("week_change_pct", 0)
    momentum_30d = price.get("momentum_30d")
    trend_direction = price.get("trend_direction", "unknown")
    trend_strength = price.get("trend_strength", 0)

    # Base: 1-week change (normalized between -30% and +30%)
    week_score = normalize(week_change, -30, 30)

    # 30-day momentum bonus
    momentum_bonus = 0.0
    if momentum_30d is not None:
        if momentum_30d > 20:
            momentum_bonus = 0.15
        elif momentum_30d > 10:
            momentum_bonus = 0.08
        elif momentum_30d > 0:
            momentum_bonus = 0.03
        elif momentum_30d < -15:
            momentum_bonus = -0.10
        elif momentum_30d < -5:
            momentum_bonus = -0.05

    # Trend direction bonus
    trend_bonus = 0.0
    if trend_direction == "uptrend":
        trend_bonus = min(0.10, trend_strength / 100)
    elif trend_direction == "downtrend":
        trend_bonus = max(-0.10, -trend_strength / 100)
    # sideways/choppy = 0

    combined = week_score + momentum_bonus + trend_bonus
    return max(0.0, min(1.0, combined))

def get_volatility_tag(price):
    """
    Classify stock by volatility — used for strategy recommendations
    low: <20% annualized — stable, good for conservative
    medium: 20-40% — normal
    high: >40% — volatile, good for aggressive
    """
    vol = price.get("volatility_30d")
    beta = price.get("beta")

    if vol is None and beta is None:
        return "unknown"
    if vol is not None:
        if vol < 20: return "low"
        elif vol < 40: return "medium"
        else: return "high"
    # Fallback to beta
    if beta is not None:
        if beta < 0.8: return "low"
        elif beta < 1.2: return "medium"
        else: return "high"
    return "unknown"

def compute_scores(price_data, sentiment_data, stocktwits_data={},
                   insider_data={}, institutional_data={},
                   trends_data={}, options_data={}):
    scores = []

    macro = load_macro_context()
    congress_data = load_congress_data()
    macro_multiplier = get_macro_multiplier(macro)

    if macro_multiplier != 1.0:
        direction = "boosting" if macro_multiplier > 1.0 else "reducing"
        print(f"  Macro context {direction} scores by {abs(macro_multiplier - 1.0)*100:.1f}% "
              f"(FG:{macro.get('fear_greed', {}).get('value', '?')} "
              f"VIX:{macro.get('vix', {}).get('value', '?')})")

    all_changes = [abs(p["week_change_pct"]) for p in price_data if p.get("week_change_pct") is not None]
    all_mentions = [sentiment_data[t]["mentions"] for t in sentiment_data] or [0]
    all_reddit_scores = [sentiment_data[t]["total_reddit_score"] for t in sentiment_data] or [0]

    max_change = max(all_changes) if all_changes else 1
    max_mentions = max(all_mentions) if all_mentions else 1
    max_reddit = max(all_reddit_scores) if all_reddit_scores else 1

    for price in price_data:
        ticker = price["ticker"]
        sentiment = sentiment_data.get(ticker, {})
        st = stocktwits_data.get(ticker, {})
        insider = insider_data.get(ticker, {})
        institutional = institutional_data.get(ticker, {})
        trends = trends_data.get(ticker, {})
        options = options_data.get(ticker, {})

        week_change = price.get("week_change_pct") or 0

        # --- Enhanced price score (uses 30d momentum + trend) ---
        combined_price = get_historical_price_score(price)

        # --- RSI ---
        price_history = price.get("price_history", [])
        rsi = calculate_rsi(price_history)
        rsi_score = 0.5
        if rsi:
            if rsi < 30: rsi_score = 0.85
            elif rsi < 45: rsi_score = 0.65
            elif rsi < 55: rsi_score = 0.5
            elif rsi < 70: rsi_score = 0.4
            else: rsi_score = 0.2

        # Blend RSI into price score
        combined_price = combined_price * 0.75 + rsi_score * 0.25

        # --- 52-week breakout ---
        year_high = price.get("year_high", 0)
        year_low = price.get("year_low", 0)
        latest_close = price.get("latest_close", 0)
        breakout_score = 0.5
        if year_high and year_low and latest_close and year_high != year_low:
            range_pct = (latest_close - year_low) / (year_high - year_low)
            if range_pct > 0.95: breakout_score = 0.85
            elif range_pct > 0.8: breakout_score = 0.7
            elif range_pct < 0.2: breakout_score = 0.3

        combined_price = combined_price * 0.8 + breakout_score * 0.2

        # --- Sentiment ---
        avg_sentiment = sentiment.get("avg_sentiment", 0)
        sentiment_score = normalize(avg_sentiment, -1, 1)

        # --- Social buzz ---
        mentions = sentiment.get("mentions", 0)
        reddit_score = sentiment.get("total_reddit_score", 0)
        mention_score = normalize(mentions, 0, max_mentions)
        reddit_score_norm = normalize(reddit_score, 0, max_reddit)
        buzz_score = (mention_score * 0.5) + (reddit_score_norm * 0.5)

        # --- StockTwits ---
        st_raw = st.get("stocktwits_score", 0)
        st_score = normalize(st_raw, -1, 1)

        # --- Fundamentals ---
        fund_raw = price.get("fundamental_score", 50)
        fund_score = fund_raw / 100

        # --- Analyst ---
        analyst_score = get_analyst_score(price)

        # --- Short interest ---
        short_score = get_short_interest_score(price)

        # --- Congress ---
        congress_score_val, congress_signal = get_congress_score(congress_data, ticker)

        # --- Insider ---
        insider_score = 0.5
        insider_count = insider.get("count", 0)
        if insider_count > 3: insider_score = 0.8
        elif insider_count > 0: insider_score = 0.65

        # --- Institutional ---
        inst_score = 0.5
        major_count = institutional.get("major_count", 0)
        if major_count >= 3: inst_score = 0.85
        elif major_count >= 2: inst_score = 0.7
        elif major_count >= 1: inst_score = 0.6

        # --- Google Trends ---
        trends_score = 0.5
        if trends:
            raw_score = trends.get("score", 50)
            trend_dir = trends.get("trend", "stable")
            trends_score = raw_score / 100
            if trend_dir == "rising": trends_score = min(1.0, trends_score + 0.15)
            elif trend_dir == "falling": trends_score = max(0.0, trends_score - 0.15)

        # --- Options flow ---
        options_score = 0.5
        if options:
            raw = options.get("score", 50)
            options_score = raw / 100
            if options.get("unusual_activity"): options_score = min(1.0, options_score + 0.1)

        # --- Composite score ---
        composite = (
            combined_price      * 0.20 +
            sentiment_score     * 0.18 +
            buzz_score          * 0.10 +
            st_score            * 0.08 +
            fund_score          * 0.12 +
            analyst_score       * 0.10 +
            short_score         * 0.05 +
            congress_score_val  * 0.05 +
            insider_score       * 0.04 +
            inst_score          * 0.04 +
            trends_score        * 0.02 +
            options_score       * 0.02
        ) * 100

        composite *= macro_multiplier

        # --- Confluence bonus ---
        bullish_signals = sum([
            1 if week_change > 5 else 0,
            1 if avg_sentiment > 0.1 else 0,
            1 if st_raw > 0.1 else 0,
            1 if mentions > 5 else 0,
            1 if fund_raw > 60 else 0,
            1 if major_count >= 2 else 0,
            1 if insider_count > 0 else 0,
            1 if trends_score > 0.6 else 0,
            1 if options_score > 0.6 else 0,
            1 if analyst_score > 0.65 else 0,
            1 if short_score > 0.65 else 0,
            1 if congress_score_val > 0.65 else 0,
        ])

        # Extra bonus if 30d trend confirms the signal
        trend_direction = price.get("trend_direction", "unknown")
        if trend_direction == "uptrend" and bullish_signals >= 4:
            composite = min(100, composite * 1.03)
        elif trend_direction == "downtrend":
            composite = max(0, composite * 0.95)

        if bullish_signals >= 7: composite = min(100, composite * 1.10)
        elif bullish_signals >= 5: composite = min(100, composite * 1.05)
        elif bullish_signals >= 4: composite = min(100, composite * 1.02)

        # --- Penalties ---
        if week_change < -3 and avg_sentiment > 0.5: composite *= 0.85
        if mentions == 0 and st_raw == 0 and week_change < 0: composite *= 0.90
        if congress_signal in ["bearish", "sell_cluster", "strong_sell_cluster"]: composite *= 0.92

        composite = min(100, max(0, composite))
        volatility_tag = get_volatility_tag(price)
        sector = TICKER_TO_SECTOR.get(ticker, "Other")

        scores.append({
            "ticker": ticker,
            "sector": sector,
            "composite_score": round(composite, 1),
            "week_change_pct": week_change,
            "avg_sentiment": avg_sentiment,
            "mentions": mentions,
            "total_reddit_score": reddit_score,
            "stocktwits_score": st_raw,
            "stocktwits_bullish": st.get("bullish", 0),
            "stocktwits_bearish": st.get("bearish", 0),
            "fundamental_score": fund_raw,
            "revenue_growth": price.get("revenue_growth"),
            "profit_margin": price.get("profit_margin"),
            "debt_equity": price.get("debt_equity"),
            "earnings_surprise": price.get("earnings_surprise"),
            "rsi": round(rsi, 1) if rsi else None,
            "breakout_score": round(breakout_score * 100, 1),
            "insider_count": insider_count,
            "major_institutions": major_count,
            "trends_score": round(trends_score * 100, 1),
            "options_score": round(options_score * 100, 1),
            "options_signal": options.get("signal", "neutral"),
            "pc_ratio": options.get("pc_ratio"),
            "unusual_options": options.get("unusual_activity", False),
            "search_trend": trends.get("trend", "stable"),
            "bullish_signals": bullish_signals,
            "price_score": round(combined_price * 100, 1),
            "sentiment_score": round(sentiment_score * 100, 1),
            "buzz_score": round(buzz_score * 100, 1),
            "st_score": round(st_score * 100, 1),
            "latest_close": price.get("latest_close"),
            "earnings_date": price.get("earnings_date"),
            "is_etf": ticker in ["SOXX","SMH","XLV","XLF","ICLN","XLK","SPY","QQQ","IBB","ARKB"],
            "analyst_score": round(analyst_score * 100, 1),
            "analyst_target": price.get("analyst_target"),
            "analyst_upside": price.get("analyst_upside"),
            "analyst_rating": price.get("analyst_rating"),
            "analyst_action": price.get("analyst_action"),
            "recent_upgrades": price.get("recent_upgrades", 0),
            "recent_downgrades": price.get("recent_downgrades", 0),
            "short_float_pct": price.get("short_float_pct"),
            "short_ratio": price.get("short_ratio"),
            "short_signal": price.get("short_signal", "unknown"),
            "short_score": round(short_score * 100, 1),
            "congress_score": round(congress_score_val * 100, 1),
            "congress_signal": congress_signal,
            "congress_buys": congress_data.get(ticker, {}).get("buys", 0),
            "congress_sells": congress_data.get(ticker, {}).get("sells", 0),
            "congress_buyers": congress_data.get(ticker, {}).get("recent_buyers", []),
            # Historical metrics
            "momentum_30d": price.get("momentum_30d"),
            "volatility_30d": price.get("volatility_30d"),
            "trend_direction": trend_direction,
            "trend_strength": price.get("trend_strength", 0),
            "beta": price.get("beta"),
            "volatility_tag": volatility_tag,
        })

    sorted_scores = sorted(scores, key=lambda x: x["composite_score"], reverse=True)

    for s in sorted_scores:
        if s["week_change_pct"] < -2 and not s["is_etf"]:
            s["composite_score"] = round(s["composite_score"] * 0.80, 1)
            s["top_pick_filtered"] = True

    return sorted(sorted_scores, key=lambda x: x["composite_score"], reverse=True)


def get_sector_summary(scores):
    sector_data = {}
    for s in scores:
        sector = s["sector"]
        if sector not in sector_data:
            sector_data[sector] = {"sector": sector, "tickers": [], "avg_change": 0, "top_score": 0}
        sector_data[sector]["tickers"].append(s)
    for sector, data in sector_data.items():
        tickers = data["tickers"]
        valid_changes = [t["week_change_pct"] for t in tickers if t.get("week_change_pct") is not None]
        data["avg_change"] = round(sum(valid_changes) / len(valid_changes), 2) if valid_changes else 0
        data["top_score"] = round(max(t["composite_score"] for t in tickers), 1)
        data["top_5"] = sorted(tickers, key=lambda x: x["composite_score"], reverse=True)[:5]
    return sorted(sector_data.values(), key=lambda x: x["avg_change"], reverse=True)


if __name__ == "__main__":
    print("Loading data...")
    price_data = load_latest_file("prices_")
    sentiment_data = load_latest_sentiment()

    st_files = sorted([f for f in os.listdir("data/raw") if f.startswith("stocktwits_")])
    stocktwits_data = {}
    if st_files:
        with open(f"data/raw/{st_files[-1]}") as f:
            st_posts = json.load(f)
        from nlp.sentiment import aggregate_stocktwits_sentiment
        stocktwits_data = aggregate_stocktwits_sentiment(st_posts)

    insider_files = sorted([f for f in os.listdir("data/raw") if f.startswith("insider_")])
    insider_data = {}
    if insider_files:
        with open(f"data/raw/{insider_files[-1]}") as f:
            insider_data = json.load(f)

    inst_files = sorted([f for f in os.listdir("data/raw") if f.startswith("institutional_")])
    inst_data = {}
    if inst_files:
        with open(f"data/raw/{inst_files[-1]}") as f:
            inst_data = json.load(f)

    macro = load_macro_context()
    print(f"Fear & Greed: {macro.get('fear_greed', {}).get('value', 'N/A')} | VIX: {macro.get('vix', {}).get('value', 'N/A')}")
    print(f"Congress: {len(load_congress_data())} tickers")

    scores = compute_scores(price_data, sentiment_data, stocktwits_data,
                           insider_data=insider_data, institutional_data=inst_data)
    sectors = get_sector_summary(scores)

    print("\nTOP 10 PICKS")
    top = [s for s in scores if not s["is_etf"]][:10]
    for i, t in enumerate(top, 1):
        congress_tag = f" 🏛{t['congress_signal']}" if t['congress_signal'] not in ['neutral','no_data'] else ""
        trend_tag = f" [{t['trend_direction']}]" if t.get('trend_direction') else ""
        vol_tag = f" vol:{t['volatility_30d']:.0f}%" if t.get('volatility_30d') else ""
        mom = t.get("momentum_30d") or 0
        print(f"#{i} {t['ticker']:<6} {t['composite_score']:>5.1f} | "
              f"1w:{t['week_change_pct']:>+.1f}% 30d:{mom:>+.1f}% "
              f"signals:{t['bullish_signals']}/12{congress_tag}{trend_tag}{vol_tag}")

    os.makedirs("data/processed", exist_ok=True)
    outfile = f"data/processed/scores_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(outfile, "w") as f:
        json.dump({"generated_at": datetime.utcnow().isoformat(), "scores": scores, "sectors": sectors},
                  f, indent=2, default=str)
    print(f"\nSaved to {outfile}")