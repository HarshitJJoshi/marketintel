import feedparser
import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime

RSS_FEEDS = {
    "motley_fool": "https://www.fool.com/feeds/index.aspx",
    "seeking_alpha": "https://seekingalpha.com/feed.xml",
    "yahoo_finance": "https://finance.yahoo.com/rss/topfinstories",
    "marketwatch": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    "investor_place": "https://investorplace.com/feed/",
    "cnbc_finance": "https://search.cnbc.com/rs/search/combinedcombined/feed/rss/?m=10",
    "ft_markets": "https://www.ft.com/rss/home/uk"
}

def clean_html(raw):
    if not raw:
        return ""
    return BeautifulSoup(raw, "html.parser").get_text(separator=" ").strip()

def collect_rss():
    all_articles = []

    for source_name, url in RSS_FEEDS.items():
        print(f"Fetching {source_name}...")
        try:
            response = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
            feed = feedparser.parse(response.content)
            for entry in feed.entries:
                all_articles.append({
                    "source": source_name,
                    "title": entry.get("title", ""),
                    "summary": clean_html(entry.get("summary", "")),
                    "url": entry.get("link", ""),
                    "published_at": entry.get("published", ""),
                    "collected_at": datetime.utcnow().isoformat()
                })
            print(f"  → {len(feed.entries)} articles")
        except Exception as e:
            print(f"  → Failed: {e}")

    print(f"\nTotal articles collected: {len(all_articles)}")
    return all_articles

def save_articles(articles):
    os.makedirs("data/raw", exist_ok=True)
    filename = f"data/raw/rss_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(filename, "w") as f:
        json.dump(articles, f, indent=2)
    print(f"Saved to {filename}")
    return filename

if __name__ == "__main__":
    articles = collect_rss()
    save_articles(articles)