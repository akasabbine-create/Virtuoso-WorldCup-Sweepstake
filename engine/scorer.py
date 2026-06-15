import json
import urllib.request
from collections import defaultdict
from pathlib import Path

PLAYERS_FILE = Path("data/players.json")
MATCHES_FILE = Path("data/matches.json")
LEADERBOARD_FILE = Path("data/leaderboard.json")
RAW_FILE = Path("data/raw-api-data.json")

API_URL = "https://wheniskickoff.com/data/v1/matches.json"


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def fetch_json():
    with urllib.request.urlopen(API_URL, timeout=30) as response:
        return json.load(response)


def find_possible_matches(data):
    """
    Recursively searches the API response for match-like dictionaries.
    This is more flexible than assuming the API returns a simple list.
    """
    found = []

    def walk(value):
        if isinstance(value, dict):
            keys = set(value.keys())

            has_team_info = any(k in keys for k in [
                "home_team", "away_team",
                "homeTeam", "awayTeam",
                "home", "away",
                "team1", "team2",
                "home_team_id", "away_team_id"
            ])

            has_score_info = any(k in keys for k in [
                "home_score", "away_score",
                "homeScore", "awayScore",
                "score", "scores",
                "homeGoals", "awayGoals",
                "home_goals", "away_goals"
            ])

            has_fixture_info = any(k in keys for k in [
                "date", "utcDate", "kickoff", "status", "stage", "round"
            ])

            if has_team_info and (has_score_info or has_fixture_info):
                found.append(value)

            for child in value.values():
                walk(child)

        elif isinstance(value, list):
            for item in value:
                walk(item)

    walk(data)
    return found


def get_team_name(value):
    if isinstance(value, str):
        return value

    if isinstance(value, dict):
        return (
            value.get("name")
            or value.get("country")
            or value.get("team")
            or value.get("displayName")
            or value.get("shortName")
        )

    return None


def get_score(game, side):
    """
    side should be 'home' or 'away'.
    Tries several common score formats.
    """
    direct_keys = {
        "home": ["home_score", "homeScore", "homeGoals", "home_goals"],
        "away": ["away_score", "awayScore", "awayGoals", "away_goals"]
    }

    for key in direct_keys[side]:
        if key in game and game[key] is not None:
            return game[key]

    score = game.get("score")
    if isinstance(score, dict):
        for key in [side, f"{side}_score", f"{side}Score", f"{side}Goals"]:
            if key in score and score[key] is not None:
                return score[key]

        if side == "home":
            for key in ["homeTeam", "home_team"]:
                if isinstance(score.get(key), dict):
                    nested = score[key]
                    for score_key in ["score", "goals", "value"]:
                        if score_key in nested:
                            return nested[score_key]

        if side == "away":
            for key in ["awayTeam", "away_team"]:
                if isinstance(score.get(key), dict):
                    nested = score[key]
                    for score_key in ["score", "goals", "value"]:
                        if score_key in nested:
                            return nested[score_key]

    scores = game.get("scores")
    if isinstance(scores, dict):
        if side in scores:
            return scores[side]

    return None


def as_int_or_none(value):
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def fetch_matches():
    data = fetch_json()

    save(RAW_FILE, data)

    possible_games = find_possible_matches(data)

    matches = []

    for game in possible_games:
        home = (
            get_team_name(game.get("home_team"))
            or get_team_name(game.get("homeTeam"))
            or get_team_name(game.get("home"))
            or get_team_name(game.get("team1"))
        )

        away = (
            get_team_name(game.get("away_team"))
            or get_team_name(game.get("awayTeam"))
            or get_team_name(game.get("away"))
            or get_team_name(game.get("team2"))
        )

        home_score = as_int_or_none(get_score(game, "home"))
        away_score = as_int_or_none(get_score(game, "away"))

        if not home or not away:
            continue

        matches.append({
            "team1": home,
            "team2": away,
            "score1": home_score,
            "score2": away_score,
            "status": str(game.get("status", "")).lower(),
            "date": game.get("date") or game.get("utcDate") or game.get("local_date") or game.get("kickoff"),
            "raw": game
        })

    scored_matches = [
        m for m in matches
        if m["score1"] is not None and m["score2"] is not None
    ]

    print(f"API returned possible matches: {len(possible_games)}")
    print(f"Normalised matches saved: {len(matches)}")
    print(f"Matches with scores: {len(scored_matches)}")

    if matches:
        print("Example normalised match:")
        print(json.dumps(matches[0], indent=2, ensure_ascii=False)[:1000])

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
