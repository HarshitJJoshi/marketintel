# MarketIntel

AI-powered market intelligence dashboard combining Reddit, RSS, podcasts, StockTwits, and price data.

## Starting the app

Open 2 terminal tabs:

**Tab 1 — API:**
cd ~/harshitjoshi/marketintel
source venv/bin/activate
uvicorn api.main:app --reload --port 8000

**Tab 2 — Dashboard:**
cd ~/harshitjoshi/marketintel/frontend
npm run dev

Open http://localhost:5173

## Running the pipeline manually
cd ~/harshitjoshi/marketintel
source venv/bin/activate
python scheduler.py --now

## Auto-run daily at 7am
python scheduler.py

## Data sources
- Reddit (PRAW) — r/wallstreetbets, r/stocks, r/investing
- RSS — Motley Fool, Seeking Alpha, Yahoo Finance, MarketWatch, InvestorPlace, FT
- Podcasts — Barron's Streetwise, Motley Fool Money (Whisper transcription)
- StockTwits — pre-labeled bullish/bearish sentiment
- yfinance — prices, fundamentals, earnings dates
- S&P 500 movers — dynamic watchlist

## Signal weights
- Price momentum: 35%
- FinBERT sentiment: 25%
- Social buzz (Reddit): 20%
- StockTwits sentiment: 20%
