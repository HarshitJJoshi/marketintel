from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import json
import os
from collections import defaultdict
from datetime import datetime

MODEL_NAME = "ProsusAI/finbert"

print("Loading FinBERT model (first run downloads ~500MB)...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
model.eval()
print("Model ready.")

LABELS = ["positive", "negative", "neutral"]

def analyze_sentiment(text):
    if not text or len(text.strip()) < 10:
        return {"label": "neutral", "score": 0.0}

    inputs = tokenizer(
        text[:512],
        return_tensors="pt",
        truncation=True,
        max_length=512
    )

    with torch.no_grad():
        outputs = model(**inputs)

    probs = torch.softmax(outputs.logits, dim=1)[0]
    label_idx = torch.argmax(probs).item()

    return {
        "label": LABELS[label_idx],
        "score": round(float(probs[label_idx]), 4),
        "positive": round(float(probs[0]), 4),
        "negative": round(float(probs[1]), 4),
        "neutral": round(float(probs[2]), 4)
    }

def score_to_number(sentiment):
    if sentiment["label"] == "positive":
        return sentiment["score"]
    elif sentiment["label"] == "negative":
        return -sentiment["score"]
    return 0.0

def analyze_posts(posts):
    results = []
    total = len(posts)

    for i, post in enumerate(posts):
        if i % 10 == 0:
            print(f"  Analyzing {i}/{total}...")

        text = f"{post.get('title', '')} {post.get('text', '')} {post.get('summary', '')}"
        text = text[:600]

        sentiment = analyze_sentiment(text)
        numeric_score = score_to_number(sentiment)

        results.append({
            **post,
            "sentiment": sentiment,
            "sentiment_score": numeric_score
        })

    return results

def aggregate_by_ticker(analyzed_posts):
    ticker_data = defaultdict(lambda: {
        "mentions": 0,
        "sentiment_scores": [],
        "positive": 0,
        "negative": 0,
        "neutral": 0,
        "total_reddit_score": 0,
        "sources": set()
    })

    for post in analyzed_posts:
        # StockTwits has its own signal — skip to avoid inflating mention counts
        if post.get("source") == "stocktwits":
            continue

        tickers = post.get("tickers", [])
        if not tickers:
            continue

        for ticker in tickers:
            d = ticker_data[ticker]
            d["mentions"] += 1
            d["sentiment_scores"].append(post["sentiment_score"])
            d["total_reddit_score"] += post.get("score", 0)
            d["sources"].add(post.get("source", "unknown"))

            label = post["sentiment"]["label"]
            d[label] += 1

    summary = {}
    for ticker, d in ticker_data.items():
        scores = d["sentiment_scores"]
        avg_sentiment = round(sum(scores) / len(scores), 4) if scores else 0
        summary[ticker] = {
            "ticker": ticker,
            "mentions": d["mentions"],
            "avg_sentiment": avg_sentiment,
            "positive": d["positive"],
            "negative": d["negative"],
            "neutral": d["neutral"],
            "total_reddit_score": d["total_reddit_score"],
            "sources": list(d["sources"])
        }

    return summary

def aggregate_stocktwits_sentiment(posts):
    ticker_data = defaultdict(lambda: {"bullish": 0, "bearish": 0, "neutral": 0, "total": 0})

    for post in posts:
        if post.get("source") != "stocktwits":
            continue
        tickers = post.get("tickers", [])
        st_sentiment = post.get("stocktwits_sentiment")
        for ticker in tickers:
            ticker_data[ticker]["total"] += 1
            if st_sentiment == "Bullish":
                ticker_data[ticker]["bullish"] += 1
            elif st_sentiment == "Bearish":
                ticker_data[ticker]["bearish"] += 1
            else:
                ticker_data[ticker]["neutral"] += 1

    result = {}
    for ticker, d in ticker_data.items():
        total = d["total"]
        if total == 0:
            continue
        bull_ratio = d["bullish"] / total
        bear_ratio = d["bearish"] / total
        score = bull_ratio - bear_ratio
        result[ticker] = {
            "ticker": ticker,
            "bullish": d["bullish"],
            "bearish": d["bearish"],
            "neutral": d["neutral"],
            "total": total,
            "stocktwits_score": round(score, 4),
            "label": "bullish" if score > 0.1 else "bearish" if score < -0.1 else "neutral"
        }
    return result

if __name__ == "__main__":
    from nlp.ticker_extractor import extract_tickers_from_posts

    all_posts = []
    for filename in os.listdir("data/raw"):
        filepath = f"data/raw/{filename}"
        if filename.endswith(".json"):
            with open(filepath) as f:
                data = json.load(f)
                all_posts.extend(data)
                print(f"Loaded {len(data)} items from {filename}")

    print(f"\nTotal loaded: {len(all_posts)} posts/articles")

    tagged = extract_tickers_from_posts(all_posts)
    print(f"Found tickers in {len(tagged)} posts")

    print("\nRunning FinBERT sentiment analysis...")
    analyzed = analyze_posts(tagged)

    summary = aggregate_by_ticker(analyzed)

    os.makedirs("data/processed", exist_ok=True)
    outfile = f"data/processed/sentiment_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(outfile, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nSentiment summary ({len(summary)} tickers):\n")
    sorted_tickers = sorted(summary.values(), key=lambda x: x["mentions"], reverse=True)
    for t in sorted_tickers[:20]:
        emoji = "🟢" if t["avg_sentiment"] > 0.1 else "🔴" if t["avg_sentiment"] < -0.1 else "🟡"
        print(f"  {t['ticker']:<6} {emoji}  mentions: {t['mentions']:>3}  sentiment: {t['avg_sentiment']:>+.3f}  reddit_score: {t['total_reddit_score']}")

    print(f"\nSaved to {outfile}")