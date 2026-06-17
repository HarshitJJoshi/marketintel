import os
import sys
import json
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler

def log(msg):
    timestamp = datetime.utcnow().strftime("%H:%M:%S")
    print(f"[{timestamp}] {msg}")

def cleanup_old_files():
    raw_dir = "data/raw"
    proc_dir = "data/processed"

    for prefix in ["reddit_", "rss_", "prices_", "stocktwits_", "podcasts_", "insider_", "institutional_"]:
        files = sorted([
            f for f in os.listdir(raw_dir)
            if f.startswith(prefix) and f.endswith(".json")
        ])
        if len(files) > 1:
            for old_file in files[:-1]:
                os.remove(f"{raw_dir}/{old_file}")
            log(f"Cleaned {len(files)-1} old {prefix[:-1]} files")

    for prefix in ["sentiment_", "scores_"]:
        files = sorted([
            f for f in os.listdir(proc_dir)
            if f.startswith(prefix) and f.endswith(".json")
        ])
        if len(files) > 1:
            for old_file in files[:-1]:
                os.remove(f"{proc_dir}/{old_file}")
            log(f"Cleaned {len(files)-1} old {prefix[:-1]} files")

def run_pipeline():
    log("Starting MarketIntel daily pipeline...")
    print("=" * 55)

    cleanup_old_files()

    # Step 1 — Reddit
    log("Step 1: Collecting Reddit posts...")
    from collectors.reddit_collector import collect_posts, save_posts
    posts = collect_posts(limit=100)
    save_posts(posts)
    log(f"Reddit: {len(posts)} posts collected")

    # Step 2 — RSS
    log("Step 2: Collecting RSS articles...")
    from collectors.rss_collector import collect_rss, save_articles
    articles = collect_rss()
    save_articles(articles)
    log(f"RSS: {len(articles)} articles collected")

    # Step 2b — Podcasts
    log("Step 2b: Collecting podcast transcripts...")
    try:
        from collectors.podcast_collector import collect_podcasts, save_transcripts
        transcripts = collect_podcasts()
        if transcripts:
            save_transcripts(transcripts)
            log(f"Podcasts: {len(transcripts)} episodes transcribed")
        else:
            log("Podcasts: no new episodes (cached or unavailable)")
    except Exception as e:
        log(f"Podcasts: skipped — {e}")

    # Step 3 — Build dynamic watchlist from NLP
    log("Step 3: Building dynamic watchlist from NLP...")
    from nlp.ticker_extractor import extract_tickers_from_posts
    from collectors.yfinance_collector import build_dynamic_watchlist, get_price_data, save_price_data

    all_text_posts = posts + articles
    tagged_for_watchlist = extract_tickers_from_posts(all_text_posts)

    nlp_tickers = set()
    for post in tagged_for_watchlist:
        for t in post.get("tickers", []):
            nlp_tickers.add(t)

    log(f"NLP found {len(nlp_tickers)} unique tickers in text")
    dynamic_watchlist = build_dynamic_watchlist(nlp_tickers=list(nlp_tickers))

    # Step 3b — StockTwits
    log("Step 3b: Collecting StockTwits sentiment...")
    try:
        from collectors.stocktwits_collector import collect_stocktwits, save_stocktwits, get_trending_tickers
        trending = get_trending_tickers()
        st_tickers = list(nlp_tickers | set(trending))[:40]
        st_messages = collect_stocktwits(st_tickers)
        if st_messages:
            save_stocktwits(st_messages)
            log(f"StockTwits: {len(st_messages)} messages across {len(st_tickers)} tickers")
    except Exception as e:
        log(f"StockTwits: skipped — {e}")

    # Step 3c — Google Trends
    log("Step 3c: Fetching Google Trends signals...")
    try:
        from collectors.trends_collector import get_trends_signal, save_trends
        stock_tickers = [t for t in dynamic_watchlist if t not in
                        ["SOXX","SMH","XLV","XLF","ICLN","XLK","SPY","QQQ","IBB","ARKB"]][:20]
        trends_data = get_trends_signal(stock_tickers)
        save_trends(trends_data)
        rising = sum(1 for v in trends_data.values() if v.get("trend") == "rising")
        log(f"Trends: {rising} tickers with rising search interest")
    except Exception as e:
        log(f"Trends: skipped — {e}")
        trends_data = {}

    # Step 3d — Options flow
    log("Step 3d: Fetching options flow...")
    try:
        from collectors.options_collector import collect_options_flow, save_options
        stock_tickers = [t for t in dynamic_watchlist if t not in
                        ["SOXX","SMH","XLV","XLF","ICLN","XLK","SPY","QQQ","IBB","ARKB"]][:20]
        options_data = collect_options_flow(stock_tickers)
        save_options(options_data)
        unusual = sum(1 for v in options_data.values() if v.get("unusual_activity"))
        log(f"Options: {unusual} tickers with unusual activity")
    except Exception as e:
        log(f"Options: skipped — {e}")
        options_data = {}

    # Step 3e — Market events
    log("Step 3e: Updating market events calendar...")
    try:
        from collectors.events_collector import get_upcoming_events, save_events
        events = get_upcoming_events(days_ahead=14)
        save_events(events)
        log(f"Events: {len(events)} upcoming events saved")
    except Exception as e:
        log(f"Events: skipped — {e}")

    # Step 4 — Prices with dynamic watchlist
    log("Step 4: Fetching prices for dynamic watchlist...")
    prices = get_price_data(dynamic_watchlist)
    save_price_data(prices)
    log(f"Prices: {len(prices)} tickers fetched")

    earnings_soon = [p for p in prices if p.get("earnings_date")]
    if earnings_soon:
        log(f"Earnings alerts: {', '.join(p['ticker'] + ' ' + p['earnings_date'] for p in earnings_soon)}")

    # Step 5 — Sentiment + Scoring
    log("Step 5: Running sentiment analysis and scoring...")
    from nlp.sentiment import analyze_posts, aggregate_by_ticker, aggregate_stocktwits_sentiment
    from scoring.engine import compute_scores, get_sector_summary

    all_posts = []
    for filename in os.listdir("data/raw"):
        if filename.endswith(".json"):
            filepath = f"data/raw/{filename}"
            try:
                with open(filepath) as f:
                    data = json.load(f)
                    # Only extend if it's a list of dicts (posts/articles)
                    # Skip insider/institutional which are dicts of dicts
                    if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                        all_posts.extend(data)
                    elif isinstance(data, list) and len(data) == 0:
                        pass  # empty list, skip
            except Exception as e:
                print(f"  Skipping {filename}: {e}")

    all_tagged = extract_tickers_from_posts(all_posts)
    analyzed = analyze_posts(all_tagged)
    sentiment = aggregate_by_ticker(analyzed)

    stocktwits_data = aggregate_stocktwits_sentiment(all_posts)
    log(f"StockTwits sentiment: {len(stocktwits_data)} tickers")

    os.makedirs("data/processed", exist_ok=True)
    sentiment_file = f"data/processed/sentiment_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(sentiment_file, "w") as f:
        json.dump(sentiment, f, indent=2)

# Load insider and institutional data
    insider_data = {}
    inst_data = {}
    insider_files = sorted([f for f in os.listdir("data/raw") if f.startswith("insider_")])
    if insider_files:
        with open(f"data/raw/{insider_files[-1]}") as f:
            insider_data = json.load(f)
    inst_files = sorted([f for f in os.listdir("data/raw") if f.startswith("institutional_")])
    if inst_files:
        with open(f"data/raw/{inst_files[-1]}") as f:
            inst_data = json.load(f)

    scores = compute_scores(prices, sentiment, stocktwits_data,
                           insider_data=insider_data,
                           institutional_data=inst_data)
    sectors = get_sector_summary(scores)

    scores_file = f"data/processed/scores_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(scores_file, "w") as f:
        json.dump({
            "generated_at": datetime.utcnow().isoformat(),
            "scores": scores,
            "sectors": sectors,
            "earnings_alerts": earnings_soon
        }, f, indent=2, default=str)

    print("=" * 55)
    log("Pipeline complete!")
    log(f"Top pick: {scores[0]['ticker']} — score {scores[0]['composite_score']}/100")
    log(f"Top sector: {sectors[0]['sector']} — {sectors[0]['avg_change']:+.2f}%")
    print("=" * 55)

    # Save daily history snapshot
    log("Saving history snapshot...")
    try:
        from scoring.history import save_daily_snapshot
        save_daily_snapshot(scores, sentiment)
        log("History snapshot saved")
    except Exception as e:
        log(f"History snapshot failed: {e}")

    return scores, sectors

    # Save daily history snapshot
    from scoring.history import save_daily_snapshot
    save_daily_snapshot(scores, sentiment)
    log("History snapshot saved")

def start_scheduler():
    scheduler = BlockingScheduler()
    scheduler.add_job(run_pipeline, 'cron', hour=7, minute=0)
    log("Scheduler started — pipeline runs daily at 7:00 AM")
    log("Press Ctrl+C to stop")
    try:
        scheduler.start()
    except KeyboardInterrupt:
        log("Scheduler stopped")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--now":
        run_pipeline()
    else:
        start_scheduler()