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

function normaliseText(value) {
  return String(value || "").trim().toLowerCase();
}

function playerOwnsTeam(player, teamName) {
  const target = normaliseText(teamName);

  return (player.teams || []).some(team => normaliseText(team) === target);
}

function flattenPlayerTeams(playerDetails) {
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

  return allTeams;
}

function sortWoodenSpoonTeams(teams) {
  return [...teams].sort((a, b) => {
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
}

function findWoodenSpoonTeam(playerDetails) {
  const allTeams = flattenPlayerTeams(playerDetails);

  if (allTeams.length === 0) {
    return null;
  }

  return sortWoodenSpoonTeams(allTeams)[0];
}

function findCurrentBadgeHolders(leaderboard, playerDetails, bonusData) {
  const badgesByPlayer = {};

  (leaderboard || []).forEach(player => {
    badgesByPlayer[player.name] = [];
  });

  const spoonTeam = findWoodenSpoonTeam(playerDetails);

  if (spoonTeam && badgesByPlayer[spoonTeam.playerName]) {
    badgesByPlayer[spoonTeam.playerName].push({
      icon: "🥄",
      label: `Wooden Spoon: ${spoonTeam.team}`
    });
  }

  const goldenBootRace = bonusData?.goldenBootRace || [];

  if (goldenBootRace.length > 0) {
    const topGoals = goldenBootRace[0].goals;
    const topScorers = goldenBootRace.filter(item => item.goals === topGoals);

    topScorers.forEach(scorer => {
      (leaderboard || []).forEach(player => {
        if (playerOwnsTeam(player, scorer.team)) {
          badgesByPlayer[player.name].push({
            icon: "🥾",
            label: `Golden Boot race: ${scorer.player} (${scorer.team})`
          });
        }
      });
    });
  }

  const nationGoalTable = bonusData?.nationGoalTable || [];

  if (nationGoalTable.length > 0) {
    const topNationGoals = nationGoalTable[0].goals;
    const topNations = nationGoalTable.filter(item => item.goals === topNationGoals);

    topNations.forEach(nation => {
      (leaderboard || []).forEach(player => {
        if (playerOwnsTeam(player, nation.team)) {
          badgesByPlayer[player.name].push({
            icon: "⚽",
            label: `Most goals by nation: ${nation.team}`
          });
        }
      });
    });
  }

  const fastestGoal = bonusData?.fastestGoal;

  if (fastestGoal && fastestGoal.team) {
    (leaderboard || []).forEach(player => {
      if (playerOwnsTeam(player, fastestGoal.team)) {
        badgesByPlayer[player.name].push({
          icon: "⚡",
          label: `Fastest goal prize: ${fastestGoal.player} (${fastestGoal.team})`
        });
      }
    });
  }

  return {
    spoonTeam,
    badgesByPlayer
  };
}

function badgeHtml(badges) {
  if (!badges || badges.length === 0) {
    return `<span class="badge-empty">—</span>`;
  }

  return badges.map(badge => `
    <span class="badge-icon" title="${badge.label}" aria-label="${badge.label}">
      ${badge.icon}
    </span>
  `).join("");
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

function renderLeaderboard(data, spoonTeam, badgesByPlayer) {
  const tbody = document.querySelector("#board tbody");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">No leaderboard data found.</td>
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

    const isWoodenSpoonHolder = spoonTeam && player.name === spoonTeam.playerName;
    const playerName = isWoodenSpoonHolder
      ? `🥄 ${player.name}`
      : player.name;

    const teams = (player.teams || []).map(team => {
      if (spoonTeam && player.name === spoonTeam.playerName && team === spoonTeam.team) {
        return `🥄 ${team}`;
      }

      return team;
    }).join(", ");

    tr.innerHTML = `
      <td>${medal(player.rank)} ${player.rank}</td>
      <td>${movementIcon(player.movement || 0)}</td>
      <td class="badge-cell">${badgeHtml(badgesByPlayer[player.name])}</td>
      <td>${playerName}</td>
      <td>${teams}</td>
      <td>${player.gamesPlayed ?? 0}</td>
      <td>${player.matchPoints ?? player.points ?? 0}</td>
      <td>${player.bonusPoints ?? 0}</td>
      <td><strong>${player.points ?? 0}</strong></td>
    `;

    tbody.appendChild(tr);
  });
}

function renderBonusTracker(bonusData, leaderboard) {
  const container = document.querySelector("#bonus-tracker");

  if (!container) return;

  container.innerHTML = "";

  if (!bonusData) {
    container.innerHTML = `<p>No bonus data available yet.</p>`;
    return;
  }

  const awarded = [];

  (bonusData.playerBonuses || []).forEach(player => {
    (player.items || []).forEach(item => {
      if (item.status === "awarded" && item.points > 0) {
        awarded.push({
          player: player.name,
          ...item
        });
      }
    });
  });

  const awardedHtml = awarded.length > 0
    ? awarded.map(item => `
        <li>
          <strong>${item.player}</strong>: +${item.points}
          ${item.label} — ${item.team}
          <br />
          <span>${item.reason}</span>
        </li>
      `).join("")
    : `<li>No bonus points awarded yet.</li>`;

  const goldenBootHtml = (bonusData.goldenBootRace || []).slice(0, 5).map(item => {
    const owners = (leaderboard || [])
      .filter(player => playerOwnsTeam(player, item.team))
      .map(player => player.name)
      .join(", ");

    return `
      <li>
        ${item.player} (${item.team}) — ${item.goals} goals
        ${owners ? `<br /><span>Current owner: ${owners}</span>` : ""}
      </li>
    `;
  }).join("") || `<li>No goals tracked yet.</li>`;

  const nationGoalsHtml = (bonusData.nationGoalTable || []).slice(0, 5).map(item => {
    const owners = (leaderboard || [])
      .filter(player => playerOwnsTeam(player, item.team))
      .map(player => player.name)
      .join(", ");

    return `
      <li>
        ${item.team} — ${item.goals} goals
        ${owners ? `<br /><span>Current owner: ${owners}</span>` : ""}
      </li>
    `;
  }).join("") || `<li>No nation goal data yet.</li>`;

  const fastestGoal = bonusData.fastestGoal
    ? `
      <p>
        <strong>${bonusData.fastestGoal.player}</strong>
        (${bonusData.fastestGoal.team}) —
        ${bonusData.fastestGoal.clockDisplay}
        <br />
        ${bonusData.fastestGoal.match}
      </p>
    `
    : `<p>No fastest goal tracked yet.</p>`;

  container.innerHTML = `
    <div class="bonus-card">
      <h3>Awarded Bonus Points</h3>
      <ul>${awardedHtml}</ul>
    </div>

    <div class="bonus-card">
      <h3>🥾 Golden Boot Race</h3>
      <ul>${goldenBootHtml}</ul>
      <p class="bonus-note">
        Badge shown for current race leader owner. +5 points awarded at the end of the tournament.
      </p>
    </div>

    <div class="bonus-card">
      <h3>⚽ Most Goals by Nation</h3>
      <ul>${nationGoalsHtml}</ul>
      <p class="bonus-note">
        Badge shown for current top nation owner. +5 points awarded at the end of the tournament.
      </p>
    </div>

    <div class="bonus-card">
      <h3>⚡ Fastest Goal Prize</h3>
      ${fastestGoal}
      <p class="bonus-note">
        Prize only. No leaderboard points.
      </p>
    </div>
  `;
}

function renderWoodenSpoonRace(playerDetails) {
  const container = document.querySelector("#wooden-spoon-race");

  if (!container) return;

  container.innerHTML = "";

  const allTeams = flattenPlayerTeams(playerDetails);
  const sortedTeams = sortWoodenSpoonTeams(allTeams).slice(0, 5);

  if (sortedTeams.length === 0) {
    container.innerHTML = `<p>No wooden spoon data available yet.</p>`;
    return;
  }

  sortedTeams.forEach((team, index) => {
    const card = document.createElement("div");
    card.className = "spoon-race-card";

    if (index === 0) {
      card.classList.add("current-spoon");
    }

    const positionLabel = index === 0 ? "Current spoon" : `Race position ${index + 1}`;
    const icon = index === 0 ? "🥄" : "⬇️";

    card.innerHTML = `
      <div class="spoon-race-header">
        <span class="spoon-race-position">${icon} ${positionLabel}</span>
        <strong>${team.points} pts</strong>
      </div>

      <h3>${team.team}</h3>

      <p>
        Owner: <strong>${team.playerName}</strong>
      </p>

      <div class="spoon-race-stats">
        <span>Played ${team.gamesPlayed}</span>
        <span>W${team.wins} D${team.draws} L${team.losses}</span>
        <span>GF ${team.goalsFor}</span>
        <span>GA ${team.goalsAgainst}</span>
        <span>GD ${team.goalDifference}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderPlayerDetails(details, spoonTeam) {
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

    if (spoonTeam && player.name === spoonTeam.playerName) {
      card.classList.add("wooden-spoon-card");
    }

    const teams = (player.teams || []).map(team => {
      const isSpoonTeam = spoonTeam
        && player.name === spoonTeam.playerName
        && team.team === spoonTeam.team;

      const teamName = isSpoonTeam ? `🥄 ${team.team}` : team.team;

      const recentResults = team.recentResults && team.recentResults.length > 0
        ? team.recentResults.map(result => `
            <li>
              ${result.result}: ${team.team} ${result.scoreFor}–${result.scoreAgainst} ${result.opponent}
              (${result.points} pts)
            </li>
          `).join("")
        : `<li>No completed matches yet</li>`;

      return `
        <div class="team-breakdown ${isSpoonTeam ? "wooden-spoon-team" : ""}">
          <div class="team-breakdown-header">
            <strong>${teamName}</strong>
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

    const playerName = spoonTeam && player.name === spoonTeam.playerName
      ? `🥄 ${player.name}`
      : player.name;

    card.innerHTML = `
      <div class="player-card-header">
        <h3>${medal(player.rank)} ${playerName}</h3>
        <strong>${player.points} pts</strong>
      </div>

      <p class="player-card-subtitle">
        Rank ${player.rank} · ${player.gamesPlayed} games played
        · Match ${player.matchPoints ?? player.points} pts
        · Bonus ${player.bonusPoints ?? 0} pts
      </p>

      ${teams}
    `;

    container.appendChild(card);
  });
}

function calculatePotentialPoints(match) {
  const team1 = match.team1;
  const team2 = match.team2;
  const playerMap = {};

  (match.players || []).forEach(player => {
    if (!playerMap[player.name]) {
      playerMap[player.name] = {
        name: player.name,
        teams: [],
        team1Win: 0,
        draw: 0,
        team2Win: 0
      };
    }

    (player.teams || []).forEach(team => {
      playerMap[player.name].teams.push(team);

      if (normaliseText(team) === normaliseText(team1)) {
        playerMap[player.name].team1Win += 3;
        playerMap[player.name].draw += 1;
      }

      if (normaliseText(team) === normaliseText(team2)) {
        playerMap[player.name].team2Win += 3;
        playerMap[player.name].draw += 1;
      }
    });
  });

  return Object.values(playerMap).sort((a, b) => a.name.localeCompare(b.name));
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

    const potentialRows = calculatePotentialPoints(match);

    const potentialHtml = potentialRows.length > 0
      ? potentialRows.map(row => `
          <div class="potential-row">
            <strong>${row.name}</strong>
            <span>${match.team1} win +${row.team1Win}</span>
            <span>Draw +${row.draw}</span>
            <span>${match.team2} win +${row.team2Win}</span>
          </div>
        `).join("")
      : `<p class="potential-empty">No sweepstake players involved.</p>`;

    card.innerHTML = `
      <h3>${match.team1} v ${match.team2}</h3>
      <p>${formatDateTime(match.date)}</p>

      <div class="fixture-section">
        <h4>Players involved</h4>
        <ul>${players}</ul>
      </div>

      <div class="fixture-section">
        <h4>Potential points</h4>
        <div class="potential-points">
          ${potentialHtml}
        </div>
      </div>
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
  let bonusData = null;
  let spoonTeam = null;
  let badgesByPlayer = {};

  try {
    leaderboard = await loadJson("data/leaderboard.json");
  } catch (error) {
    console.error(error);

    const tbody = document.querySelector("#board tbody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9">Could not load leaderboard data.</td>
        </tr>
      `;
    }
  }

  try {
    playerDetails = await loadJson("data/player_details.json");
  } catch (error) {
    console.error(error);

    const playerDetailsEl = document.querySelector("#player-details");

    if (playerDetailsEl) {
      playerDetailsEl.textContent = "Player breakdown not available yet.";
    }
  }

  try {
    bonusData = await loadJson("data/bonus_points.json");
  } catch (error) {
    console.error(error);

    const bonusEl = document.querySelector("#bonus-tracker");

    if (bonusEl) {
      bonusEl.textContent = "Bonus tracker not available yet.";
    }
  }

  const badgeData = findCurrentBadgeHolders(leaderboard, playerDetails, bonusData);
  spoonTeam = badgeData.spoonTeam;
  badgesByPlayer = badgeData.badgesByPlayer;

  renderSummaryCards(leaderboard, playerDetails);
  renderLeaderboard(leaderboard, spoonTeam, badgesByPlayer);
  renderBonusTracker(bonusData, leaderboard);
  renderWoodenSpoonRace(playerDetails);
  renderPlayerDetails(playerDetails, spoonTeam);

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
