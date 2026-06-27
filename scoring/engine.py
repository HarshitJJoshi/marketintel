import json
import os
from datetime import datetime

# Sector mapping
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
    files = sorted([
        f for f in os.listdir("data/raw")
        if f.startswith(prefix) and f.endswith(".json")
    ])
    if not files:
        return []
    with open(f"data/raw/{files[-1]}") as f:
        return json.load(f)

def load_latest_sentiment():
    files = sorted([
        f for f in os.listdir("data/processed")
        if f.startswith("sentiment_") and f.endswith(".json")
    ])
    if not files:
        return {}
    with open(f"data/processed/{files[-1]}") as f:
        return json.load(f)

def load_macro_context():
    """Load Fear & Greed and VIX for macro-level score adjustment"""
    macro = {"fear_greed": None, "vix": None}
    try:
        if os.path.exists("data/processed/fear_greed.json"):
            with open("data/processed/fear_greed.json") as f:
                macro["fear_greed"] = json.load(f)
    except:
        pass
    try:
        if os.path.exists("data/processed/vix.json"):
            with open("data/processed/vix.json") as f:
                macro["vix"] = json.load(f)
    except:
        pass
    return macro

def load_congress_data():
    """Load congressional trading signals"""
    try:
        if os.path.exists("data/processed/congress_trades.json"):
            with open("data/processed/congress_trades.json") as f:
                raw = json.load(f)
                return raw.get("tickers", {})
    except:
        pass
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
    """
    Fear & Greed + VIX together set a macro context multiplier
    Extreme Fear + High VIX = best buying opportunity historically
    Extreme Greed + Low VIX = most dangerous time to buy
    """
    multiplier = 1.0
    fg_value = None
    vix_value = None

    if macro.get("fear_greed") and macro["fear_greed"].get("value"):
        fg_value = macro["fear_greed"]["value"]
    if macro.get("vix") and macro["vix"].get("value"):
        vix_value = macro["vix"]["value"]

    if fg_value is not None:
        if fg_value <= 25:
            # Extreme Fear — boost all scores slightly (contrarian buy)
            multiplier += 0.05
        elif fg_value <= 45:
            multiplier += 0.02
        elif fg_value >= 75:
            # Extreme Greed — penalize slightly (caution)
            multiplier -= 0.05
        elif fg_value >= 55:
            multiplier -= 0.02

    if vix_value is not None:
        if vix_value >= 30:
            # High fear = opportunity
            multiplier += 0.03
        elif vix_value < 15:
            # Too calm = complacency risk
            multiplier -= 0.02

    return max(0.85, min(1.15, multiplier))

def get_congress_score(congress_data, ticker):
    """
    Score based on congressional trading signal
    Strong buy cluster from senators = very bullish
    Strong sell cluster = bearish warning
    """
    if not congress_data or ticker not in congress_data:
        return 0.5, "no_data"

    data = congress_data[ticker]
    signal = data.get("signal", "neutral")
    score = data.get("congress_score", 50)

    return score / 100, signal

def get_analyst_score(price):
    """
    Score based on analyst price targets and upgrades/downgrades
    """
    analyst_score = 0.5
    analyst_action = price.get("analyst_action", "neutral")
    analyst_upside = price.get("analyst_upside")
    analyst_rating = price.get("analyst_rating")

    # Base from rating
    if analyst_rating == "buy":
        analyst_score = 0.7
    elif analyst_rating == "sell":
        analyst_score = 0.3
    else:
        analyst_score = 0.5

    # Adjust for upside potential
    if analyst_upside is not None:
        if analyst_upside > 30:
            analyst_score = min(1.0, analyst_score + 0.2)
        elif analyst_upside > 15:
            analyst_score = min(1.0, analyst_score + 0.1)
        elif analyst_upside < -10:
            analyst_score = max(0.0, analyst_score - 0.2)
        elif analyst_upside < 0:
            analyst_score = max(0.0, analyst_score - 0.1)

    # Adjust for recent actions
    if analyst_action == "strong_upgrade":
        analyst_score = min(1.0, analyst_score + 0.15)
    elif analyst_action == "upgrade":
        analyst_score = min(1.0, analyst_score + 0.08)
    elif analyst_action == "downgrade":
        analyst_score = max(0.0, analyst_score - 0.08)
    elif analyst_action == "strong_downgrade":
        analyst_score = max(0.0, analyst_score - 0.15)

    return analyst_score

def get_short_interest_score(price):
    """
    Short interest as a signal
    Very high short + bullish sentiment = squeeze potential (bullish)
    Very high short + bearish momentum = dangerous (bearish)
    Low short interest = cleaner setup
    """
    short_float = price.get("short_float_pct")
    short_signal = price.get("short_signal", "unknown")
    week_change = price.get("week_change_pct", 0)

    if short_float is None:
        return 0.5

    # High short interest with positive momentum = squeeze candidate
    if short_float > 20 and week_change > 5:
        return 0.8  # squeeze potential
    elif short_float > 20 and week_change < -3:
        return 0.25  # heavily shorted and falling = danger
    elif short_float > 10 and week_change > 3:
        return 0.65
    elif short_float > 10:
        return 0.4
    else:
        return 0.55  # low short = clean

def compute_scores(price_data, sentiment_data, stocktwits_data={},
                   insider_data={}, institutional_data={},
                   trends_data={}, options_data={}):
    scores = []

    # Load new signal sources
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

        # --- Price momentum ---
        price_score = normalize(week_change, -max_change, max_change)

        # --- RSI ---
        price_history = price.get("price_history", [])
        rsi = calculate_rsi(price_history)
        rsi_score = 0.5
        if rsi:
            if rsi < 30:
                rsi_score = 0.85
            elif rsi < 45:
                rsi_score = 0.65
            elif rsi < 55:
                rsi_score = 0.5
            elif rsi < 70:
                rsi_score = 0.4
            else:
                rsi_score = 0.2

        # --- 52-week breakout ---
        year_high = price.get("year_high", 0)
        year_low = price.get("year_low", 0)
        latest_close = price.get("latest_close", 0)
        breakout_score = 0.5
        if year_high and year_low and latest_close and year_high != year_low:
            range_pct = (latest_close - year_low) / (year_high - year_low)
            if range_pct > 0.95:
                breakout_score = 0.85
            elif range_pct > 0.8:
                breakout_score = 0.7
            elif range_pct < 0.2:
                breakout_score = 0.3
            else:
                breakout_score = 0.5

        combined_price = (price_score * 0.6 + rsi_score * 0.2 + breakout_score * 0.2)

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

        # --- Fundamentals (includes analyst action boost from yfinance_collector) ---
        fund_raw = price.get("fundamental_score", 50)
        fund_score = fund_raw / 100

        # --- Analyst signal (NEW) ---
        analyst_score = get_analyst_score(price)

        # --- Short interest signal (NEW) ---
        short_score = get_short_interest_score(price)

        # --- Congress signal (NEW) ---
        congress_score_val, congress_signal = get_congress_score(congress_data, ticker)

        # --- Insider signal ---
        insider_score = 0.5
        insider_count = insider.get("count", 0)
        if insider_count > 3:
            insider_score = 0.8
        elif insider_count > 0:
            insider_score = 0.65

        # --- Institutional signal ---
        inst_score = 0.5
        major_count = institutional.get("major_count", 0)
        if major_count >= 3:
            inst_score = 0.85
        elif major_count >= 2:
            inst_score = 0.7
        elif major_count >= 1:
            inst_score = 0.6

        # --- Google Trends signal ---
        trends_score = 0.5
        if trends:
            raw_score = trends.get("score", 50)
            trend_dir = trends.get("trend", "stable")
            trends_score = raw_score / 100
            if trend_dir == "rising":
                trends_score = min(1.0, trends_score + 0.15)
            elif trend_dir == "falling":
                trends_score = max(0.0, trends_score - 0.15)

        # --- Options flow signal ---
        options_score = 0.5
        if options:
            raw = options.get("score", 50)
            options_score = raw / 100
            if options.get("unusual_activity"):
                options_score = min(1.0, options_score + 0.1)

        # --- Composite score ---
        # Weights adjusted to fit new signals (sum = 1.0)
        # Reduced price/sentiment slightly to make room for analyst, short, congress
        composite = (
            combined_price      * 0.20 +   # price momentum + RSI + breakout
            sentiment_score     * 0.18 +   # FinBERT NLP
            buzz_score          * 0.10 +   # Reddit buzz
            st_score            * 0.08 +   # StockTwits
            fund_score          * 0.12 +   # Fundamentals
            analyst_score       * 0.10 +   # Analyst price targets + upgrades (NEW)
            short_score         * 0.05 +   # Short interest (NEW)
            congress_score_val  * 0.05 +   # Congressional trading (NEW)
            insider_score       * 0.04 +   # SEC insider filings
            inst_score          * 0.04 +   # Institutional ownership
            trends_score        * 0.02 +   # Google Trends
            options_score       * 0.02     # Options flow
        ) * 100

        # --- Apply macro multiplier (Fear & Greed + VIX) ---
        composite *= macro_multiplier

        # --- Confluence bonus (12 signals now) ---
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
        if bullish_signals >= 7:
            composite = min(100, composite * 1.10)
        elif bullish_signals >= 5:
            composite = min(100, composite * 1.05)
        elif bullish_signals >= 4:
            composite = min(100, composite * 1.02)

        # --- Penalties ---
        if week_change < -3 and avg_sentiment > 0.5:
            composite *= 0.85
        if mentions == 0 and st_raw == 0 and week_change < 0:
            composite *= 0.90
        # Congress selling heavily = penalty
        if congress_signal in ["bearish", "sell_cluster", "strong_sell_cluster"]:
            composite *= 0.92

        composite = min(100, max(0, composite))
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
            # New signal fields
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
            sector_data[sector] = {
                "sector": sector,
                "tickers": [],
                "avg_change": 0,
                "top_score": 0
            }
        sector_data[sector]["tickers"].append(s)

    for sector, data in sector_data.items():
        tickers = data["tickers"]
        valid_changes = [t["week_change_pct"] for t in tickers if t.get("week_change_pct") is not None]
        data["avg_change"] = round(
            sum(valid_changes) / len(valid_changes), 2
        ) if valid_changes else 0
        data["top_score"] = round(
            max(t["composite_score"] for t in tickers), 1
        )
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

    print(f"Prices: {len(price_data)} | Sentiment: {len(sentiment_data)}")
    print(f"Congress: {len(load_congress_data())} tickers")
    macro = load_macro_context()
    print(f"Fear & Greed: {macro.get('fear_greed', {}).get('value', 'N/A')}")
    print(f"VIX: {macro.get('vix', {}).get('value', 'N/A')}")

    scores = compute_scores(price_data, sentiment_data, stocktwits_data,
                           insider_data=insider_data, institutional_data=inst_data)
    sectors = get_sector_summary(scores)

    print("\nTOP 10 PICKS")
    top = [s for s in scores if not s["is_etf"]][:10]
    for i, t in enumerate(top, 1):
        congress_tag = f" 🏛{t['congress_signal']}" if t['congress_signal'] not in ['neutral','no_data'] else ""
        analyst_tag = f" 📊{t['analyst_upside']:+.0f}%" if t.get('analyst_upside') else ""
        short_tag = f" 🩳{t['short_float_pct']:.0f}%" if t.get('short_float_pct') and t['short_float_pct'] > 10 else ""
        print(f"#{i} {t['ticker']:<6} {t['composite_score']:>5.1f} | "
              f"price:{t['week_change_pct']:>+.1f}% "
              f"signals:{t['bullish_signals']}/12"
              f"{congress_tag}{analyst_tag}{short_tag}")

    os.makedirs("data/processed", exist_ok=True)
    outfile = f"data/processed/scores_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(outfile, "w") as f:
        json.dump({
            "generated_at": datetime.utcnow().isoformat(),
            "scores": scores,
            "sectors": sectors
        }, f, indent=2, default=str)
    print(f"\nSaved to {outfile}")