import json
import urllib.request
from collections import defaultdict
from pathlib import Path

PLAYERS_FILE = Path("data/players.json")
MATCHES_FILE = Path("data/matches.json")
LEADERBOARD_FILE = Path("data/leaderboard.json")

API_URL = "https://wheniskickoff.com/data/v1/matches.json"


TEAM_ALIASES = {
    "USA": "United States",
    "United States": "USA",

    "Czechia": "Czech Republic",
    "Czech Republic": "Czechia",

    "Bosnia-Herzegovina": "Bosnia & Herzegovina",
    "Bosnia & Herzegovina": "Bosnia-Herzegovina",

    "Cape Verde Islands": "Cape Verde",
    "Cape Verde": "Cape Verde Islands",

    "Congo DR": "DR Congo",
    "DR Congo": "Congo DR",

    "Curaçao": "Curacao",
    "Curacao": "Curaçao",

    "Ivory Coast": "Ivory Coast",
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def normalise_team_name(name):
    if not name:
        return name

    name = str(name).strip()
    return TEAM_ALIASES.get(name, name)


def team_matches(player_team, result_team):
    player_team = normalise_team_name(player_team)
    result_team = normalise_team_name(result_team)

    if player_team == result_team:
        return True

    if TEAM_ALIASES.get(player_team) == result_team:
        return True

    if TEAM_ALIASES.get(result_team) == player_team:
        return True

    return False


def as_int_or_none(value):
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def fetch_matches():
    with urllib.request.urlopen(API_URL, timeout=30) as response:
        data = json.load(response)

    if isinstance(data, dict):
        games = (
            data.get("matches")
            or data.get("games")
            or data.get("fixtures")
            or data.get("data")
            or []
        )
    elif isinstance(data, list):
        games = data
    else:
        games = []

    matches = []

    for game in games:
        if not isinstance(game, dict):
            continue

        home = (
            game.get("home_name")
            or game.get("home_team")
            or game.get("homeTeam")
            or game.get("home")
            or game.get("team1")
        )

        away = (
            game.get("away_name")
            or game.get("away_team")
            or game.get("awayTeam")
            or game.get("away")
            or game.get("team2")
        )

        score1 = as_int_or_none(
            game.get("score_home")
            or game.get("home_score")
            or game.get("homeScore")
            or game.get("homeGoals")
            or game.get("home_goals")
        )

        score2 = as_int_or_none(
            game.get("score_away")
            or game.get("away_score")
            or game.get("awayScore")
            or game.get("awayGoals")
            or game.get("away_goals")
        )

        status = str(game.get("status", "")).lower()

        if not home or not away:
            continue

        matches.append({
            "team1": normalise_team_name(home),
            "team2": normalise_team_name(away),
            "score1": score1,
            "score2": score2,
            "status": status,
            "date": game.get("date") or game.get("utcDate") or game.get("local_date") or game.get("datetime_utc"),
            "raw": game
        })

    scored_matches = [
        m for m in matches
        if m["score1"] is not None and m["score2"] is not None
    ]

    print(f"Matches found: {len(matches)}")
    print(f"Matches with scores: {len(scored_matches)}")

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
                for result_team, points in results.items():
                    if team_matches(team, result_team):
                        scores[player["name"]] += points
                        games_played[player["name"]] += 1

    leaderboard = []

    for player in players:
        leaderboard.append({
            "name": player["name"],
            "teams": player["teams"],
            "points": scores[player["name"]],
            "gamesPlayed": games_played[player["name"]]
        })

    leaderboard.sort(
        key=lambda x: (x["points"], x["gamesPlayed"]),
        reverse=True
    )

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
