# Graph Report - marketintel  (2026-09-20)

## Corpus Check
- Corpus is ~31,215 words - fits in a single context window. You may not need a graph.

## Summary
- 416 nodes · 752 edges · 26 communities (22 shown, 4 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.85)
- Token cost: 121,025 input · 21,359 output

## Community Hubs (Navigation)
- Auth, Routing & Pro Gating
- FastAPI Score & Strategy API
- Frontend Build Toolchain
- Pipeline Automation & Platform Concepts
- Dashboard & Chart Components
- Events, Insider & Institutional Collectors
- Macro, Options & Trends Collectors
- Scheduler & Pipeline Orchestration
- Capitol Trades Congress Scraper
- Composite Scoring Engine
- Brand & Icon Assets
- NLP Sentiment & Ticker Extraction
- yfinance Price & Fundamentals
- Supabase Persistence Layer
- JSON-to-Supabase Migration
- StockTwits Collector
- RSS News Collector
- Podcast Whisper Collector
- Reddit Collector
- Root Node Dependencies
- Vercel Deploy Config
- Hero Visual Identity

## God Nodes (most connected - your core abstractions)
1. `run_pipeline()` - 38 edges
2. `get_strategies()` - 13 edges
3. `useAuth()` - 13 edges
4. `compute_scores()` - 13 edges
5. `load_latest_scores()` - 10 edges
6. `get_congress_trades()` - 10 edges
7. `react` - 10 edges
8. `12-Signal Composite Scoring` - 10 edges
9. `sanitize_floats()` - 9 edges
10. `get_price_data()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `MarketIntel Daily Pipeline (GitHub Actions)` --semantically_similar_to--> `launchd Auto-start Services`  [INFERRED] [semantically similar]
  .github/workflows/pipeline.yml → README.md
- `Supabase Storage Dependency` --semantically_similar_to--> `data/raw, data/processed, data/history layout`  [INFERRED] [semantically similar]
  requirements-pipeline.txt → .github/workflows/pipeline.yml
- `FinBERT Sentiment Signal` --references--> `NLP Stack (transformers, torch, spaCy)`  [INFERRED]
  README.md → requirements-pipeline.txt
- `run_pipeline_task()` --calls--> `run_pipeline()`  [EXTRACTED]
  api/main.py → scheduler.py
- `run_pipeline()` --calls--> `get_congress_trades()`  [EXTRACTED]
  scheduler.py → collectors/congress_collector.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Daily pipeline execution flow (schedule, secrets, entrypoint, deps, storage)** — _github_workflows_pipeline_cron_schedule, _github_workflows_pipeline_run_pipeline_job, readme_scheduler_entrypoint, requirements_pipeline_dependency_set, _github_workflows_pipeline_pipeline_secrets, requirements_pipeline_supabase_storage [INFERRED 0.85]
- **Signals composing the weighted composite score** — readme_finbert_sentiment, readme_stocktwits_sentiment, readme_reddit_social_buzz, readme_congressional_trading_tracker, readme_sec_edgar_integration, readme_macro_multiplier, readme_composite_scoring [EXTRACTED 1.00]
- **Local launchd service topology (pipeline, API, frontend)** — readme_launchd_automation, readme_scheduler_entrypoint, readme_fastapi_backend, readme_vite_frontend [EXTRACTED 1.00]
- **Hero Brand Visual Language (motif + accent + layering rationale)** — frontend_src_assets_hero_image, frontend_src_assets_hero_layered_stack_motif, frontend_src_assets_hero_purple_gradient_brand_accent, frontend_src_assets_hero_wireframe_to_solid_contrast [INFERRED 0.85]
- **Social/Community Link Icon Set** — frontend_public_icons_bluesky_icon, frontend_public_icons_discord_icon, frontend_public_icons_github_icon, frontend_public_icons_x_icon, frontend_public_icons_social_icon [INFERRED 0.85]
- **Vite React Starter Template Leftovers** — frontend_src_assets_react, frontend_src_assets_vite, frontend_public_favicon [INFERRED 0.75]

## Communities (26 total, 4 thin omitted)

### Community 0 - "Auth, Routing & Pro Gating"
Cohesion: 0.07
Nodes (37): App(), styles, C, ProGate(), C, ProtectedRoute(), C, UserMenu() (+29 more)

### Community 1 - "FastAPI Score & Strategy API"
Cohesion: 0.08
Nodes (46): add_to_watchlist(), build_sector_summary(), debug(), enrich_ticker(), generate_reasoning(), get_all_history(), get_all_scores(), get_congress() (+38 more)

### Community 2 - "Frontend Build Toolchain"
Cohesion: 0.06
Nodes (35): dependencies, axios, react, react-dom, react-router-dom, @supabase/supabase-js, devDependencies, eslint (+27 more)

### Community 3 - "Pipeline Automation & Platform Concepts"
Cohesion: 0.07
Nodes (32): Daily 10:00 UTC Cron Schedule, data/raw, data/processed, data/history layout, MarketIntel Daily Pipeline (GitHub Actions), Pipeline Runtime Secrets (Supabase + Reddit), Playwright Chromium + Stealth Setup, run-pipeline job, Whisper + ffmpeg Transcription Setup, Frontend index.html Root Mount (+24 more)

### Community 4 - "Dashboard & Chart Components"
Cohesion: 0.10
Nodes (18): CongressTab(), C, changeColor(), Dashboard(), FILTERS, fmt(), fmtCap(), HeatCell() (+10 more)

### Community 5 - "Events, Insider & Institutional Collectors"
Cohesion: 0.11
Nodes (17): get_earnings_events(), get_economic_events(), get_fed_meetings(), get_upcoming_events(), Key economic data release dates for 2026 CPI, Jobs Report, GDP — biggest market…, Get upcoming earnings from our existing price data, Federal Reserve meeting dates — published publicly Hardcoded for 2026 since Fed…, Combine all events and return next N days (+9 more)

### Community 6 - "Macro, Options & Trends Collectors"
Cohesion: 0.15
Nodes (16): save_fear_greed(), collect_options_flow(), get_options_signal(), Analyze options flow for unusual activity High call/put ratio = bullish…, save_options(), save_trends(), save_vix(), datetime (+8 more)

### Community 7 - "Scheduler & Pipeline Orchestration"
Cohesion: 0.17
Nodes (19): apscheduler_schedulers_blocking, Save both raw trades and aggregated ticker data. result = {"trades": [...],…, save_congress_data(), save_events(), get_fear_greed(), Fetch CNN Fear & Greed Index 0-25 = Extreme Fear (historically strong buy…, get_trends_signal(), Get Google Trends search interest for tickers Rising search interest often… (+11 more)

### Community 8 - "Capitol Trades Congress Scraper"
Cohesion: 0.15
Nodes (17): aggregate_by_ticker(), get_congress_trades(), _parse_date(), _parse_issuer_cell(), _parse_politician_cell(), _parse_size(), _parse_tx_type(), Congress Collector - Capitol Trades Scraper Scrapes congressional stock trades… (+9 more)

### Community 9 - "Composite Scoring Engine"
Cohesion: 0.22
Nodes (13): calculate_rsi(), compute_scores(), get_analyst_score(), get_congress_score(), get_historical_price_score(), get_macro_multiplier(), get_short_interest_score(), get_volatility_tag() (+5 more)

### Community 10 - "Brand & Icon Assets"
Cohesion: 0.19
Nodes (15): Favicon (Vite-style Bolt Mark), Icon Sprite Sheet, Bluesky Icon Symbol, Discord Icon Symbol, Documentation Icon Symbol, GitHub Icon Symbol, Social Icon Symbol, SVG Sprite Symbol Reuse Pattern (+7 more)

### Community 11 - "NLP Sentiment & Ticker Extraction"
Cohesion: 0.22
Nodes (11): collections, aggregate_by_ticker(), aggregate_stocktwits_sentiment(), analyze_posts(), analyze_sentiment(), score_to_number(), extract_tickers_from_posts(), extract_tickers_from_text() (+3 more)

### Community 12 - "yfinance Price & Fundamentals"
Cohesion: 0.24
Nodes (11): build_dynamic_watchlist(), calculate_historical_metrics(), fetch_ticker_data(), get_analyst_data(), get_earnings_alert(), get_price_data(), get_short_interest_data(), get_sp500_movers() (+3 more)

### Community 13 - "Supabase Persistence Layer"
Cohesion: 0.29
Nodes (12): clean(), clean_dict(), get_client(), db.py — Supabase persistence layer for MarketIntel Called at the end of each…, Save congressional trading data to Supabase. Accepts EITHER: - Old format: dict…, Save everything to Supabase in one call. Called at the end of run_pipeline().…, Replace nan/inf/None-like floats with None, save_all() (+4 more)

### Community 14 - "JSON-to-Supabase Migration"
Cohesion: 0.24
Nodes (8): clean(), clean_dict(), extract_date_from_filename(), migrate_price_data(), migrate_scores(), migrate_to_supabase.py Reads all existing JSON files and pushes data into…, Replace nan/inf with None for Supabase, Extract date from scores_20260627_1935.json

### Community 15 - "StockTwits Collector"
Cohesion: 0.38
Nodes (6): collect_stocktwits(), extract_sentiment(), get_stocktwits_messages(), get_trending_tickers(), save_stocktwits(), time

### Community 16 - "RSS News Collector"
Cohesion: 0.40
Nodes (5): bs4, clean_html(), collect_rss(), save_articles(), feedparser

### Community 17 - "Podcast Whisper Collector"
Cohesion: 0.47
Nodes (5): collect_podcasts(), download_episode(), save_transcripts(), transcribe_episode(), whisper

### Community 18 - "Reddit Collector"
Cohesion: 0.40
Nodes (5): collect_posts(), get_reddit_client(), save_posts(), dotenv, praw

### Community 19 - "Root Node Dependencies"
Cohesion: 0.33
Nodes (5): dependencies, axios, recharts, axios, recharts

### Community 20 - "Vercel Deploy Config"
Cohesion: 0.33
Nodes (5): buildCommand, framework, installCommand, outputDirectory, rewrites

### Community 21 - "Hero Visual Identity"
Cohesion: 0.60
Nodes (5): Hero Illustration (Isometric Stacked Layers), Landing Page Hero Slot Asset, Layered Stack Visual Motif, Purple Gradient Brand Accent, Wireframe-to-Solid Contrast (Raw Data to Rendered Insight)

## Ambiguous Edges - Review These
- `Layered Stack Visual Motif` → `Purple Gradient Brand Accent`  [AMBIGUOUS]
  frontend/src/assets/hero.png · relation: semantically_similar_to
- `Favicon (Vite-style Bolt Mark)` → `MarketIntel Logo (M Monogram)`  [AMBIGUOUS]
  frontend/public/favicon.svg · relation: conceptually_related_to

## Knowledge Gaps
- **62 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+57 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 151 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Layered Stack Visual Motif` and `Purple Gradient Brand Accent`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Favicon (Vite-style Bolt Mark)` and `MarketIntel Logo (M Monogram)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `run_pipeline()` connect `Scheduler & Pipeline Orchestration` to `FastAPI Score & Strategy API`, `Events, Insider & Institutional Collectors`, `Macro, Options & Trends Collectors`, `Capitol Trades Congress Scraper`, `Composite Scoring Engine`, `NLP Sentiment & Ticker Extraction`, `yfinance Price & Fundamentals`, `StockTwits Collector`, `RSS News Collector`, `Podcast Whisper Collector`, `Reddit Collector`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `react` connect `Auth, Routing & Pro Gating` to `Frontend Build Toolchain`, `Dashboard & Chart Components`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _62 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth, Routing & Pro Gating` be split into smaller, more focused modules?**
  _Cohesion score 0.07329462989840348 - nodes in this community are weakly interconnected._
- **Should `FastAPI Score & Strategy API` be split into smaller, more focused modules?**
  _Cohesion score 0.0792156862745098 - nodes in this community are weakly interconnected._