"""Update dashboard data.

This wrapper patches the knockout stage detection before running the scorer.

Why this is needed:
ESPN fixture dates are UTC, while the bracket page displays the local North
American fixture day. Late Round of 32 games such as Colombia v Ghana can fall
on 4 July in UTC, even though ESPN's bracket correctly treats them as 3 July
Round of 32 fixtures.

This version adds the repository root to sys.path first, so it works when
GitHub Actions runs `python scripts/update.py`.
"""

from datetime import date
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

# When GitHub runs `python scripts/update.py`, Python starts with /scripts on
# sys.path. Add the repo root so `import engine.scorer` works.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import engine.scorer as scorer


BRACKET_DAY_TIMEZONE = ZoneInfo("America/New_York")


def knockout_stage_by_date(match):
    match_date = scorer.parse_datetime(match.get("date"))

    if not match_date:
        return None

    # Use the bracket/event day, not the UTC calendar day. This stops late
    # North American Round of 32 games from being misclassified as Round of 16.
    day = match_date.astimezone(BRACKET_DAY_TIMEZONE).date()

    if date(2026, 6, 28) <= day <= date(2026, 7, 3):
        return "round_of_32"

    if date(2026, 7, 4) <= day <= date(2026, 7, 7):
        return "round_of_16"

    if date(2026, 7, 9) <= day <= date(2026, 7, 12):
        return "quarter_final"

    if date(2026, 7, 14) <= day <= date(2026, 7, 15):
        return "semi_final"

    if day == date(2026, 7, 18):
        return "third_place"

    if day == date(2026, 7, 19):
        return "final"

    return None


def get_match_stage(match):
    raw = match.get("raw", {}) or {}
    competition = (raw.get("competitions") or [{}])[0]

    values = [
        str((raw.get("season") or {}).get("slug", "")),
        str(raw.get("name", "")),
        str(match.get("name", "")),
        str(match.get("shortName", "")),
        str(competition.get("altGameNote", "")),
        str(competition.get("note", "")),
        str(competition.get("type", {}).get("text", "")),
        str(competition.get("type", {}).get("abbreviation", "")),
    ]

    text = " ".join(values).lower()

    # Trust explicit ESPN/bracket labels first.
    if "group" in text:
        return "group"

    if "3rd-place" in text or "third-place" in text or "3rd place" in text:
        return "third_place"

    if "semi" in text:
        return "semi_final"

    if "quarter" in text:
        return "quarter_final"

    if "round of 16" in text or "round-of-16" in text or "rd of 16" in text:
        return "round_of_16"

    if "round of 32" in text or "round-of-32" in text or "rd of 32" in text:
        return "round_of_32"

    if "final" in text:
        return "final"

    date_stage = knockout_stage_by_date(match)
    if date_stage:
        return date_stage

    return "unknown"


# Patch scorer module functions used by match_winner, build_bonus_points,
# build_knockout_tracker and the rest of the update run.
scorer.knockout_stage_by_date = knockout_stage_by_date
scorer.get_match_stage = get_match_stage


if __name__ == "__main__":
    players = scorer.load(scorer.PLAYERS_FILE, default=[])
    previous_leaderboard = scorer.load(scorer.LEADERBOARD_FILE, default=[])

    matches = scorer.fetch_matches()
    bonus_data = scorer.build_bonus_points(players, matches)
    leaderboard = scorer.calculate(players, matches, previous_leaderboard, bonus_data)
    latest_results = scorer.build_latest_results(players, matches)
    upcoming_fixtures = scorer.build_upcoming_fixtures(players, matches)
    player_details = scorer.build_player_details(players, matches, leaderboard)
    status = scorer.build_status(matches)
    previous_drama_state = scorer.previous_drama_state_from_history()
    drama_state = scorer.build_drama_state(players, leaderboard, player_details, bonus_data)
    drama_feed = scorer.build_drama_feed(
        drama_state,
        previous_drama_state,
        leaderboard,
        latest_results,
        player_details,
    )

    scorer.save(scorer.MATCHES_FILE, matches)
    scorer.save(scorer.BONUS_POINTS_FILE, bonus_data)
    scorer.save(scorer.KNOCKOUT_TRACKER_FILE, bonus_data.get("knockoutTracker", {}))
    scorer.save(scorer.LEADERBOARD_FILE, leaderboard)
    scorer.save(scorer.LATEST_RESULTS_FILE, latest_results)
    scorer.save(scorer.UPCOMING_FIXTURES_FILE, upcoming_fixtures)
    scorer.save(scorer.PLAYER_DETAILS_FILE, player_details)
    scorer.save(scorer.STATUS_FILE, status)
    scorer.save(scorer.DRAMA_FEED_FILE, drama_feed)
    scorer.update_history(leaderboard, drama_state)

    print("Updated dashboard data")
