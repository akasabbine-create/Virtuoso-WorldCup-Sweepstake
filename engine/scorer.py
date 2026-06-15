import json
import urllib.request
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

PLAYERS_FILE = Path("data/players.json")
MATCHES_FILE = Path("data/matches.json")
LEADERBOARD_FILE = Path("data/leaderboard.json")

ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"


TEAM_ALIASES = {
    "Türkiye": "Turkey",
    "Turkey": "Turkey",

    "Curaçao": "Curacao",
    "Curacao": "Curacao",

    "United States": "USA",
    "USA": "USA",

    "Czechia": "Czech Republic",
    "Czech Republic": "Czech Republic",

    "Bosnia-Herzegovina": "Bosnia",
    "Bosnia & Herzegovina": "Bosnia",
    "Bosnia and Herzegovina": "Bosnia",
    "Bosnia": "Bosnia",

    "Cape Verde Islands": "Cape Verde",
    "Cape Verde": "Cape Verde",

    "Congo DR": "DR Congo",
    "DR Congo": "DR Congo",

    "Korea Republic": "South Korea",
    "South Korea": "South Korea",
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
    return normalise_team_name(player_team) == normalise_team_name(result_team)


def as_int_or_none(value):
    if value is None:
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def fetch_json(url):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"}
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_espn_day(day):
    url = f"{ESPN_URL}?dates={day.strftime('%Y%m%d')}"
    data = fetch_json(url)

    matches = []

    for event in data.get("events", []):
        competition = event.get("competitions", [{}])[0]
        competitors = competition.get("competitors", [])

        if len(competitors) < 2:
            continue

        home = None
        away = None

        for competitor in competitors:
            side = competitor.get("homeAway")
            team = competitor.get("team", {})
            team_name = team.get("displayName") or team.get("name")
            score = as_int_or_none(competitor.get("score"))

            item = {
                "team": normalise_team_name(team_name),
                "score": score,
                "winner": competitor.get("winner", False),
                "raw": competitor
            }

            if side == "home":
                home = item
            elif side == "away":
                away = item

        if not home or not away:
            continue

        status = competition.get("status", {})
        status_type = status.get("type", {})
        completed = status_type.get("completed", False)

        matches.append({
            "team1": home["team"],
            "team2": away["team"],
            "score1": home["score"] if completed else None,
            "score2": away["score"] if completed else None,
            "status": status_type.get("description", ""),
            "completed": completed,
            "date": event.get("date"),
            "name": event.get("name"),
            "raw": event
        })

    return matches


def fetch_matches():
    """
    ESPN returns matches by date, so fetch every day from the tournament start
    through tomorrow. This keeps it automatic.
    """
    start = date(2026, 6, 11)
    end = date.today() + timedelta(days=1)

    all_matches = []
    seen = set()

    current = start
    while current <= end:
        day_matches = fetch_espn_day(current)

        for match in day_matches:
            key = (
                match.get("date"),
                match.get("team1"),
                match.get("team2"),
            )

            if key not in seen:
                seen.add(key)
                all_matches.append(match)

        current += timedelta(days=1)

    scored_matches = [
        m for m in all_matches
        if m["score1"] is not None and m["score2"] is not None
    ]

    print(f"ESPN matches found: {len(all_matches)}")
    print(f"ESPN matches with scores: {len(scored_matches)}")

    return all_matches


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

    print("Updated matches and leaderboard from ESPN")
