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

# Reverse map: ticker -> sector
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

def compute_scores(price_data, sentiment_data, stocktwits_data={},
                   insider_data={}, institutional_data={}, fundamental_data={}):
    scores = []

    all_changes = [abs(p["week_change_pct"]) for p in price_data]
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

        # --- Price momentum (25% weight) ---
        week_change = price["week_change_pct"]
        price_score = normalize(week_change, -max_change, max_change)

        # --- RSI calculation ---
        price_history = price.get("price_history", [])
        rsi = calculate_rsi(price_history)
        rsi_score = 0.5  # neutral default
        if rsi:
            if rsi < 30:
                rsi_score = 0.85  # oversold = opportunity
            elif rsi < 45:
                rsi_score = 0.65
            elif rsi < 55:
                rsi_score = 0.5
            elif rsi < 70:
                rsi_score = 0.4
            else:
                rsi_score = 0.2  # overbought = caution

        # --- 52-week breakout ---
        year_high = price.get("year_high", 0)
        year_low = price.get("year_low", 0)
        latest_close = price.get("latest_close", 0)
        breakout_score = 0.5
        if year_high and year_low and latest_close:
            range_pct = (latest_close - year_low) / (year_high - year_low) if year_high != year_low else 0.5
            if range_pct > 0.95:
                breakout_score = 0.85  # near 52w high = breakout
            elif range_pct > 0.8:
                breakout_score = 0.7
            elif range_pct < 0.2:
                breakout_score = 0.3  # near 52w low
            else:
                breakout_score = 0.5

        # Combined price signal
        combined_price = (price_score * 0.6 + rsi_score * 0.2 + breakout_score * 0.2)

        # --- Sentiment (25% weight) ---
        avg_sentiment = sentiment.get("avg_sentiment", 0)
        sentiment_score = normalize(avg_sentiment, -1, 1)

        # --- Social buzz (15% weight) ---
        mentions = sentiment.get("mentions", 0)
        reddit_score = sentiment.get("total_reddit_score", 0)
        mention_score = normalize(mentions, 0, max_mentions)
        reddit_score_norm = normalize(reddit_score, 0, max_reddit)
        buzz_score = (mention_score * 0.5) + (reddit_score_norm * 0.5)

        # --- StockTwits (10% weight) ---
        st_raw = st.get("stocktwits_score", 0)
        st_score = normalize(st_raw, -1, 1)

        # --- Fundamental score (15% weight) ---
        fund_raw = price.get("fundamental_score", 50)
        fund_score = fund_raw / 100

        # --- Insider signal (5% weight) ---
        insider_score = 0.5  # neutral default
        insider_count = insider.get("count", 0)
        if insider_count > 3:
            insider_score = 0.8
        elif insider_count > 0:
            insider_score = 0.65

        # --- Institutional signal (5% weight) ---
        inst_score = 0.5
        major_count = institutional.get("major_count", 0)
        if major_count >= 3:
            inst_score = 0.85
        elif major_count >= 2:
            inst_score = 0.7
        elif major_count >= 1:
            inst_score = 0.6

        # --- Composite score 0-100 ---
        composite = (
            combined_price * 0.25 +
            sentiment_score * 0.25 +
            buzz_score     * 0.15 +
            st_score       * 0.10 +
            fund_score     * 0.15 +
            insider_score  * 0.05 +
            inst_score     * 0.05
        ) * 100

        # --- Confluence bonus ---
        # When multiple signals align, add confidence boost
        bullish_signals = sum([
            1 if week_change > 5 else 0,
            1 if avg_sentiment > 0.1 else 0,
            1 if st_raw > 0.1 else 0,
            1 if mentions > 5 else 0,
            1 if fund_raw > 60 else 0,
            1 if major_count >= 2 else 0,
            1 if insider_count > 0 else 0,
        ])
        if bullish_signals >= 5:
            composite = min(100, composite * 1.08)  # 8% boost for high confluence
        elif bullish_signals >= 4:
            composite = min(100, composite * 1.04)
        
        # Penalize suspicious signals — high sentiment but negative price
        if week_change < -3 and avg_sentiment > 0.5:
            composite *= 0.85  # 15% penalty for sentiment/price mismatch
        
        # Penalize stocks with no social signal at all
        if mentions == 0 and st_raw == 0 and week_change < 0:
            composite *= 0.90

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
            "bullish_signals": bullish_signals,
            "price_score": round(combined_price * 100, 1),
            "sentiment_score": round(sentiment_score * 100, 1),
            "buzz_score": round(buzz_score * 100, 1),
            "st_score": round(st_score * 100, 1),
            "latest_close": price["latest_close"],
            "earnings_date": price.get("earnings_date"),
            "is_etf": ticker in ["SOXX","SMH","XLV","XLF","ICLN","XLK","SPY","QQQ","IBB","ARKB"]
        })

    # Sort by composite score
    sorted_scores = sorted(scores, key=lambda x: x["composite_score"], reverse=True)

    # Apply top-pick filter — penalize negative price movers more aggressively
    for s in sorted_scores:
        if s["week_change_pct"] < -2 and not s["is_etf"]:
            s["composite_score"] = round(s["composite_score"] * 0.80, 1)
            s["top_pick_filtered"] = True

    # Re-sort after penalty
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
        data["avg_change"] = round(
            sum(t["week_change_pct"] for t in tickers) / len(tickers), 2
        )
        data["top_score"] = round(
            max(t["composite_score"] for t in tickers), 1
        )
        data["top_5"] = sorted(tickers, key=lambda x: x["composite_score"], reverse=True)[:5]

    return sorted(sector_data.values(), key=lambda x: x["avg_change"], reverse=True)

if __name__ == "__main__":
    print("Loading data...")
    price_data = load_latest_file("prices_")
    sentiment_data = load_latest_sentiment()

    # Load StockTwits
    st_files = sorted([f for f in os.listdir("data/raw") if f.startswith("stocktwits_")])
    stocktwits_data = {}
    if st_files:
        with open(f"data/raw/{st_files[-1]}") as f:
            st_posts = json.load(f)
        from nlp.sentiment import aggregate_stocktwits_sentiment
        stocktwits_data = aggregate_stocktwits_sentiment(st_posts)
        print(f"StockTwits: {len(stocktwits_data)} tickers with sentiment")

    # Load insider data
    insider_files = sorted([f for f in os.listdir("data/raw") if f.startswith("insider_")])
    insider_data = {}
    if insider_files:
        with open(f"data/raw/{insider_files[-1]}") as f:
            insider_data = json.load(f)
        print(f"Insider: {len(insider_data)} tickers")

    # Load institutional data
    inst_files = sorted([f for f in os.listdir("data/raw") if f.startswith("institutional_")])
    inst_data = {}
    if inst_files:
        with open(f"data/raw/{inst_files[-1]}") as f:
            inst_data = json.load(f)
        print(f"Institutional: {len(inst_data)} tickers")

    print(f"Prices: {len(price_data)} tickers")
    print(f"Sentiment: {len(sentiment_data)} tickers")

    print("\nComputing composite scores...")
    scores = compute_scores(price_data, sentiment_data, stocktwits_data,
                           insider_data=insider_data,
                           institutional_data=inst_data)
    sectors = get_sector_summary(scores)

    print("\n" + "="*60)
    print("SECTOR RANKINGS")
    print("="*60)
    for sector in sectors:
        change = sector["avg_change"]
        emoji = "🟢" if change > 0 else "🔴"
        print(f"\n{emoji} {sector['sector']:<25} avg: {change:+.2f}%")
        for t in sector["top_5"]:
            etf_tag = " [ETF]" if t["is_etf"] else ""
            st_tag = f" ST:{t['stocktwits_score']:+.2f}" if t.get('stocktwits_score') else ""
            print(f"   {t['ticker']:<6} score:{t['composite_score']:>5.1f}  "
                  f"price:{t['week_change_pct']:>+.1f}%  "
                  f"finbert:{t['avg_sentiment']:>+.3f}  "
                  f"reddit:{t['mentions']}{st_tag}{etf_tag}")

    print("\n" + "="*60)
    print("TOP 5 GLOBAL PICKS")
    print("="*60)
    top5 = [s for s in scores if not s["is_etf"]][:5]
    for i, t in enumerate(top5, 1):
        print(f"\n#{i} {t['ticker']}  —  score: {t['composite_score']}/100")
        print(f"   Price: {t['week_change_pct']:+.2f}%  "
              f"FinBERT: {t['avg_sentiment']:+.3f}  "
              f"StockTwits: {t.get('stocktwits_score', 0):+.3f}  "
              f"Reddit: {t['mentions']} mentions")
        print(f"   Fundamental: {t.get('fundamental_score', 50)}  "
              f"RSI: {t.get('rsi', '—')}  "
              f"Insider filings: {t.get('insider_count', 0)}  "
              f"Major institutions: {t.get('major_institutions', 0)}")
        print(f"   Bullish signals: {t.get('bullish_signals', 0)}/7")

    os.makedirs("data/processed", exist_ok=True)
    outfile = f"data/processed/scores_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(outfile, "w") as f:
        json.dump({
            "generated_at": datetime.utcnow().isoformat(),
            "scores": scores,
            "sectors": sectors
        }, f, indent=2, default=str)
    print(f"\nSaved to {outfile}")