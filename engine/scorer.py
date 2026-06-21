import json
import urllib.request
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

PLAYERS_FILE = Path("data/players.json")
MATCHES_FILE = Path("data/matches.json")
LEADERBOARD_FILE = Path("data/leaderboard.json")
STATUS_FILE = Path("data/status.json")
HISTORY_FILE = Path("data/history.json")
LATEST_RESULTS_FILE = Path("data/latest_results.json")
UPCOMING_FIXTURES_FILE = Path("data/upcoming_fixtures.json")
PLAYER_DETAILS_FILE = Path("data/player_details.json")
BONUS_POINTS_FILE = Path("data/bonus_points.json")
DRAMA_FEED_FILE = Path("data/drama_feed.json")

ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"

TOTAL_TOURNAMENT_MATCHES = 104
TOURNAMENT_START = date(2026, 6, 11)
TOURNAMENT_END = date(2026, 7, 19)

MOVEMENT_DISPLAY_HOURS = 24

FOOTBALL_DAY_TIMEZONE = ZoneInfo("Europe/London")
FOOTBALL_DAY_START_HOUR = 6

PROGRESSION_BONUSES = {
    "round_of_32": ("Reach Round of 32", 5),
    "round_of_16": ("Reach Round of 16", 5),
    "quarter_final": ("Reach Quarter-finals", 5),
    "semi_final": ("Reach Semi-finals", 10),
    "final": ("Reach Final", 10),
}

WINNER_BONUS = ("Tournament Winner", 15)
GOLDEN_BOOT_BONUS = ("Golden Boot", 5)
MOST_GOALS_NATION_BONUS = ("Most goals by nation", 5)
KNOCKOUT_CLEAN_SHEET_BONUS = ("Knockout clean sheet", 2)

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


def parse_datetime(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def movement_direction(movement):
    if movement > 0:
        return "up"

    if movement < 0:
        return "down"

    return "same"


def previous_movement_is_still_visible(previous_row, now):
    if not previous_row:
        return False

    previous_movement = previous_row.get("movement", 0)

    if not previous_movement:
        return False

    show_until = parse_datetime(previous_row.get("showMovementUntil"))

    if not show_until:
        return False

    return now < show_until


def get_football_day_window(now_utc=None):
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    now_local = now_utc.astimezone(FOOTBALL_DAY_TIMEZONE)

    start_local = datetime.combine(
        now_local.date(),
        time(hour=FOOTBALL_DAY_START_HOUR),
        tzinfo=FOOTBALL_DAY_TIMEZONE,
    )

    if now_local < start_local:
        start_local -= timedelta(days=1)

    end_local = start_local + timedelta(days=1)

    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def is_live_or_in_progress_status(status_text):
    text = str(status_text or "").lower()

    live_words = [
        "live",
        "in progress",
        "1st",
        "first half",
        "2nd",
        "second half",
        "half",
        "halftime",
        "half time",
        "extra",
        "penalty",
        "stoppage",
    ]

    return any(word in text for word in live_words)


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
        status_description = (
            status_type.get("description")
            or status_type.get("detail")
            or status_type.get("shortDetail")
            or ""
        )

        display_score1 = home["score"]
        display_score2 = away["score"]

        matches.append({
            "id": event.get("id"),
            "team1": home["team"],
            "team2": away["team"],
            "score1": home["score"] if completed else None,
            "score2": away["score"] if completed else None,
            "displayScore1": display_score1,
            "displayScore2": display_score2,
            "status": status_description,
            "completed": completed,
            "live": bool(not completed and is_live_or_in_progress_status(status_description)),
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


def get_match_stage(match):
    raw = match.get("raw", {}) or {}
    competition = (raw.get("competitions") or [{}])[0]

    values = [
        str((raw.get("season") or {}).get("slug", "")),
        str((match.get("raw") or {}).get("name", "")),
        str(match.get("name", "")),
        str(match.get("shortName", "")),
        str(competition.get("altGameNote", "")),
    ]

    text = " ".join(values).lower()

    if "group" in text:
        return "group"

    if "round of 32" in text or "round-of-32" in text or "rd of 32" in text:
        return "round_of_32"

    if "round of 16" in text or "round-of-16" in text or "rd of 16" in text:
        return "round_of_16"

    if "quarter" in text:
        return "quarter_final"

    if "semi" in text:
        return "semi_final"

    if "3rd-place" in text or "third-place" in text or "3rd place" in text:
        return "third_place"

    if "final" in text:
        return "final"

    return "unknown"


def is_knockout_stage(stage):
    return stage in {
        "round_of_32",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "final",
        "third_place",
    }


def build_team_to_players(players):
    mapping = defaultdict(list)

    for player in players:
        for team in player["teams"]:
            mapping[normalise_team_name(team)].append(player["name"])

    return mapping


def add_bonus(player_bonuses, team_to_players, team, label, points, reason, status="awarded"):
    team = normalise_team_name(team)
    owners = team_to_players.get(team, [])

    for owner in owners:
        player_bonuses[owner]["items"].append({
            "label": label,
            "team": team,
            "points": points if status == "awarded" else 0,
            "displayPoints": points,
            "reason": reason,
            "status": status,
        })

        if status == "awarded":
            player_bonuses[owner]["total"] += points


def get_competitor_team_id_map(match):
    raw = match.get("raw", {}) or {}
    competition = (raw.get("competitions") or [{}])[0]
    competitors = competition.get("competitors", [])

    mapping = {}

    for competitor in competitors:
        team = competitor.get("team", {})
        team_id = str(team.get("id"))
        team_name = normalise_team_name(team.get("displayName") or team.get("name"))

        if team_id and team_name:
            mapping[team_id] = team_name

    return mapping


def build_goal_trackers(matches):
    scorer_totals = defaultdict(lambda: {
        "player": None,
        "team": None,
        "goals": 0,
    })

    nation_goals = defaultdict(int)
    fastest_goal = None
    fastest_goals = []

    for match in matches:
        if match.get("score1") is None or match.get("score2") is None:
            continue

        nation_goals[match["team1"]] += match["score1"]
        nation_goals[match["team2"]] += match["score2"]

        raw = match.get("raw", {}) or {}
        competition = (raw.get("competitions") or [{}])[0]
        details = competition.get("details", [])
        team_id_map = get_competitor_team_id_map(match)

        for detail in details:
            if not detail.get("scoringPlay"):
                continue

            if detail.get("ownGoal"):
                continue

            score_value = detail.get("scoreValue", 1)

            if score_value != 1:
                continue

            team_id = str((detail.get("team") or {}).get("id"))
            scoring_team = team_id_map.get(team_id)

            athletes = detail.get("athletesInvolved", [])
            scorer_name = None

            if athletes:
                scorer_name = athletes[0].get("displayName") or athletes[0].get("fullName")

            if not scorer_name or not scoring_team:
                continue

            key = f"{scorer_name}|{scoring_team}"

            scorer_totals[key]["player"] = scorer_name
            scorer_totals[key]["team"] = scoring_team
            scorer_totals[key]["goals"] += 1

            clock = detail.get("clock", {})
            clock_value = clock.get("value")

            if clock_value is not None:
                goal_item = {
                    "player": scorer_name,
                    "team": scoring_team,
                    "opponent": match["team2"] if scoring_team == match["team1"] else match["team1"],
                    "clockSeconds": clock_value,
                    "clockDisplay": clock.get("displayValue", ""),
                    "date": match.get("date"),
                    "match": f"{match['team1']} {match['score1']}–{match['score2']} {match['team2']}",
                }

                fastest_goals.append(goal_item)

                if fastest_goal is None or clock_value < fastest_goal["clockSeconds"]:
                    fastest_goal = goal_item

    fastest_goals.sort(key=lambda x: (x["clockSeconds"], x["player"] or "", x["team"] or ""))

    golden_boot_race = sorted(
        scorer_totals.values(),
        key=lambda x: (-x["goals"], x["player"] or "")
    )

    nation_goal_table = [
        {
            "team": team,
            "goals": goals,
        }
        for team, goals in nation_goals.items()
    ]

    nation_goal_table.sort(key=lambda x: (-x["goals"], x["team"]))

    return golden_boot_race, nation_goal_table, fastest_goal, fastest_goals[:10]


def build_bonus_points(players, matches):
    team_to_players = build_team_to_players(players)

    player_bonuses = defaultdict(lambda: {
        "total": 0,
        "items": [],
    })

    completed_matches = [
        m for m in matches
        if m.get("score1") is not None and m.get("score2") is not None
    ]

    tournament_complete = len(completed_matches) >= TOTAL_TOURNAMENT_MATCHES

    stage_awards_seen = set()
    clean_sheet_awards_seen = set()

    for match in completed_matches:
        stage = get_match_stage(match)

        if stage in PROGRESSION_BONUSES:
            label, points = PROGRESSION_BONUSES[stage]

            for team in [match["team1"], match["team2"]]:
                key = (team, stage)

                if key not in stage_awards_seen:
                    stage_awards_seen.add(key)

                    add_bonus(
                        player_bonuses,
                        team_to_players,
                        team,
                        label,
                        points,
                        f"{team} reached {label.replace('Reach ', '')}"
                    )

        if stage == "final":
            winner_team = None

            if match["score1"] > match["score2"]:
                winner_team = match["team1"]
            elif match["score2"] > match["score1"]:
                winner_team = match["team2"]

            if winner_team:
                label, points = WINNER_BONUS

                add_bonus(
                    player_bonuses,
                    team_to_players,
                    winner_team,
                    label,
                    points,
                    f"{winner_team} won the tournament"
                )

        if is_knockout_stage(stage):
            if match["score2"] == 0:
                key = (match["team1"], match.get("id"), "clean_sheet")

                if key not in clean_sheet_awards_seen:
                    clean_sheet_awards_seen.add(key)
                    label, points = KNOCKOUT_CLEAN_SHEET_BONUS

                    add_bonus(
                        player_bonuses,
                        team_to_players,
                        match["team1"],
                        label,
                        points,
                        f"{match['team1']} kept a knockout clean sheet against {match['team2']}"
                    )

            if match["score1"] == 0:
                key = (match["team2"], match.get("id"), "clean_sheet")

                if key not in clean_sheet_awards_seen:
                    clean_sheet_awards_seen.add(key)
                    label, points = KNOCKOUT_CLEAN_SHEET_BONUS

                    add_bonus(
                        player_bonuses,
                        team_to_players,
                        match["team2"],
                        label,
                        points,
                        f"{match['team2']} kept a knockout clean sheet against {match['team1']}"
                    )

    golden_boot_race, nation_goal_table, fastest_goal, fastest_goal_race = build_goal_trackers(matches)

    if tournament_complete and golden_boot_race:
        top_goals = golden_boot_race[0]["goals"]
        top_scorers = [
            item for item in golden_boot_race
            if item["goals"] == top_goals
        ]

        awarded_teams = set()

        for scorer in top_scorers:
            team = scorer["team"]

            if team in awarded_teams:
                continue

            awarded_teams.add(team)
            label, points = GOLDEN_BOOT_BONUS

            add_bonus(
                player_bonuses,
                team_to_players,
                team,
                label,
                points,
                f"{scorer['player']} won/shared the Golden Boot with {scorer['goals']} goals"
            )

    if tournament_complete and nation_goal_table:
        top_goals = nation_goal_table[0]["goals"]
        top_nations = [
            item for item in nation_goal_table
            if item["goals"] == top_goals
        ]

        for nation in top_nations:
            label, points = MOST_GOALS_NATION_BONUS

            add_bonus(
                player_bonuses,
                team_to_players,
                nation["team"],
                label,
                points,
                f"{nation['team']} finished with the most goals: {nation['goals']}"
            )

    player_bonus_rows = []

    for player in players:
        name = player["name"]
        bonus = player_bonuses[name]

        player_bonus_rows.append({
            "name": name,
            "total": bonus["total"],
            "items": bonus["items"],
        })

    player_bonus_rows.sort(key=lambda x: (-x["total"], x["name"]))

    return {
        "tournamentComplete": tournament_complete,
        "playerBonuses": player_bonus_rows,
        "goldenBootRace": golden_boot_race[:10],
        "nationGoalTable": nation_goal_table,
        "fastestGoal": fastest_goal,
        "fastestGoalRace": fastest_goal_race,
        "notes": [
            "Progression bonuses are awarded when teams appear in the relevant knockout stage data.",
            "Knockout clean sheet bonuses are awarded automatically from knockout-stage scores.",
            "Golden Boot and most goals by nation are tracked during the tournament and awarded when the tournament is complete.",
            "Fastest goal is prize-only and does not affect leaderboard points.",
            "Wooden Spoon is prize-only and does not affect leaderboard points."
        ]
    }


def calculate(players, matches, previous_leaderboard, bonus_data):
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    show_until_iso = (now + timedelta(hours=MOVEMENT_DISPLAY_HOURS)).isoformat()

    base_scores = defaultdict(int)
    games_played = defaultdict(int)
    goals_for = defaultdict(int)
    goals_against = defaultdict(int)

    bonus_by_player = {
        row["name"]: row.get("total", 0)
        for row in bonus_data.get("playerBonuses", [])
    }

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
                        base_scores[player["name"]] += points
                        games_played[player["name"]] += 1

                        if team_matches(result_team, match.get("team1")):
                            goals_for[player["name"]] += match.get("score1") or 0
                            goals_against[player["name"]] += match.get("score2") or 0
                        elif team_matches(result_team, match.get("team2")):
                            goals_for[player["name"]] += match.get("score2") or 0
                            goals_against[player["name"]] += match.get("score1") or 0

    leaderboard = []

    for player in players:
        player_name = player["name"]
        teams = [normalise_team_name(team) for team in player["teams"]]
        match_points_total = base_scores[player_name]
        bonus_points_total = bonus_by_player.get(player_name, 0)
        total_points = match_points_total + bonus_points_total

        leaderboard.append({
            "name": player_name,
            "teams": teams,
            "matchPoints": match_points_total,
            "bonusPoints": bonus_points_total,
            "points": total_points,
            "gamesPlayed": games_played[player_name],
            "goalsFor": goals_for[player_name],
            "goalsAgainst": goals_against[player_name],
            "goalDifference": goals_for[player_name] - goals_against[player_name],
        })

    leaderboard.sort(
        key=lambda x: (
            -x["points"],
            -x.get("goalDifference", 0),
            -x.get("goalsFor", 0),
            x.get("gamesPlayed", 0),
            x["name"],
        )
    )

    for index, row in enumerate(leaderboard, start=1):
        row["rank"] = index

    for row in leaderboard:
        previous = previous_by_name.get(row["name"])

        row["previousRank"] = None
        row["movement"] = 0
        row["movementDirection"] = "same"
        row["movementChangedAt"] = None
        row["showMovementUntil"] = None

        if not previous:
            continue

        previous_rank = previous.get("rank")
        current_rank = row.get("rank")

        if previous_rank is None or current_rank is None:
            continue

        rank_movement = previous_rank - current_rank

        if rank_movement != 0:
            row["previousRank"] = previous_rank
            row["movement"] = rank_movement
            row["movementDirection"] = movement_direction(rank_movement)
            row["movementChangedAt"] = now_iso
            row["showMovementUntil"] = show_until_iso
            continue

        if previous_movement_is_still_visible(previous, now):
            row["previousRank"] = previous.get("previousRank", previous_rank)
            row["movement"] = previous.get("movement", 0)
            row["movementDirection"] = previous.get(
                "movementDirection",
                movement_direction(previous.get("movement", 0))
            )
            row["movementChangedAt"] = previous.get("movementChangedAt")
            row["showMovementUntil"] = previous.get("showMovementUntil")
            continue

        row["previousRank"] = previous_rank
        row["movement"] = 0
        row["movementDirection"] = "same"
        row["movementChangedAt"] = None
        row["showMovementUntil"] = None

    return leaderboard


def build_player_details(players, matches, leaderboard):
    rank_by_player = {
        row["name"]: row.get("rank")
        for row in leaderboard
    }

    bonus_by_player = {
        row["name"]: row.get("bonusPoints", 0)
        for row in leaderboard
    }

    match_points_by_player = {
        row["name"]: row.get("matchPoints", row.get("points", 0))
        for row in leaderboard
    }

    details = []

    for player in players:
        player_name = player["name"]
        player_teams = [normalise_team_name(team) for team in player["teams"]]

        team_rows = []

        for team in player_teams:
            team_points = 0
            team_games = 0
            wins = 0
            draws = 0
            losses = 0
            goals_for = 0
            goals_against = 0
            recent_results = []

            for match in matches:
                results = match_points(match)

                if not results:
                    continue

                if not team_matches(team, match["team1"]) and not team_matches(team, match["team2"]):
                    continue

                team_games += 1

                if team_matches(team, match["team1"]):
                    team_score = match["score1"]
                    opponent_score = match["score2"]
                    opponent = match["team2"]
                else:
                    team_score = match["score2"]
                    opponent_score = match["score1"]
                    opponent = match["team1"]

                points = results.get(normalise_team_name(team), 0)
                team_points += points
                goals_for += team_score
                goals_against += opponent_score

                if points == 3:
                    wins += 1
                    result_label = "W"
                elif points == 1:
                    draws += 1
                    result_label = "D"
                else:
                    losses += 1
                    result_label = "L"

                recent_results.append({
                    "date": match.get("date"),
                    "opponent": opponent,
                    "scoreFor": team_score,
                    "scoreAgainst": opponent_score,
                    "result": result_label,
                    "points": points
                })

            recent_results.sort(key=lambda x: x.get("date") or "", reverse=True)

            team_rows.append({
                "team": team,
                "points": team_points,
                "gamesPlayed": team_games,
                "wins": wins,
                "draws": draws,
                "losses": losses,
                "goalsFor": goals_for,
                "goalsAgainst": goals_against,
                "recentResults": recent_results[:3]
            })

        total_match_points = match_points_by_player.get(player_name, 0)
        total_bonus_points = bonus_by_player.get(player_name, 0)
        total_points = total_match_points + total_bonus_points
        total_games = sum(team["gamesPlayed"] for team in team_rows)

        details.append({
            "name": player_name,
            "rank": rank_by_player.get(player_name),
            "points": total_points,
            "matchPoints": total_match_points,
            "bonusPoints": total_bonus_points,
            "gamesPlayed": total_games,
            "teams": team_rows
        })

    details.sort(key=lambda x: (x["rank"] if x["rank"] is not None else 999))

    return details


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


def build_match_players(players, match):
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

    return involved_players


def build_player_gains_for_match(players, match):
    results = match_points(match)
    player_gains = []

    if not results:
        return player_gains

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

    return player_gains


def build_upcoming_fixtures(players, matches, limit=12):
    now = datetime.now(timezone.utc)
    football_day_start, football_day_end = get_football_day_window(now)

    football_day_matches = []
    fallback_future_matches = []

    for match in matches:
        raw_date = match.get("date")

        if not raw_date:
            continue

        match_date = parse_datetime(raw_date)

        if not match_date:
            continue

        is_current_football_day = football_day_start <= match_date < football_day_end

        fixture_row = {
            "date": match.get("date"),
            "team1": match["team1"],
            "team2": match["team2"],
            "score1": match.get("score1"),
            "score2": match.get("score2"),
            "displayScore1": match.get("displayScore1"),
            "displayScore2": match.get("displayScore2"),
            "status": match.get("status"),
            "completed": bool(match.get("completed")),
            "live": bool(match.get("live")),
            "isToday": is_current_football_day,
            "footballDayStart": football_day_start.isoformat(),
            "footballDayEnd": football_day_end.isoformat(),
            "players": build_match_players(players, match),
            "playerGains": build_player_gains_for_match(players, match),
        }

        if is_current_football_day:
            football_day_matches.append(fixture_row)
        elif match_date >= football_day_end and not match.get("completed"):
            fallback_future_matches.append(fixture_row)

    football_day_matches.sort(key=lambda x: x.get("date") or "")
    fallback_future_matches.sort(key=lambda x: x.get("date") or "")

    if football_day_matches:
        return football_day_matches[:limit]

    return fallback_future_matches[:limit]



def owner_for_team(players, team_name):
    for player in players:
        for team in player.get("teams", []):
            if team_matches(team, team_name):
                return player.get("name")

    return None


def build_wooden_spoon_state(player_details):
    teams = []

    for player in player_details or []:
        for team in player.get("teams", []):
            goals_for = team.get("goalsFor", 0)
            goals_against = team.get("goalsAgainst", 0)

            teams.append({
                "owner": player.get("name"),
                "team": team.get("team"),
                "points": team.get("points", 0),
                "gamesPlayed": team.get("gamesPlayed", 0),
                "goalDifference": goals_for - goals_against,
                "goalsFor": goals_for,
            })

    teams.sort(key=lambda row: (
        row.get("points", 0),
        -row.get("gamesPlayed", 0),
        row.get("goalDifference", 0),
        row.get("goalsFor", 0),
        row.get("team") or "",
    ))

    return teams[0] if teams else None


def goal_owner_rows(players, rows, goal_key="goals"):
    if not rows:
        return []

    top_value = rows[0].get(goal_key, 0)
    leaders = [row for row in rows if row.get(goal_key, 0) == top_value and top_value]

    output = []
    seen = set()

    for row in leaders:
        team = row.get("team")
        owner = owner_for_team(players, team)
        key = (owner, team, row.get("player"))

        if key in seen:
            continue

        seen.add(key)
        output.append({
            "owner": owner,
            "team": team,
            "player": row.get("player"),
            "goals": row.get(goal_key, 0),
        })

    return output


def build_drama_state(players, leaderboard, player_details, bonus_data):
    leader = leaderboard[0] if leaderboard else None
    spoon = build_wooden_spoon_state(player_details)
    fastest = None

    fastest_goal = bonus_data.get("fastestGoal") if bonus_data else None
    if fastest_goal:
        fastest = {
            "owner": owner_for_team(players, fastest_goal.get("team")),
            "team": fastest_goal.get("team"),
            "player": fastest_goal.get("player"),
            "clockDisplay": fastest_goal.get("clockDisplay"),
            "clockSeconds": fastest_goal.get("clockSeconds"),
        }

    return {
        "leader": {
            "owner": leader.get("name"),
            "points": leader.get("points"),
            "rank": leader.get("rank"),
        } if leader else None,
        "woodenSpoon": spoon,
        "fastestGoal": fastest,
        "mostGoalsNation": goal_owner_rows(players, bonus_data.get("nationGoalTable", []) if bonus_data else []),
        "goldenBoot": goal_owner_rows(players, bonus_data.get("goldenBootRace", []) if bonus_data else []),
    }


def state_key(value, fields):
    if not value:
        return None

    return tuple(value.get(field) for field in fields)


def rows_key(rows):
    return sorted(
        tuple(row.get(field) for field in ("owner", "team", "player", "goals"))
        for row in rows or []
    )


def names_from_rows(rows):
    names = []

    for row in rows or []:
        owner = row.get("owner")
        team = row.get("team")
        if owner and team:
            names.append(f"{owner} ({team})")
        elif team:
            names.append(team)

    return ", ".join(names)


def drama_item(item_type, icon, label, title, text):
    return {
        "type": item_type,
        "icon": icon,
        "label": label,
        "title": title,
        "text": text,
    }



def player_total_wins(detail):
    return sum(int(team.get("wins", 0) or 0) for team in detail.get("teams", []))


def player_total_games(detail):
    return sum(int(team.get("gamesPlayed", 0) or 0) for team in detail.get("teams", []))


def stinker_drama_item(player_details):
    candidates = []

    for detail in player_details or []:
        games = player_total_games(detail)
        wins = player_total_wins(detail)
        points = int(detail.get("matchPoints", detail.get("points", 0)) or 0)

        if games > 0 and wins == 0:
            candidates.append({
                "name": detail.get("name"),
                "points": points,
                "rank": int(detail.get("rank", 999) or 999),
                "games": games,
                "teams": [team.get("team") for team in detail.get("teams", []) if team.get("team")],
            })

    if not candidates:
        return None

    candidates.sort(key=lambda row: (row["points"], -row["games"], -row["rank"]))
    player = candidates[0]
    teams = ", ".join(player["teams"]) if player["teams"] else "Their teams"

    return drama_item(
        "stinker",
        "😬",
        "Stinker watch",
        f"{player['name']} is having a stinker",
        f"{teams} have played {player['games']} matches without a win. That is a long old watch."
    )


def build_drama_feed(current_state, previous_state, leaderboard, latest_results, player_details=None):
    items = []

    previous_state = previous_state or {}

    current_leader = current_state.get("leader")
    previous_leader = previous_state.get("leader")
    if current_leader and previous_leader and current_leader.get("owner") != previous_leader.get("owner"):
        items.append(drama_item(
            "leader",
            "👑",
            "Top spot",
            f"{current_leader.get('owner')} takes the lead",
            f"{previous_leader.get('owner')} has been knocked off top spot. {current_leader.get('owner')} now leads on {current_leader.get('points')} pts."
        ))

    current_spoon = current_state.get("woodenSpoon")
    previous_spoon = previous_state.get("woodenSpoon")
    spoon_changed = (
        current_spoon and previous_spoon and
        state_key(current_spoon, ("owner", "team")) != state_key(previous_spoon, ("owner", "team"))
    )

    if spoon_changed:
        items.append(drama_item(
            "spoon",
            "🥄",
            "Spoon drama",
            f"{current_spoon.get('owner')} inherits the spoon",
            f"{current_spoon.get('team')} are now propping things up on {current_spoon.get('points')} pts with GD {current_spoon.get('goalDifference')}. Not the trophy anyone wants."
        ))

    current_fastest = current_state.get("fastestGoal")
    previous_fastest = previous_state.get("fastestGoal")
    if current_fastest and previous_fastest and state_key(current_fastest, ("owner", "team", "player", "clockSeconds")) != state_key(previous_fastest, ("owner", "team", "player", "clockSeconds")):
        items.append(drama_item(
            "fastest",
            "⚡",
            "Fastest goal",
            f"{current_fastest.get('owner')} grabs the lightning bolt",
            f"{current_fastest.get('player')} scored for {current_fastest.get('team')} after {current_fastest.get('clockDisplay')}. The £5 prize has a new target."
        ))

    current_most = current_state.get("mostGoalsNation") or []
    previous_most = previous_state.get("mostGoalsNation") or []
    if current_most and previous_most and rows_key(current_most) != rows_key(previous_most):
        top_goals = current_most[0].get("goals")
        items.append(drama_item(
            "goals",
            "⚽",
            "Most goals",
            "Most Goals badge has shifted",
            f"{names_from_rows(current_most)} now lead the nation scoring race on {top_goals} goals."
        ))

    current_boot = current_state.get("goldenBoot") or []
    previous_boot = previous_state.get("goldenBoot") or []
    if current_boot and previous_boot and rows_key(current_boot) != rows_key(previous_boot):
        top_goals = current_boot[0].get("goals")
        items.append(drama_item(
            "goals",
            "🥾",
            "Golden Boot",
            "Golden Boot race update",
            f"{names_from_rows(current_boot)} now control the Golden Boot badge on {top_goals} goals."
        ))

    movers = [row for row in leaderboard or [] if row.get("movement", 0) >= 4]
    movers.sort(key=lambda row: row.get("movement", 0), reverse=True)
    if movers:
        top_mover = movers[0]
        items.append(drama_item(
            "mover",
            "📈",
            "Big mover",
            f"{top_mover.get('name')} storms up {top_mover.get('movement')} places",
            f"That is the biggest climb showing on the leaderboard right now."
        ))

    if current_spoon and not any(item.get("type") == "spoon" for item in items):
        items.append(drama_item(
            "spoon",
            "🥄",
            "Spoon watch",
            f"{current_spoon.get('owner')} has the spoon",
            f"{current_spoon.get('team')} are bottom of the pile on {current_spoon.get('points')} pts with GD {current_spoon.get('goalDifference')}."
        ))

    stinker = stinker_drama_item(player_details or [])
    if stinker and not any(item.get("type") == "stinker" for item in items):
        items.append(stinker)

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "items": items[:5],
        "state": current_state,
    }

def previous_drama_state_from_history():
    history = load(HISTORY_FILE, default=[])

    for snapshot in reversed(history or []):
        state = snapshot.get("dramaState")
        if state:
            return state

    return None


def update_history(leaderboard, drama_state=None):
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
        previous_drama_state = history[-1].get("dramaState")

        previous_simple = [
            {
                "name": row.get("name"),
                "points": row.get("points"),
                "rank": row.get("rank"),
            }
            for row in previous_players
        ]

        if previous_simple == snapshot_players and previous_drama_state == drama_state:
            save(HISTORY_FILE, history)
            return

    snapshot = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "players": snapshot_players,
        "dramaState": drama_state,
    }

    history.append(snapshot)
    history = history[-300:]

    save(HISTORY_FILE, history)


def build_status(matches):
    completed = [
        m for m in matches
        if m.get("score1") is not None and m.get("score2") is not None
    ]

    football_day_start, football_day_end = get_football_day_window()

    return {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "completedMatches": len(completed),
        "totalTournamentMatches": TOTAL_TOURNAMENT_MATCHES,
        "matchesFetchedFromEspn": len(matches),
        "source": "ESPN public scoreboard",
        "footballDayStart": football_day_start.isoformat(),
        "footballDayEnd": football_day_end.isoformat(),
        "footballDayTimezone": "Europe/London",
    }


if __name__ == "__main__":
    players = load(PLAYERS_FILE, default=[])
    previous_leaderboard = load(LEADERBOARD_FILE, default=[])

    matches = fetch_matches()
    bonus_data = build_bonus_points(players, matches)
    leaderboard = calculate(players, matches, previous_leaderboard, bonus_data)
    latest_results = build_latest_results(players, matches)
    upcoming_fixtures = build_upcoming_fixtures(players, matches)
    player_details = build_player_details(players, matches, leaderboard)
    status = build_status(matches)
    previous_drama_state = previous_drama_state_from_history()
    drama_state = build_drama_state(players, leaderboard, player_details, bonus_data)
    drama_feed = build_drama_feed(drama_state, previous_drama_state, leaderboard, latest_results, player_details)

    save(MATCHES_FILE, matches)
    save(BONUS_POINTS_FILE, bonus_data)
    save(LEADERBOARD_FILE, leaderboard)
    save(LATEST_RESULTS_FILE, latest_results)
    save(UPCOMING_FIXTURES_FILE, upcoming_fixtures)
    save(PLAYER_DETAILS_FILE, player_details)
    save(STATUS_FILE, status)
    save(DRAMA_FEED_FILE, drama_feed)
    update_history(leaderboard, drama_state)

    print("Updated dashboard data")
