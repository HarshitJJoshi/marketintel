# MarketIntel

AI-powered market intelligence platform combining 12 independent signals into composite stock scores for 90+ tickers daily. Built entirely on free data sources, runs locally on your machine, auto-starts on boot.

## Features
- **Dark-mode dashboard** — Market overview, History tracking, Portfolio strategies
- **12-signal scoring** — Price + RSI + breakout, FinBERT NLP, Reddit buzz, StockTwits, Fundamentals, Analyst targets, Short interest, Congress trades, Insider filings, Institutional ownership, Google Trends, Options flow
- **Signal filter system** — Filter tickers by congress buys, analyst upgrades, unusual volume, high short interest, oversold RSI, and more — multi-select with AND logic
- **Congressional trading tracker** — Scrapes Capitol Trades daily, detects buy/sell clusters from senators and representatives
- **Analyst intelligence** — Price targets, upside %, recent upgrades/downgrades from Wall Street
- **Short interest signals** — Float %, days to cover, squeeze potential detection
- **Macro context bar** — CNN Fear & Greed Index + VIX shown at all times
- **Dynamic ticker discovery** — NLP extracts tickers from Reddit, RSS and podcast transcripts automatically
- **Podcast transcription** — Barron's Streetwise + Motley Fool Money via Whisper AI
- **SEC EDGAR integration** — Insider Form 4 filings + institutional 13F data
- **Market events sidebar** — Fed meetings, CPI, GDP, earnings calendar
- **History tab** — Search any ticker, compare mode, watchlist to track custom tickers
- **Strategies tab** — 3 risk profiles (aggressive/balanced/conservative) for any dollar amount
- **Full automation** — Pipeline runs at 6am, API and frontend auto-start on boot

## Starting the app

Everything starts automatically on boot via launchd. Just open your browser:

```
http://localhost:5173
```

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
| com.marketintel.pipeline | 6:00 AM daily | Runs full data pipeline |
| com.marketintel.api | On boot | FastAPI backend on port 8000 |
| com.marketintel.frontend | On boot | Vite frontend on port 5173 |

## Data sources
- **Reddit** (PRAW) — r/wallstreetbets, r/stocks, r/investing, r/SecurityAnalysis
- **RSS** — Motley Fool, Seeking Alpha, Yahoo Finance, MarketWatch, InvestorPlace, FT
- **Podcasts** — Barron's Streetwise, Motley Fool Money (Whisper transcription)
- **StockTwits** — pre-labeled bullish/bearish sentiment + trending tickers
- **yfinance** — prices, fundamentals, analyst targets, short interest, earnings dates, RSI
- **SEC EDGAR** — Form 4 insider transactions, institutional 13F ownership
- **Capitol Trades** — Congressional stock trades (House + Senate, STOCK Act disclosures)
- **CNN Fear & Greed Index** — daily macro sentiment (0–100)
- **VIX** — CBOE Volatility Index via yfinance
- **Google Trends** — search interest momentum via pytrends
- **Options flow** — put/call ratio + unusual activity via yfinance

## Signal weights

| Signal | Weight | Source |
|--------|--------|--------|
| Price momentum + RSI + 52w breakout | 20% | yfinance |
| FinBERT sentiment (NLP) | 18% | Reddit + RSS + Podcasts |
| Social buzz (Reddit mentions + score) | 10% | PRAW |
| StockTwits labeled sentiment | 8% | StockTwits API |
| Fundamentals (revenue, margins, D/E) | 12% | yfinance |
| Analyst price targets + upgrades | 10% | yfinance |
| Short interest (float %, days to cover) | 5% | yfinance |
| Congressional trading signal | 5% | Capitol Trades |
| Insider transactions (Form 4) | 4% | SEC EDGAR |
| Institutional ownership (13F) | 4% | yfinance |
| Google Trends search interest | 2% | pytrends |
| Options flow (P/C ratio) | 2% | yfinance |

**Macro multiplier** — Fear & Greed + VIX adjust all scores ±5–15% based on market conditions.

## Stack
- **Backend** — Python, FastAPI, FinBERT, Whisper, PRAW, yfinance, Playwright
- **Frontend** — React, Vite (dark mode)
- **Automation** — APScheduler, macOS launchd
- **NLP** — HuggingFace FinBERT, spaCy, OpenAI Whisper
- **Scraping** — Playwright (congressional trades), BeautifulSoup, requests