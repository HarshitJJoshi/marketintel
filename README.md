# MarketIntel

AI-powered market intelligence platform combining 9 independent signals into composite stock scores for 70+ tickers daily. Built entirely on free data sources, runs locally on your machine, auto-starts on boot.

## Features
- **3 dashboards** — Market overview, History tracking, Portfolio strategies
- **9-signal scoring** — Price + RSI + breakout, FinBERT NLP, Reddit buzz, StockTwits, Fundamentals, Insider filings, Institutional ownership, Google Trends, Options flow
- **Dynamic ticker discovery** — NLP extracts tickers from Reddit, RSS and podcast transcripts automatically
- **Podcast transcription** — Barron's Streetwise + Motley Fool Money via Whisper AI
- **SEC EDGAR integration** — Insider Form 4 filings + institutional 13F data
- **Market events sidebar** — Fed meetings, CPI, GDP, earnings calendar
- **History tab** — Search any ticker, compare mode, watchlist to track custom tickers
- **Strategies tab** — 3 risk profiles (aggressive/balanced/conservative) for any dollar amount
- **Full automation** — Pipeline runs at 7am, API and frontend auto-start on boot

## Starting the app

Everything starts automatically on boot via launchd. Just open your browser: 

http://localhost:5173

If you need to restart manually:

```bash
launchctl stop com.marketintel.api && launchctl start com.marketintel.api
launchctl stop com.marketintel.frontend && launchctl start com.marketintel.frontend
```

## Running the pipeline manually

```bash
cd ~/harshitjoshi/marketintel
source venv/bin/activate
python scheduler.py --now
```

## Auto-start services

Three launchd services run automatically:

| Service | Schedule | Purpose |
|---------|----------|---------|
| com.marketintel.pipeline | 7:00 AM daily | Runs full data pipeline |
| com.marketintel.api | On boot | FastAPI backend on port 8000 |
| com.marketintel.frontend | On boot | Vite frontend on port 5173 |

## Data sources
- **Reddit** (PRAW) — r/wallstreetbets, r/stocks, r/investing, r/SecurityAnalysis
- **RSS** — Motley Fool, Seeking Alpha, Yahoo Finance, MarketWatch, InvestorPlace, FT
- **Podcasts** — Barron's Streetwise, Motley Fool Money (Whisper transcription)
- **StockTwits** — pre-labeled bullish/bearish sentiment + trending tickers
- **yfinance** — prices, fundamentals, earnings dates, RSI
- **SEC EDGAR** — Form 4 insider transactions, institutional 13F ownership
- **Google Trends** — search interest momentum via pytrends
- **Options flow** — put/call ratio + unusual activity via yfinance

## Signal weights

| Signal | Weight |
|--------|--------|
| Price momentum + RSI + 52w breakout | 23% |
| FinBERT sentiment (NLP) | 23% |
| Social buzz (Reddit) | 14% |
| StockTwits labeled sentiment | 10% |
| Fundamentals (revenue, margins, D/E) | 14% |
| Insider transactions (Form 4) | 5% |
| Institutional ownership (13F) | 5% |
| Google Trends search interest | 3% |
| Options flow (P/C ratio) | 3% |

## Stack
- **Backend** — Python, FastAPI, FinBERT, Whisper, PRAW, yfinance
- **Frontend** — React, Vite
- **Automation** — APScheduler, macOS launchd
- **NLP** — HuggingFace FinBERT, spaCy, OpenAI Whisper