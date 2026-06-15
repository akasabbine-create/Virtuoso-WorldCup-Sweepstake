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

function renderStatus(status) {
  const statusEl = document.querySelector("#status");
  const completedEl = document.querySelector("#completed-matches");

  statusEl.innerHTML = `
    <strong>Last updated:</strong> ${formatDateTime(status.lastUpdated)}
    <br />
    <strong>Source:</strong> ${status.source || "ESPN"}
  `;

  completedEl.textContent = `${status.completedMatches ?? 0} of ${status.matchesChecked ?? 0}`;
}

function renderSummaryCards(leaderboard) {
  const leader = leaderboard[0];
  const woodenSpoon = leaderboard[leaderboard.length - 1];

  document.querySelector("#current-leader").textContent =
    leader ? `${leader.name} — ${leader.points} pts` : "No data";

  document.querySelector("#wooden-spoon").textContent =
    woodenSpoon ? `${woodenSpoon.name} — ${woodenSpoon.points} pts` : "No data";
}

function renderLeaderboard(data) {
  const tbody = document.querySelector("#board tbody");
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

    const teams = (player.teams || []).map((team, index) => {
      const flag = player.teamFlags && player.teamFlags[index]
        ? player.teamFlags[index]
        : "";

      return `${flag} ${team}`.trim();
    }).join(", ");

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

function renderLatestResults(results) {
  const container = document.querySelector("#latest-results");
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

function renderHistoryChart(history) {
  const canvas = document.querySelector("#history-chart");

  if (!canvas || !history || history.length === 0) {
    return;
  }

  const labels = history.map(entry => {
    const date = new Date(entry.timestamp);

    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  });

  const playerNames = new Set();

  history.forEach(entry => {
    (entry.players || []).forEach(player => {
      playerNames.add(player.name);
    });
  });

  const datasets = Array.from(playerNames).map(name => ({
    label: name,
    data: history.map(entry => {
      const player = (entry.players || []).find(p => p.name === name);
      return player ? player.points : 0;
    }),
    tension: 0.2
  }));

  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

async function init() {
  try {
    const [leaderboard, status, latestResults, history] = await Promise.all([
      loadJson("data/leaderboard.json"),
      loadJson("data/status.json"),
      loadJson("data/latest_results.json"),
      loadJson("data/history.json")
    ]);

    renderStatus(status);
    renderSummaryCards(leaderboard);
    renderLeaderboard(leaderboard);
    renderLatestResults(latestResults);
    renderHistoryChart(history);
  } catch (error) {
    console.error(error);

    document.querySelector("#board tbody").innerHTML = `
      <tr>
        <td colspan="6">Could not load dashboard data.</td>
      </tr>
    `;
  }
}

init();
