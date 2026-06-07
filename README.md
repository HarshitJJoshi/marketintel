# MarketIntel

AI-powered market intelligence platform combining 7 independent signals into composite stock scores for 80+ tickers daily. Built entirely on free data sources, runs locally on your machine.

## Features
- **3 dashboards** — Market overview, History tracking, Portfolio strategies
- **7-signal scoring** — Price + RSI + breakout, FinBERT NLP, Reddit buzz, StockTwits sentiment, Fundamentals, Insider filings, Institutional ownership
- **Dynamic ticker discovery** — NLP extracts tickers from Reddit, RSS and podcast transcripts automatically
- **Podcast transcription** — Barron's Streetwise + Motley Fool Money via Whisper AI
- **SEC EDGAR integration** — Insider Form 4 filings + institutional 13F data
- **Daily automation** — Runs at 7am via launchd, no manual trigger needed

## Starting the app

Open 2 terminal tabs:

**Tab 1 — API:**
```bash
cd ~/harshitjoshi/marketintel
source venv/bin/activate
uvicorn api.main:app --reload --port 8000
```

**Tab 2 — Dashboard:**
```bash
cd ~/harshitjoshi/marketintel/frontend
npm run dev
```

Open `http://localhost:5173`

## Running the pipeline manually
```bash
cd ~/harshitjoshi/marketintel
source venv/bin/activate
python scheduler.py --now
```

## Data sources
- **Reddit** (PRAW) — r/wallstreetbets, r/stocks, r/investing, r/SecurityAnalysis
- **RSS** — Motley Fool, Seeking Alpha, Yahoo Finance, MarketWatch, InvestorPlace, FT
- **Podcasts** — Barron's Streetwise, Motley Fool Money (Whisper transcription)
- **StockTwits** — pre-labeled bullish/bearish sentiment + trending tickers
- **yfinance** — prices, fundamentals, earnings dates, RSI
- **SEC EDGAR** — Form 4 insider transactions, institutional 13F ownership
- **S&P 500 movers** — dynamic watchlist updated every run

## Signal weights
| Signal | Weight |
|--------|--------|
| Price momentum + RSI + 52w breakout | 25% |
| FinBERT sentiment (NLP) | 25% |
| Social buzz (Reddit) | 15% |
| StockTwits labeled sentiment | 10% |
| Fundamentals (revenue, margins, D/E) | 15% |
| Insider transactions (Form 4) | 5% |
| Institutional ownership (13F) | 5% |

## Stack
- **Backend** — Python, FastAPI, FinBERT, Whisper, PRAW, yfinance
- **Frontend** — React, Vite
- **Automation** — APScheduler, macOS launchd
- **NLP** — HuggingFace FinBERT, spaCy, OpenAI Whisper