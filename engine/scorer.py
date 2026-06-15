import json
import urllib.request
from collections import defaultdict
from pathlib import Path

PLAYERS_FILE = Path("data/players.json")
MATCHES_FILE = Path("data/matches.json")
LEADERBOARD_FILE = Path("data/leaderboard.json")

API_URL = "https://wheniskickoff.com/data/v1/matches.json"

def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def fetch_matches():
    with urllib.request.urlopen(API_URL, timeout=30) as response:
        games = json.load(response)

    matches = []

    for game in games:
        home = game.get("home_team") or game.get("homeTeam") or game.get("team1")
        away = game.get("away_team") or game.get("awayTeam") or game.get("team2")

        home_score = game.get("home_score")
        away_score = game.get("away_score")

        if home_score is None:
            home_score = game.get("homeScore")
        if away_score is None:
            away_score = game.get("awayScore")

        status = str(game.get("status", "")).lower()

        if not home or not away:
            continue

        matches.append({
            "team1": home,
            "team2": away,
            "score1": home_score,
            "score2": away_score,
            "status": status,
            "date": game.get("date") or game.get("utcDate") or game.get("local_date"),
            "raw": game
        })

    return matches

def calculate(players, matches):
    scores = defaultdict(int)
    games_played = defaultdict(int)

    for match in matches:
        s1 = match.get("score1")
        s2 = match.get("score2")

        if s1 is None or s2 is None:
            continue

        t1 = match["team1"]
        t2 = match["team2"]

        if s1 > s2:
            results = {t1: 3, t2: 0}
        elif s2 > s1:
            results = {t1: 0, t2: 3}
        else:
            results = {t1: 1, t2: 1}

        for player in players:
            for team in player["teams"]:
                if team in results:
                    scores[player["name"]] += results[team]
                    games_played[player["name"]] += 1

    leaderboard = []

    for player in players:
        leaderboard.append({
            "name": player["name"],
            "teams": player["teams"],
            "points": scores[player["name"]],
            "gamesPlayed": games_played[player["name"]]
        })

    leaderboard.sort(key=lambda x: x["points"], reverse=True)

    for index, row in enumerate(leaderboard, start=1):
        row["rank"] = index

    return leaderboard

if __name__ == "__main__":
    players = load(PLAYERS_FILE)

    matches = fetch_matches()
    save(MATCHES_FILE, matches)

    leaderboard = calculate(players, matches)
    save(LEADERBOARD_FILE, leaderboard)

    print("Updated matches and leaderboard")