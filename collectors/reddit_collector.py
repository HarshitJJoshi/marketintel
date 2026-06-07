import praw
import os
from dotenv import load_dotenv
from datetime import datetime
import json

load_dotenv()

def get_reddit_client():
    return praw.Reddit(
        client_id=os.getenv("REDDIT_CLIENT_ID"),
        client_secret=os.getenv("REDDIT_SECRET"),
        user_agent=os.getenv("REDDIT_USER_AGENT")
    )

SUBREDDITS = [
    "wallstreetbets",
    "stocks",
    "investing",
    "SecurityAnalysis",
    "StockMarket"
]

def collect_posts(limit=100):
    reddit = get_reddit_client()
    all_posts = []

    for subreddit_name in SUBREDDITS:
        print(f"Collecting from r/{subreddit_name}...")
        subreddit = reddit.subreddit(subreddit_name)

        for post in subreddit.hot(limit=limit):
            all_posts.append({
                "source": f"reddit/r/{subreddit_name}",
                "title": post.title,
                "text": post.selftext,
                "score": post.score,
                "comments": post.num_comments,
                "url": post.url,
                "created_at": datetime.utcfromtimestamp(post.created_utc).isoformat(),
                "collected_at": datetime.utcnow().isoformat()
            })

    print(f"Collected {len(all_posts)} posts total")
    return all_posts

def save_posts(posts):
    os.makedirs("data/raw", exist_ok=True)
    filename = f"data/raw/reddit_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(filename, "w") as f:
        json.dump(posts, f, indent=2)
    print(f"Saved to {filename}")
    return filename

if __name__ == "__main__":
    posts = collect_posts(limit=50)
    save_posts(posts)