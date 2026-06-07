import feedparser
import requests
import os
import json
import whisper
from datetime import datetime

PODCAST_FEEDS = {
    "motley_fool_money": "https://feeds.megaphone.fm/ARML8165884693",
    "barrons_streetwise": "https://video-api.barrons.com/podcast/rss/barrons/streetwise?partner=itunes",
    "acquired": "https://feeds.simplecast.com/7nkzvs4E",
}

# How many latest episodes to transcribe per podcast
EPISODES_PER_FEED = 1

def download_episode(url, filepath):
    print(f"  Downloading {os.path.basename(filepath)}...")
    response = requests.get(url, stream=True, timeout=60,
                           headers={"User-Agent": "Mozilla/5.0"})
    with open(filepath, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    size_mb = os.path.getsize(filepath) / 1e6
    print(f"  Downloaded {size_mb:.1f}MB")
    return filepath

def transcribe_episode(filepath):
    print(f"  Transcribing with Whisper (this takes a few minutes)...")
    model = whisper.load_model("base")
    result = model.transcribe(filepath, fp16=False)
    return result["text"]

def collect_podcasts():
    os.makedirs("data/podcasts", exist_ok=True)
    os.makedirs("data/raw", exist_ok=True)

    all_transcripts = []

    for feed_name, feed_url in PODCAST_FEEDS.items():
        print(f"\nFetching {feed_name}...")
        try:
            feed = feedparser.parse(feed_url)
            if not feed.entries:
                print(f"  No episodes found")
                continue

            episodes = feed.entries[:EPISODES_PER_FEED]
            print(f"  Found {len(feed.entries)} episodes, processing latest {len(episodes)}")

            for episode in episodes:
                title = episode.get("title", "unknown")
                print(f"  Episode: {title}")

                # Find audio URL
                audio_url = None
                for enclosure in episode.get("enclosures", []):
                    if "audio" in enclosure.get("type", ""):
                        audio_url = enclosure.get("href") or enclosure.get("url")
                        break

                if not audio_url:
                    # Try links
                    for link in episode.get("links", []):
                        if "audio" in link.get("type", ""):
                            audio_url = link.get("href")
                            break

                if not audio_url:
                    print(f"  No audio URL found, skipping")
                    continue

                # Clean filename
                safe_title = "".join(c for c in title if c.isalnum() or c in " -_")[:50]
                audio_file = f"data/podcasts/{feed_name}_{safe_title}.mp3"
                transcript_file = f"data/podcasts/{feed_name}_{safe_title}.txt"

                # Skip if already transcribed
                if os.path.exists(transcript_file):
                    print(f"  Already transcribed, loading cached version")
                    with open(transcript_file) as f:
                        transcript_text = f.read()
                else:
                    # Download and transcribe
                    download_episode(audio_url, audio_file)
                    transcript_text = transcribe_episode(audio_file)

                    # Save transcript
                    with open(transcript_file, "w") as f:
                        f.write(transcript_text)
                    print(f"  Transcript saved ({len(transcript_text)} chars)")

                    # Clean up audio file to save space
                    os.remove(audio_file)
                    print(f"  Audio file removed to save space")

                all_transcripts.append({
                    "source": f"podcast/{feed_name}",
                    "title": title,
                    "text": transcript_text,
                    "summary": transcript_text[:500],
                    "url": episode.get("link", ""),
                    "published_at": episode.get("published", ""),
                    "collected_at": datetime.utcnow().isoformat(),
                    "word_count": len(transcript_text.split())
                })

        except Exception as e:
            print(f"  Failed: {e}")

    print(f"\nTotal transcripts: {len(all_transcripts)}")
    return all_transcripts

def save_transcripts(transcripts):
    os.makedirs("data/raw", exist_ok=True)
    filename = f"data/raw/podcasts_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.json"
    with open(filename, "w") as f:
        json.dump(transcripts, f, indent=2)
    print(f"Saved to {filename}")
    return filename

if __name__ == "__main__":
    transcripts = collect_podcasts()
    if transcripts:
        save_transcripts(transcripts)
    else:
        print("No transcripts collected")