const cacheBust = Date.now();

async function loadJson(path) {
  const response = await fetch(`${path}?ts=${cacheBust}`);

  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }

  return response.json();
}

function formatDateTime(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function movementIcon(movement) {
  if (movement > 0) {
    return `<span class="movement up">▲ ${movement}</span>`;
  }

  if (movement < 0) {
    return `<span class="movement down">▼ ${Math.abs(movement)}</span>`;
  }

  return `<span class="movement same">—</span>`;
}

function medal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

function goalDifference(team) {
  return (team.goalsFor ?? 0) - (team.goalsAgainst ?? 0);
}

function findWoodenSpoonTeam(playerDetails) {
  const allTeams = [];

  (playerDetails || []).forEach(player => {
    (player.teams || []).forEach(team => {
      allTeams.push({
        playerName: player.name,
        team: team.team,
        points: team.points ?? 0,
        gamesPlayed: team.gamesPlayed ?? 0,
        wins: team.wins ?? 0,
        draws: team.draws ?? 0,
        losses: team.losses ?? 0,
        goalsFor: team.goalsFor ?? 0,
        goalsAgainst: team.goalsAgainst ?? 0,
        goalDifference: goalDifference(team)
      });
    });
  });

  if (allTeams.length === 0) {
    return null;
  }

  allTeams.sort((a, b) => {
    if (a.points !== b.points) {
      return a.points - b.points;
    }

    if (a.gamesPlayed !== b.gamesPlayed) {
      return b.gamesPlayed - a.gamesPlayed;
    }

    if (a.goalDifference !== b.goalDifference) {
      return a.goalDifference - b.goalDifference;
    }

    if (a.goalsFor !== b.goalsFor) {
      return a.goalsFor - b.goalsFor;
    }

    return a.team.localeCompare(b.team);
  });

  return allTeams[0];
}

function renderStatus(status) {
  const statusEl = document.querySelector("#status");
  const completedEl = document.querySelector("#completed-matches");

  if (!statusEl || !completedEl) return;

  statusEl.innerHTML = `
    <strong>Last updated:</strong> ${formatDateTime(status.lastUpdated)}
    <br />
    <strong>Source:</strong> ${status.source || "ESPN public scoreboard"}
    <br />
    <strong>ESPN fixtures fetched:</strong> ${status.matchesFetchedFromEspn ?? "Unknown"}
  `;

  const completed = status.completedMatches ?? 0;
  const total = status.totalTournamentMatches ?? 104;

  completedEl.textContent = `${completed} of ${total}`;
}

function renderSummaryCards(leaderboard, playerDetails) {
  const leaderEl = document.querySelector("#current-leader");
  const spoonEl = document.querySelector("#wooden-spoon");

  if (!leaderEl || !spoonEl) return;

  const leader = leaderboard[0];
  const spoonTeam = findWoodenSpoonTeam(playerDetails);

  leaderEl.textContent = leader
    ? `${leader.name} — ${leader.points} pts`
    : "No data";

  if (!spoonTeam) {
    spoonEl.textContent = "No data";
    return;
  }

  spoonEl.innerHTML = `
    ${spoonTeam.playerName} — ${spoonTeam.team}
    <br />
    <span class="small-card-text">
      ${spoonTeam.points} pts, ${spoonTeam.gamesPlayed} played, GD ${spoonTeam.goalDifference}
    </span>
  `;
}

function renderLeaderboard(data) {
  const tbody = document.querySelector("#board tbody");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">No leaderboard data found.</td>
      </tr>
    `;
    return;
  }

  data.forEach(player => {
    const tr = document.createElement("tr");

    if (player.rank === 1) {
      tr.classList.add("leader");
    }

    if (player.rank <= 3) {
      tr.classList.add("top-three");
    }

    const teams = (player.teams || []).join(", ");

    tr.innerHTML = `
      <td>${medal(player.rank)} ${player.rank}</td>
      <td>${movementIcon(player.movement || 0)}</td>
      <td>${player.name}</td>
      <td>${teams}</td>
      <td>${player.gamesPlayed ?? 0}</td>
      <td><strong>${player.points}</strong></td>
    `;

    tbody.appendChild(tr);
  });
}

function renderPlayerDetails(details) {
  const container = document.querySelector("#player-details");

  if (!container) return;

  container.innerHTML = "";

  if (!details || details.length === 0) {
    container.innerHTML = `<p>No player breakdown available yet.</p>`;
    return;
  }

  details.forEach(player => {
    const card = document.createElement("div");
    card.className = "player-card";

    const teams = (player.teams || []).map(team => {
      const recentResults = team.recentResults && team.recentResults.length > 0
        ? team.recentResults.map(result => `
            <li>
              ${result.result}: ${team.team} ${result.scoreFor}–${result.scoreAgainst} ${result.opponent}
              (${result.points} pts)
            </li>
          `).join("")
        : `<li>No completed matches yet</li>`;

      return `
        <div class="team-breakdown">
          <div class="team-breakdown-header">
            <strong>${team.team}</strong>
            <span>${team.points} pts</span>
          </div>

          <div class="team-stats">
            Played ${team.gamesPlayed} · W${team.wins} D${team.draws} L${team.losses}
            · GF ${team.goalsFor} GA ${team.goalsAgainst}
          </div>

          <ul>${recentResults}</ul>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="player-card-header">
        <h3>${medal(player.rank)} ${player.name}</h3>
        <strong>${player.points} pts</strong>
      </div>

      <p class="player-card-subtitle">
        Rank ${player.rank} · ${player.gamesPlayed} games played
      </p>

      ${teams}
    `;

    container.appendChild(card);
  });
}

function renderUpcomingFixtures(fixtures) {
  const container = document.querySelector("#upcoming-fixtures");

  if (!container) return;

  container.innerHTML = "";

  if (!fixtures || fixtures.length === 0) {
    container.innerHTML = `<p>No upcoming fixtures found.</p>`;
    return;
  }

  fixtures.forEach(match => {
    const card = document.createElement("div");
    card.className = "fixture-card";

    const players = match.players && match.players.length > 0
      ? match.players.map(player => {
          const teams = (player.teams || []).join(", ");
          return `<li>${player.name}: ${teams}</li>`;
        }).join("")
      : `<li>No sweepstake players involved</li>`;

    card.innerHTML = `
      <h3>${match.team1} v ${match.team2}</h3>
      <p>${formatDateTime(match.date)}</p>
      <ul>${players}</ul>
    `;

    container.appendChild(card);
  });
}

function renderLatestResults(results) {
  const container = document.querySelector("#latest-results");

  if (!container) return;

  container.innerHTML = "";

  if (!results || results.length === 0) {
    container.innerHTML = `<p>No completed results yet.</p>`;
    return;
  }

  results.forEach(match => {
    const card = document.createElement("div");
    card.className = "result-card";

    const gains = match.playerGains && match.playerGains.length > 0
      ? match.playerGains.map(gain => `
          <li>${gain.name} +${gain.points}</li>
        `).join("")
      : `<li>No player gained points</li>`;

    card.innerHTML = `
      <h3>${match.team1} ${match.score1}–${match.score2} ${match.team2}</h3>
      <p>${formatDateTime(match.date)}</p>
      <ul>${gains}</ul>
    `;

    container.appendChild(card);
  });
}

async function init() {
  let leaderboard = [];
  let playerDetails = [];

  try {
    leaderboard = await loadJson("data/leaderboard.json");
    renderLeaderboard(leaderboard);
  } catch (error) {
    console.error(error);

    const tbody = document.querySelector("#board tbody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">Could not load leaderboard data.</td>
        </tr>
      `;
    }
  }

  try {
    playerDetails = await loadJson("data/player_details.json");
    renderPlayerDetails(playerDetails);
  } catch (error) {
    console.error(error);

    const playerDetailsEl = document.querySelector("#player-details");

    if (playerDetailsEl) {
      playerDetailsEl.textContent = "Player breakdown not available yet.";
    }
  }

  renderSummaryCards(leaderboard, playerDetails);

  try {
    const status = await loadJson("data/status.json");
    renderStatus(status);
  } catch (error) {
    console.error(error);

    const statusEl = document.querySelector("#status");

    if (statusEl) {
      statusEl.textContent = "Update status not available yet.";
    }
  }

  try {
    const upcomingFixtures = await loadJson("data/upcoming_fixtures.json");
    renderUpcomingFixtures(upcomingFixtures);
  } catch (error) {
    console.error(error);

    const upcomingEl = document.querySelector("#upcoming-fixtures");

    if (upcomingEl) {
      upcomingEl.textContent = "Upcoming fixtures not available yet.";
    }
  }

  try {
    const latestResults = await loadJson("data/latest_results.json");
    renderLatestResults(latestResults);
  } catch (error) {
    console.error(error);

    const latestEl = document.querySelector("#latest-results");

    if (latestEl) {
      latestEl.textContent = "Latest results not available yet.";
    }
  }
}

init();
