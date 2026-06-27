(function () {
  const MAX_WAIT_MS = 10000;

  function htmlEscape(value) {
    if (typeof escapeHtml === "function") {
      return escapeHtml(value);
    }

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function waitForMoverRows() {
    return new Promise(resolve => {
      const started = Date.now();

      function check() {
        const rows = Array.from(document.querySelectorAll(".tv-mover-row"));

        if (rows.length || Date.now() - started > MAX_WAIT_MS) {
          resolve(rows);
          return;
        }

        window.setTimeout(check, 150);
      }

      check();
    });
  }

  function playerNameFromRow(row) {
    return row.querySelector("span")?.textContent?.trim() || "";
  }

  function playerByName(leaderboard) {
    return new Map((leaderboard || []).map(player => [normalize(player.name), player]));
  }

  function playerGain(match, playerName) {
    return (match.playerGains || []).find(gain => normalize(gain.name) === normalize(playerName));
  }

  function playerOwnsMatchTeam(player, match) {
    const teams = new Set((player?.teams || []).map(normalize));

    if (teams.has(normalize(match.team1))) return match.team1;
    if (teams.has(normalize(match.team2))) return match.team2;

    return "";
  }

  function scoreFromTeam(match, team) {
    if (normalize(team) === normalize(match.team1)) {
      return `${match.score1}-${match.score2}`;
    }

    if (normalize(team) === normalize(match.team2)) {
      return `${match.score2}-${match.score1}`;
    }

    return `${match.score1}-${match.score2}`;
  }

  function opponentForTeam(match, team) {
    if (normalize(team) === normalize(match.team1)) return match.team2;
    if (normalize(team) === normalize(match.team2)) return match.team1;
    return "";
  }

  function resultVerb(points) {
    if (Number(points) === 3) return "beat";
    if (Number(points) === 1) return "drew with";
    return "earned points against";
  }

  function describeGain(playerName, match, leaderboardByName) {
    const gain = playerGain(match, playerName);
    const player = leaderboardByName.get(normalize(playerName));
    const team = playerOwnsMatchTeam(player, match);
    const points = Number(gain?.points ?? 0);

    if (team) {
      const opponent = opponentForTeam(match, team);
      return `${team} ${resultVerb(points)} ${opponent} ${scoreFromTeam(match, team)} (+${points} pts)`;
    }

    return `${match.team1} ${match.score1}-${match.score2} ${match.team2} (+${points} pts)`;
  }

  function latestGainForPlayer(playerName, latestResults) {
    return (latestResults || []).find(match => playerGain(match, playerName));
  }

  function upwardCause(playerName, latestResults, leaderboardByName) {
    const match = latestGainForPlayer(playerName, latestResults);

    if (!match) {
      return "Moved on goal difference and recent tiebreakers";
    }

    return describeGain(playerName, match, leaderboardByName);
  }

  function downwardCause(playerName, latestResults, leaderboardByName) {
    const passingResult = (latestResults || []).find(match =>
      (match.playerGains || []).some(gain => normalize(gain.name) !== normalize(playerName))
    );

    if (!passingResult) {
      return "Other results changed the ranking order";
    }

    const gain = (passingResult.playerGains || [])
      .find(candidate => normalize(candidate.name) !== normalize(playerName));

    if (!gain) {
      return "Other results changed the ranking order";
    }

    return `Passed by ${gain.name}: ${describeGain(gain.name, passingResult, leaderboardByName)}`;
  }

  function rowMovement(row) {
    const text = row.querySelector("strong")?.textContent || "";
    return text.includes("▲") ? "up" : text.includes("▼") ? "down" : "";
  }

  function addReason(row, reason) {
    const existing = row.querySelector(".tv-mover-reason");

    if (existing) {
      existing.textContent = reason;
      return;
    }

    row.insertAdjacentHTML(
      "beforeend",
      `<small class="tv-mover-reason">${htmlEscape(reason)}</small>`
    );
  }

  async function initMoverReasons() {
    if (typeof loadJson !== "function") return;

    const rows = await waitForMoverRows();
    if (!rows.length) return;

    const [leaderboard, latestResults] = await Promise.all([
      loadJson("data/leaderboard.json"),
      loadJson("data/latest_results.json")
    ]);
    const leaderboardByName = playerByName(leaderboard);

    rows.forEach(row => {
      const playerName = playerNameFromRow(row);
      const direction = rowMovement(row);
      const reason = direction === "up"
        ? upwardCause(playerName, latestResults, leaderboardByName)
        : downwardCause(playerName, latestResults, leaderboardByName);

      addReason(row, reason);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMoverReasons);
  } else {
    initMoverReasons();
  }
}());
