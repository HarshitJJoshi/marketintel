import re
import json
import os

# Comprehensive ticker list to match against
KNOWN_TICKERS = {
    "AAPL", "MSFT", "NVDA", "AMD", "GOOGL", "GOOG", "AMZN", "META", "TSLA",
    "JPM", "BAC", "GS", "V", "MA", "WFC", "C",
    "LLY", "JNJ", "UNH", "MRNA", "PFE", "ABBV",
    "ENPH", "NEE", "FSLR", "PLUG", "BE",
    "PLTR", "CRWD", "PANW", "SNOW", "NET", "ZS",
    "SOXX", "SMH", "XLV", "XLF", "ICLN", "XLK", "SPY", "QQQ",
    "NFLX", "DIS", "UBER", "LYFT", "ABNB", "SHOP",
    "XOM", "CVX", "COP", "SLB",
    "NKE", "SBUX", "MCD", "TGT", "WMT", "COST",
    "BA", "CAT", "DE", "GE",
    "BTC", "ETH"
}

# Words that look like tickers but aren't
FALSE_POSITIVES = {
    "A", "I", "IT", "BE", "GO", "AT", "BY", "IS", "OR", "SO", "DO",
    "CEO", "CFO", "IPO", "ETF", "GDP", "CPI", "FED", "SEC", "ALL",
    "NEW", "NOW", "BUY", "FOR", "ARE", "NOT", "BUT", "AND", "THE",
    "CAN", "GET", "HAS", "HAD", "ITS", "WHO", "ANY", "TOP", "HOW",
    "PUT", "SET", "LOW", "HIGH", "OIL", "USA", "GDP", "IMF", "AI"
}

def extract_tickers_from_text(text):
    if not text:
        return []

    found = set()

    # Match known tickers explicitly
    words = re.findall(r'\b[A-Z]{1,5}\b', text.upper())
    for word in words:
        if word in KNOWN_TICKERS and word not in FALSE_POSITIVES:
            found.add(word)

    # Also match $TICKER format (common on Reddit/StockTwits)
    dollar_tickers = re.findall(r'\$([A-Z]{1,5})\b', text.upper())
    for ticker in dollar_tickers:
        if ticker not in FALSE_POSITIVES:
            found.add(ticker)

    return list(found)

def extract_tickers_from_posts(posts):
    results = []
    for post in posts:
        text = f"{post.get('title', '')} {post.get('text', '')} {post.get('summary', '')}"
        tickers = extract_tickers_from_text(text)
        if tickers:
            results.append({
                **post,
                "tickers": tickers
            })
    return results

if __name__ == "__main__":
    # Test on latest reddit data
    raw_files = sorted([
        f for f in os.listdir("data/raw") if f.startswith("reddit_")
    ])
    if not raw_files:
        print("No Reddit data found. Run reddit_collector.py first.")
        exit()

    latest = f"data/raw/{raw_files[-1]}"
    print(f"Processing {latest}...")

    with open(latest) as f:
        posts = json.load(f)

    tagged = extract_tickers_from_posts(posts)

    # Show ticker mention counts
    from collections import Counter
    all_tickers = []
    for post in tagged:
        all_tickers.extend(post["tickers"])

    counts = Counter(all_tickers).most_common(20)
    print(f"\nTop 20 most mentioned tickers across {len(tagged)} posts:\n")
    for ticker, count in counts:
        bar = "█" * count
        print(f"  {ticker:<6} {count:>3}x  {bar}")