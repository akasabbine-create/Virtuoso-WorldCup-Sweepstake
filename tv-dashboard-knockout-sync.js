(function () {
  const SYNC_DELAY_MS = 800;

  function norm(value) {
    const raw = typeof value === "object" && value !== null
      ? (value.team || value.name || value.displayName || value.shortDisplayName || "")
      : value;

    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[’']/g, "")
      .replace(/\s+/g, " ");
  }

  function isPlaceholder(name) {
    return !name || /TBD|Winner|Loser|Group .*Place|Group .*Winner|Group .*2nd Place|Third Place/i.test(String(name));
  }

  function stageKey(match) {
    const slug = match?.raw?.season?.slug || match?.stage || "";
    const map = {
      "round-of-32": "round_of_32",
      "round-of-16": "round_of_16",
      quarterfinals: "quarter_final",
      semifinals: "semi_final",
      final: "final",
      "3rd-place-match": "third_place"
    };
    return map[slug] || slug;
  }

  function stageLabel(match) {
    const labels = {
      round_of_32: "Round of 32",
      round_of_16: "Round of 16",
      quarter_final: "Quarter-final",
      semi_final: "Semi-final",
      final: "Final",
      third_place: "Third place"
    };
    return labels[stageKey(match)] || "Knockout";
  }

  function isKnockout(match) {
    return ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final", "third_place"].includes(stageKey(match));
  }

  function matchComplete(match) {
    return Boolean(match?.completed || match?.raw?.status?.type?.completed);
  }

  function matchInvolves(match, teamName) {
    const target = norm(teamName);
    return [match?.team1, match?.team2].some(team => norm(team) === target);
  }

  function rawCompetitor(match, teamName) {
    const target = norm(teamName);
    const competitors = match?.raw?.competitions?.[0]?.competitors || [];

    return competitors.find(competitor => norm(
      competitor?.team?.displayName
      || competitor?.team?.shortDisplayName
      || competitor?.team?.name
    ) === target) || null;
  }

  function scoreForTeam(match, teamName) {
    const target = norm(teamName);
    const teamIsOne = norm(match?.team1) === target;
    const teamIsTwo = norm(match?.team2) === target;

    if (!teamIsOne && !teamIsTwo) return null;

    const scoreFor = Number(teamIsOne ? match.score1 : match.score2);
    const scoreAgainst = Number(teamIsOne ? match.score2 : match.score1);

    if (!Number.isFinite(scoreFor) || !Number.isFinite(scoreAgainst)) return null;
    return { scoreFor, scoreAgainst };
  }

  function teamLost(match, teamName) {
    const competitor = rawCompetitor(match, teamName);

    if (isKnockout(match) && competitor) {
      if (competitor.winner === false || competitor.advance === false) return true;
      if (competitor.winner === true || competitor.advance === true) return false;
    }

    const score = scoreForTeam(match, teamName);
    return Boolean(score && score.scoreFor < score.scoreAgainst);
  }

  function teamHasKnockoutBonus(teamName, bonusData) {
    const rows = bonusData?.knockoutTracker?.rows || bonusData?.rows || [];
    return rows.some(row => norm(row.team) === norm(teamName) && Number(row.total || 0) > 0);
  }

  function ownedTeams(leaderboard, playerDetails) {
    const teams = new Map();

    (leaderboard || []).forEach(player => {
      (player.teams || []).forEach(team => {
        teams.set(norm(team), { playerName: player.name, team });
      });
    });

    (playerDetails || []).forEach(player => {
      (player.teams || []).forEach(team => {
        teams.set(norm(team.team), { playerName: player.name, team: team.team });
      });
    });

    return teams;
  }

  function buildStatusLookup(leaderboard, playerDetails, bonusData, matches) {
    const lookup = new Map();

    ownedTeams(leaderboard, playerDetails).forEach((owned, key) => {
      const teamMatches = (matches || [])
        .filter(match => matchInvolves(match, owned.team))
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      const completed = teamMatches.filter(matchComplete);
      const future = teamMatches.filter(match =>
        !matchComplete(match) && !isPlaceholder(match.team1) && !isPlaceholder(match.team2)
      );
      const knockoutLoss = [...completed].reverse().find(match => isKnockout(match) && teamLost(match, owned.team));
      const latestCompleted = completed[completed.length - 1];
      const hasBonus = teamHasKnockoutBonus(owned.team, bonusData);
      const eliminated = Boolean(knockoutLoss || (!hasBonus && future.length === 0 && latestCompleted));

      lookup.set(key, {
        ...owned,
        eliminated,
        stage: knockoutLoss ? stageLabel(knockoutLoss) : "Group stage"
      });
    });

    return lookup;
  }

  function teamText(element) {
    return element.querySelector(".team-name-text")?.textContent || element.textContent || "";
  }

  function markEliminatedTeams(lookup) {
    document.querySelectorAll(".team-name").forEach(element => {
      const status = lookup.get(norm(teamText(element)));
      if (status?.eliminated) {
        element.classList.add("knocked-out-team", "tv-knocked-out-team");
        element.title = `Knocked out: ${status.stage}`;
      }
    });
  }

  function markEliminatedPlayers(leaderboard, lookup) {
    document.querySelectorAll(".tv-leaderboard-table tbody tr").forEach(row => {
      const playerName = row.querySelector(".tv-player-cell")?.textContent?.trim();
      const player = (leaderboard || []).find(item => item.name === playerName);
      const teams = player?.teams || [];

      if (teams.length && teams.every(team => lookup.get(norm(team))?.eliminated)) {
        row.classList.add("player-eliminated-row", "tv-player-eliminated-row");
      }
    });
  }

  function updateWoodenSpoonPanel(playerDetails) {
    const bottomTeam = window.sortWoodenSpoonTeams && window.flattenPlayerTeams
      ? window.sortWoodenSpoonTeams(window.flattenPlayerTeams(playerDetails || []))[0]
      : null;

    if (!bottomTeam || norm(bottomTeam.playerName) !== "phillipa") return;

    const current = document.querySelector(".tv-spoon-list li.is-current em");
    if (current) {
      current.textContent = "Confirmed wooden spoon winner · £5 prize";
    }
  }

  async function syncTvKnockoutDisplay() {
    try {
      const [leaderboard, playerDetails, bonusData, matches] = await Promise.all([
        loadJson("data/leaderboard.json"),
        loadJson("data/player_details.json"),
        loadJson("data/bonus_points.json"),
        loadJson("data/matches.json")
      ]);
      const rankedLeaderboard = window.rankLeaderboardByTieBreakers(
        window.addGoalDifferenceToLeaderboard(leaderboard, playerDetails)
      );
      const lookup = buildStatusLookup(rankedLeaderboard, playerDetails, bonusData, matches);

      markEliminatedTeams(lookup);
      markEliminatedPlayers(rankedLeaderboard, lookup);
      updateWoodenSpoonPanel(playerDetails);
    } catch (error) {
      console.warn("TV knockout display sync failed", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.setTimeout(syncTvKnockoutDisplay, SYNC_DELAY_MS));
  } else {
    window.setTimeout(syncTvKnockoutDisplay, SYNC_DELAY_MS);
  }
}());
