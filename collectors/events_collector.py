import requests
import json
import os
from datetime import datetime, timedelta

def get_fed_meetings():
    """
    Federal Reserve meeting dates — published publicly
    Hardcoded for 2026 since Fed publishes calendar annually
    """
    fed_dates = [
        {"date": "2026-01-28", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-01-29", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-03-18", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-03-19", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-05-06", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-05-07", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-06-17", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-06-18", "event": "Fed Rate Decision + Press Conference", "type": "fed", "impact": "high"},
        {"date": "2026-07-28", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-07-29", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-09-15", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-09-16", "event": "Fed Rate Decision + Press Conference", "type": "fed", "impact": "high"},
        {"date": "2026-11-04", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-11-05", "event": "Fed Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-12-15", "event": "Fed Meeting", "type": "fed", "impact": "high"},
        {"date": "2026-12-16", "event": "Fed Rate Decision + Press Conference", "type": "fed", "impact": "high"},
    ]
    return fed_dates

def get_economic_events():
    """
    Key economic data release dates for 2026
    CPI, Jobs Report, GDP — biggest market movers
    """
    economic_dates = [
        # June 2026
        {"date": "2026-06-11", "event": "CPI Report (May)", "type": "economic", "impact": "high"},
        {"date": "2026-06-26", "event": "GDP Q1 Final", "type": "economic", "impact": "high"},
        {"date": "2026-07-02", "event": "Jobs Report (June)", "type": "economic", "impact": "high"},
        {"date": "2026-07-09", "event": "CPI Report (June)", "type": "economic", "impact": "high"},
        {"date": "2026-07-29", "event": "FOMC Rate Decision", "type": "fed", "impact": "high"},
        {"date": "2026-07-30", "event": "GDP Q2 Advance", "type": "economic", "impact": "high"},
        {"date": "2026-08-06", "event": "Jobs Report (July)", "type": "economic", "impact": "high"},
        {"date": "2026-08-13", "event": "CPI Report (July)", "type": "economic", "impact": "high"},
        {"date": "2026-09-03", "event": "Jobs Report (August)", "type": "economic", "impact": "high"},
        {"date": "2026-09-10", "event": "CPI Report (August)", "type": "economic", "impact": "high"},
        {"date": "2026-09-16", "event": "FOMC Rate Decision", "type": "fed", "impact": "high"},
    ]
    return economic_dates

def get_earnings_events(days_ahead=14):
    """
    Get upcoming earnings from our existing price data
    """
    earnings = []
    price_files = sorted([
        f for f in os.listdir("data/raw")
        if f.startswith("prices_") and f.endswith(".json")
    ])
    if not price_files:
        return earnings

    with open(f"data/raw/{price_files[-1]}") as f:
        prices = json.load(f)

    today = datetime.utcnow().date()
    cutoff = today + timedelta(days=days_ahead)

    for p in prices:
        earnings_date = p.get("earnings_date")
        if not earnings_date:
            continue
        try:
            ed = datetime.strptime(earnings_date[:10], "%Y-%m-%d").date()
            if today <= ed <= cutoff:
                earnings.append({
                    "date": earnings_date[:10],
                    "event": f"{p['ticker']} Earnings",
                    "type": "earnings",
                    "impact": "medium",
                    "ticker": p["ticker"]
                })
        except:
            pass

    return sorted(earnings, key=lambda x: x["date"])

def get_upcoming_events(days_ahead=14):
    """
    Combine all events and return next N days
    """
    today = datetime.utcnow().date()
    cutoff = today + timedelta(days=days_ahead)

    all_events = []
    all_events.extend(get_fed_meetings())
    all_events.extend(get_economic_events())
    all_events.extend(get_earnings_events(days_ahead))

    # Filter to upcoming only
    upcoming = []
    for event in all_events:
        try:
            event_date = datetime.strptime(event["date"], "%Y-%m-%d").date()
            if today <= event_date <= cutoff:
                days_away = (event_date - today).days
                event["days_away"] = days_away
                event["is_today"] = days_away == 0
                event["is_tomorrow"] = days_away == 1
                upcoming.append(event)
        except:
            pass

    return sorted(upcoming, key=lambda x: x["date"])

def save_events(events):
    os.makedirs("data/processed", exist_ok=True)
    filename = "data/processed/events.json"
    with open(filename, "w") as f:
        json.dump({
            "generated_at": datetime.utcnow().isoformat(),
            "events": events
        }, f, indent=2)
    print(f"Saved {len(events)} events to {filename}")
    return filename

if __name__ == "__main__":
    events = get_upcoming_events(days_ahead=14)
    save_events(events)
    print(f"\nUpcoming market events (next 14 days):\n")
    for e in events:
        days = e["days_away"]
        label = "TODAY" if days == 0 else "TOMORROW" if days == 1 else f"in {days}d"
        impact = "🔴" if e["impact"] == "high" else "🟡"
        print(f"  {impact} {e['date']} ({label}) — {e['event']}")