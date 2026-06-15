import json
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

PLAYERS_FILE = Path("data/players.json")
MATCHES_FILE = Path("data/matches.json")
LEADERBOARD_FILE = Path("data/leaderboard.json")
STATUS_FILE = Path("data/status.json")
HISTORY_FILE = Path("data/history.json")
LATEST_RESULTS_FILE = Path("data/latest_results.json")
UPCOMING_FIXTURES_FILE = Path("data/upcoming_fixtures.json")

ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"

TOTAL_TOURNAMENT_MATCHES = 104
TOURNAMENT_START = date(2026, 6, 11)
TOURNAMENT_END = date(2026, 7, 19)


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


def load(path, default=None):
    if not path.exists():
        return default

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
                "raw": competitor,
            }

            if side == "home":
                home = item
            elif side == "away":
                away = item

        if not home or not away:
            continue

        status = competition.get("status", {})
        status_type = status.get("type", {})
        completed = bool(status_type.get("completed", False))

        matches.append({
            "id": event.get("id"),
            "team1": home["team"],
            "team2": away["team"],
            "score1": home["score"] if completed else None,
            "score2": away["score"] if completed else None,
            "status": status_type.get("description", ""),
            "completed": completed,
            "date": event.get("date"),
            "name": event.get("name"),
            "shortName": event.get("shortName"),
            "raw": event,
        })

    return matches


def fetch_matches():
    all_matches = []
    seen = set()

    current = TOURNAMENT_START

    while current <= TOURNAMENT_END:
        day_matches = fetch_espn_day(current)

        for match in day_matches:
            key = match.get("id") or (
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

    print(f"ESPN matches fetched: {len(all_matches)}")
    print(f"Completed matches with scores: {len(scored_matches)}")
    print(f"Total tournament matches: {TOTAL_TOURNAMENT_MATCHES}")

    return all_matches


def match_points(match):
    s1 = match.get("score1")
    s2 = match.get("score2")

    if s1 is None or s2 is None:
        return {}

    t1 = match["team1"]
    t2 = match["team2"]

    if s1 > s2:
        return {t1: 3, t2: 0}

    if s2 > s1:
        return {t1: 0, t2: 3}

    return {t1: 1, t2: 1}


def calculate(players, matches, previous_leaderboard):
    scores = defaultdict(int)
    games_played = defaultdict(int)

    previous_by_name = {
        row["name"]: row
        for row in previous_leaderboard or []
    }

    for match in matches:
        results = match_points(match)

        if not results:
            continue

        for player in players:
            for team in player["teams"]:
                for result_team, points in results.items():
                    if team_matches(team, result_team):
                        scores[player["name"]] += points
                        games_played[player["name"]] += 1

    leaderboard = []

    for player in players:
        player_name = player["name"]
        teams = [normalise_team_name(team) for team in player["teams"]]

        leaderboard.append({
            "name": player_name,
            "teams": teams,
            "points": scores[player_name],
            "gamesPlayed": games_played[player_name],
        })

    leaderboard.sort(
        key=lambda x: (-x["points"], -x["gamesPlayed"], x["name"])
    )

    for index, row in enumerate(leaderboard, start=1):
        row["rank"] = index

    for row in leaderboard:
        previous = previous_by_name.get(row["name"])

        if not previous:
            row["previousRank"] = None
            row["movement"] = 0
            continue

        previous_rank = previous.get("rank")
        previous_points = previous.get("points", 0)
        previous_games = previous.get("gamesPlayed", 0)

        row["previousRank"] = previous_rank

        points_changed = row["points"] != previous_points
        games_changed = row["gamesPlayed"] != previous_games

        if not points_changed and not games_changed:
            row["movement"] = 0
        elif previous_rank is None:
            row["movement"] = 0
        else:
            row["movement"] = previous_rank - row["rank"]

    return leaderboard


def build_latest_results(players, matches, limit=8):
    completed = [
        m for m in matches
        if m.get("score1") is not None and m.get("score2") is not None
    ]

    completed.sort(key=lambda x: x.get("date") or "", reverse=True)

    latest = []

    for match in completed[:limit]:
        results = match_points(match)
        player_gains = []

        for player in players:
            gained = 0

            for team in player["teams"]:
                for result_team, points in results.items():
                    if team_matches(team, result_team):
                        gained += points

            if gained > 0:
                player_gains.append({
                    "name": player["name"],
                    "points": gained
                })

        player_gains.sort(key=lambda x: (-x["points"], x["name"]))

        latest.append({
            "date": match.get("date"),
            "team1": match["team1"],
            "team2": match["team2"],
            "score1": match["score1"],
            "score2": match["score2"],
            "status": match.get("status"),
            "playerGains": player_gains,
        })

    return latest


def build_upcoming_fixtures(players, matches, limit=8):
    now = datetime.now(timezone.utc)

    upcoming = []

    for match in matches:
        if match.get("score1") is not None and match.get("score2") is not None:
            continue

        raw_date = match.get("date")

        if not raw_date:
            continue

        try:
            match_date = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
        except ValueError:
            continue

        if match_date < now:
            continue

        involved_players = []

        for player in players:
            matching_teams = []

            for team in player["teams"]:
                if team_matches(team, match["team1"]):
                    matching_teams.append(match["team1"])

                if team_matches(team, match["team2"]):
                    matching_teams.append(match["team2"])

            if matching_teams:
                involved_players.append({
                    "name": player["name"],
                    "teams": matching_teams
                })

        upcoming.append({
            "date": match.get("date"),
            "team1": match["team1"],
            "team2": match["team2"],
            "status": match.get("status"),
            "players": involved_players
        })

    upcoming.sort(key=lambda x: x.get("date") or "")

    return upcoming[:limit]


def update_history(leaderboard):
    history = load(HISTORY_FILE, default=[])

    snapshot_players = [
        {
            "name": row["name"],
            "points": row["points"],
            "rank": row["rank"],
        }
        for row in leaderboard
    ]

    if history:
        previous_players = history[-1].get("players", [])

        previous_simple = [
            {
                "name": row.get("name"),
                "points": row.get("points"),
                "rank": row.get("rank"),
            }
            for row in previous_players
        ]

        if previous_simple == snapshot_players:
            save(HISTORY_FILE, history)
            return

    snapshot = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "players": snapshot_players
    }

    history.append(snapshot)
    history = history[-300:]

    save(HISTORY_FILE, history)


def build_status(matches):
    completed = [
        m for m in matches
        if m.get("score1") is not None and m.get("score2") is not None
    ]

    return {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "completedMatches": len(completed),
        "totalTournamentMatches": TOTAL_TOURNAMENT_MATCHES,
        "matchesFetchedFromEspn": len(matches),
        "source": "ESPN public scoreboard",
    }


if __name__ == "__main__":
    players = load(PLAYERS_FILE, default=[])
    previous_leaderboard = load(LEADERBOARD_FILE, default=[])

    matches = fetch_matches()
    leaderboard = calculate(players, matches, previous_leaderboard)
    latest_results = build_latest_results(players, matches)
    upcoming_fixtures = build_upcoming_fixtures(players, matches)
    status = build_status(matches)

    save(MATCHES_FILE, matches)
    save(LEADERBOARD_FILE, leaderboard)
    save(LATEST_RESULTS_FILE, latest_results)
    save(UPCOMING_FIXTURES_FILE, upcoming_fixtures)
    save(STATUS_FILE, status)
    update_history(leaderboard)

    print("Updated dashboard data")
