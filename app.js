const cacheBust = Date.now();

const PRIZE_POOL = {
  total: 80,
  places: [
    { rank: 1, amount: 40, label: "1st Place", icon: "🥇" },
    { rank: 2, amount: 20, label: "2nd Place", icon: "🥈" },
    { rank: 3, amount: 10, label: "3rd Place", icon: "🥉" }
  ],
  fastestGoal: { amount: 5, label: "Fastest Goal", icon: "⚡" },
  woodenSpoon: { amount: 5, label: "Wooden Spoon", icon: "🥄" }
};

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

function formatTimeOnly(value) {
  if (!value) return "TBC";

  const date = new Date(value);

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normaliseText(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const TEAM_FLAGS = {
  "algeria": "🇩🇿",
  "argentina": "🇦🇷",
  "australia": "🇦🇺",
  "austria": "🇦🇹",
  "belgium": "🇧🇪",
  "bosnia": "🇧🇦",
  "bosnia and herzegovina": "🇧🇦",
  "brazil": "🇧🇷",
  "canada": "🇨🇦",
  "cape verde": "🇨🇻",
  "colombia": "🇨🇴",
  "croatia": "🇭🇷",
  "curacao": "🇨🇼",
  "curaçao": "🇨🇼",
  "czech republic": "🇨🇿",
  "czechia": "🇨🇿",
  "dr congo": "🇨🇩",
  "democratic republic of congo": "🇨🇩",
  "ecuador": "🇪🇨",
  "egypt": "🇪🇬",
  "england": "🏴",
  "france": "🇫🇷",
  "germany": "🇩🇪",
  "ghana": "🇬🇭",
  "haiti": "🇭🇹",
  "iran": "🇮🇷",
  "iraq": "🇮🇶",
  "ivory coast": "🇨🇮",
  "cote d'ivoire": "🇨🇮",
  "côte d’ivoire": "🇨🇮",
  "japan": "🇯🇵",
  "jordan": "🇯🇴",
  "mexico": "🇲🇽",
  "morocco": "🇲🇦",
  "netherlands": "🇳🇱",
  "new zealand": "🇳🇿",
  "norway": "🇳🇴",
  "panama": "🇵🇦",
  "paraguay": "🇵🇾",
  "portugal": "🇵🇹",
  "qatar": "🇶🇦",
  "saudi arabia": "🇸🇦",
  "scotland": "🏴",
  "senegal": "🇸🇳",
  "south africa": "🇿🇦",
  "south korea": "🇰🇷",
  "spain": "🇪🇸",
  "sweden": "🇸🇪",
  "switzerland": "🇨🇭",
  "tunisia": "🇹🇳",
  "turkey": "🇹🇷",
  "united states": "🇺🇸",
  "usa": "🇺🇸",
  "uruguay": "🇺🇾",
  "uzbekistan": "🇺🇿"
};

function flagForTeam(team) {
  return TEAM_FLAGS[normaliseText(team)] || "";
}

function teamLabelHtml(team, classes = []) {
  const safeTeam = escapeHtml(String(team || "").trim());
  const flag = flagForTeam(team);
  const content = `${flag ? `<span class="team-flag" aria-hidden="true">${flag}</span>` : ""}<span class="team-name-text">${safeTeam}</span>`;

  if (!classes || classes.length === 0) {
    return `<span class="team-name">${content}</span>`;
  }

  return `<span class="team-name ${classes.join(" ")}">${content}</span>`;
}

function teamPlainText(team) {
  const trimmed = String(team || "").trim();
  const flag = flagForTeam(trimmed);
  return `${flag ? `${flag} ` : ""}${trimmed}`;
}

function fixtureStatusLabel(match) {
  if (match.completed) {
    return "Final";
  }

  const status = normaliseText(match.status);

  if (
    status.includes("half") ||
    status.includes("live") ||
    status.includes("in progress") ||
    status.includes("1st") ||
    status.includes("2nd") ||
    status.includes("extra")
  ) {
    return match.status || "Live";
  }

  if (match.isToday) {
    return "Today";
  }

  return "Upcoming";
}

function fixtureStatusClass(match) {
  if (match.completed) return "final";

  const status = normaliseText(match.status);

  if (
    status.includes("half") ||
    status.includes("live") ||
    status.includes("in progress") ||
    status.includes("1st") ||
    status.includes("2nd") ||
    status.includes("extra")
  ) {
    return "live";
  }

  if (match.isToday) return "today";

  return "upcoming";
}

function findPreviousHeading(element) {
  let previous = element.previousElementSibling;

  while (previous) {
    if (previous.tagName === "H2") {
      return previous;
    }

    previous = previous.previousElementSibling;
  }

  return null;
}

function updateStaticPageText() {
  document.querySelectorAll("h2").forEach(heading => {
    const text = normaliseText(heading.textContent);

    if (text === "upcoming fixtures") {
      heading.textContent = "Today's Matches";
    }

    if (text === "latest results") {
      heading.textContent = "Recent Results";
    }
  });

  const upcomingContainer = document.querySelector("#upcoming-fixtures");

  if (upcomingContainer) {
    let previous = upcomingContainer.previousElementSibling;
    let hasNote = false;

    while (previous) {
      if (previous.tagName === "P" && previous.classList.contains("section-note")) {
        previous.textContent = "Matches from the current football day, including live, completed and overnight fixtures.";
        hasNote = true;
        break;
      }

      if (previous.tagName === "H2") {
        break;
      }

      previous = previous.previousElementSibling;
    }

    if (!hasNote) {
      const note = document.createElement("p");
      note.className = "section-note";
      note.textContent = "Matches from the current football day, including live, completed and overnight fixtures.";

      const heading = findPreviousHeading(upcomingContainer);

      if (heading && heading.parentNode) {
        heading.parentNode.insertBefore(note, upcomingContainer);
      }
    }
  }

  const playerDetailsContainer = document.querySelector("#player-details");

  if (playerDetailsContainer) {
    let previous = playerDetailsContainer.previousElementSibling;
    let hasNote = false;

    while (previous) {
      if (previous.tagName === "P" && previous.classList.contains("section-note")) {
        previous.textContent = "Click a player to expand their team-by-team points breakdown.";
        hasNote = true;
        break;
      }

      if (previous.tagName === "H2") {
        break;
      }

      previous = previous.previousElementSibling;
    }

    if (!hasNote) {
      const note = document.createElement("p");
      note.className = "section-note";
      note.textContent = "Click a player to expand their team-by-team points breakdown.";

      const heading = findPreviousHeading(playerDetailsContainer);

      if (heading && heading.parentNode) {
        heading.parentNode.insertBefore(note, playerDetailsContainer);
      }
    }
  }

  document.querySelectorAll("p").forEach(paragraph => {
    const text = normaliseText(paragraph.textContent);

    if (text.startsWith("badges:")) {
      paragraph.classList.add("badge-legend");
      paragraph.innerHTML = `
        <span class="badge-legend-title">Badges</span>
        <span class="badge-chip" title="Current wooden spoon">🥄 Wooden Spoon</span>
        <span class="badge-chip" title="Current Golden Boot race leader's team owner">🥾 Golden Boot</span>
        <span class="badge-chip" title="Current most-goals nation owner">⚽ Most Goals</span>
        <span class="badge-chip" title="Current fastest goal prize holder">⚡ Fastest Goal</span>
      `;
    }
  });
}

function makeRulesCollapsible() {
  const rulesSection = document.querySelector(".rules-section");

  if (!rulesSection) return;

  const cards = rulesSection.querySelectorAll(".rules-card");

  cards.forEach((card, index) => {
    if (card.classList.contains("rules-collapsible-card")) return;

    const heading = card.querySelector("h3");

    if (!heading) return;

    const title = heading.textContent.trim();
    const bodyChildren = Array.from(card.children).filter(child => child !== heading);

    card.classList.add("rules-collapsible-card");
    card.innerHTML = "";

    const button = document.createElement("button");
    button.className = "rules-collapse-toggle";
    button.type = "button";
    button.setAttribute("aria-expanded", index < 2 ? "true" : "false");

    button.innerHTML = `
      <span>${title}</span>
      <span class="rules-collapse-chevron">${index < 2 ? "−" : "+"}</span>
    `;

    const body = document.createElement("div");
    body.className = "rules-collapse-body";

    if (index >= 2) {
      body.hidden = true;
    }

    bodyChildren.forEach(child => body.appendChild(child));

    button.addEventListener("click", () => {
      const isOpen = button.getAttribute("aria-expanded") === "true";
      const nextOpenState = !isOpen;

      button.setAttribute("aria-expanded", String(nextOpenState));
      body.hidden = !nextOpenState;
      card.classList.toggle("is-open", nextOpenState);
      button.querySelector(".rules-collapse-chevron").textContent = nextOpenState ? "−" : "+";
    });

    card.appendChild(button);
    card.appendChild(body);
    card.classList.toggle("is-open", index < 2);
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

function formatGoalDifference(value) {
  const numberValue = Number(value || 0);

  if (numberValue > 0) {
    return `+${numberValue}`;
  }

  return String(numberValue);
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
  let mostGoalsTeams = [];

  if (nationGoalTable.length > 0) {
    const topNationGoals = nationGoalTable[0].goals;
    const topNations = nationGoalTable.filter(item => item.goals === topNationGoals);
    mostGoalsTeams = topNations.map(nation => nation.team);

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
    badgesByPlayer,
    mostGoalsTeams
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

function teamHighlightClasses(team, playerName, spoonTeam, mostGoalsTeams) {
  const classes = [];

  if (spoonTeam && playerName === spoonTeam.playerName && team === spoonTeam.team) {
    classes.push("wooden-spoon-country");
  }

  if ((mostGoalsTeams || []).some(item => normaliseText(item) === normaliseText(team))) {
    classes.push("most-goals-country");
  }

  return classes;
}

function teamNameHtml(team, classes) {
  return teamLabelHtml(team, classes);
}

function renderStatus(status) {
  const statusEl = document.querySelector("#status");
  const completedEl = document.querySelector("#completed-matches");

  if (!statusEl || !completedEl) return;

  const updated = status.lastUpdated
    ? new Date(status.lastUpdated).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Unknown";

  statusEl.innerHTML = `
    <span><strong>Updated</strong> ${updated}</span>
    <span><strong>Source</strong> ESPN</span>
    <span><strong>Fetched</strong> ${status.matchesFetchedFromEspn ?? "?"}</span>
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
    ${spoonTeam.playerName} — ${teamLabelHtml(spoonTeam.team, ["wooden-spoon-country"])}
    <br />
    <span class="small-card-text">
      ${spoonTeam.points} pts, ${spoonTeam.gamesPlayed} played, GD ${spoonTeam.goalDifference}
    </span>
  `;
}


function findOwnerForTeam(leaderboard, teamName) {
  if (!teamName) return null;

  return (leaderboard || []).find(player => playerOwnsTeam(player, teamName)) || null;
}

function addProjectedPrize(payouts, playerName, prize) {
  if (!playerName || !prize) return;

  if (!payouts[playerName]) {
    payouts[playerName] = {
      name: playerName,
      total: 0,
      prizes: [],
      firstPrizeOrder: prize.order ?? 99
    };
  }

  payouts[playerName].total += prize.amount;
  payouts[playerName].firstPrizeOrder = Math.min(
    payouts[playerName].firstPrizeOrder,
    prize.order ?? 99
  );
  payouts[playerName].prizes.push(prize);
}


function calculateProjectedPayouts(leaderboard, playerDetails, bonusData) {
  const payouts = {};

  PRIZE_POOL.places.forEach((place, index) => {
    const player = (leaderboard || [])[place.rank - 1];

    if (!player) return;

    addProjectedPrize(payouts, player.name, {
      amount: place.amount,
      label: place.label,
      icon: place.icon,
      order: index + 1
    });
  });

  const fastestGoalTeam = bonusData?.fastestGoal?.team;
  const fastestGoalOwner = findOwnerForTeam(leaderboard, fastestGoalTeam);

  if (fastestGoalOwner) {
    addProjectedPrize(payouts, fastestGoalOwner.name, {
      amount: PRIZE_POOL.fastestGoal.amount,
      label: PRIZE_POOL.fastestGoal.label,
      icon: PRIZE_POOL.fastestGoal.icon,
      order: 4
    });
  }

  const spoonTeam = findWoodenSpoonTeam(playerDetails);

  if (spoonTeam) {
    addProjectedPrize(payouts, spoonTeam.playerName, {
      amount: PRIZE_POOL.woodenSpoon.amount,
      label: PRIZE_POOL.woodenSpoon.label,
      icon: PRIZE_POOL.woodenSpoon.icon,
      order: 5
    });
  }

  return Object.values(payouts).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.firstPrizeOrder !== b.firstPrizeOrder) return a.firstPrizeOrder - b.firstPrizeOrder;
    return a.name.localeCompare(b.name);
  });
}

function renderCompetitiveSnapshot(leaderboard, playerDetails, bonusData) {
  renderClosestBattles(leaderboard);
  renderPodiumWatch(leaderboard);
  renderPrizeRaceMini(leaderboard, playerDetails, bonusData);
}

function renderClosestBattles(leaderboard) {
  const container = document.querySelector("#closest-battles");
  if (!container) return;

  const players = [...(leaderboard || [])].sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0));

  if (players.length < 2) {
    container.innerHTML = snapshotEmptyHtml("Closest Battles", "More players needed before battles appear.");
    return;
  }

  const pointGroups = [];
  players.forEach(player => {
    const points = Number(player.points || 0);
    const lastGroup = pointGroups[pointGroups.length - 1];

    if (lastGroup && lastGroup.points === points) {
      lastGroup.players.push(player);
    } else {
      pointGroups.push({ points, players: [player] });
    }
  });

  const tiedGroups = pointGroups
    .filter(group => group.players.length > 1)
    .slice(0, 2)
    .map(group => ({
      title: `Level on ${group.points} pts`,
      detail: group.players.map(player => player.name).join(", ")
    }));

  const gaps = [];
  for (let index = 0; index < players.length - 1; index += 1) {
    const current = players[index];
    const next = players[index + 1];
    const gap = Number(current.points || 0) - Number(next.points || 0);

    gaps.push({
      gap,
      rank: next.rank || index + 2,
      title: `${next.name} is ${gap} pt${gap === 1 ? "" : "s"} behind ${current.name}`,
      detail: `${current.name} ${current.points || 0} pts · ${next.name} ${next.points || 0} pts`
    });
  }

  const closestGaps = gaps
    .filter(item => item.gap > 0)
    .sort((a, b) => {
      if (a.gap !== b.gap) return a.gap - b.gap;
      return Number(a.rank || 99) - Number(b.rank || 99);
    })
    .slice(0, 3 - tiedGroups.length);

  const rows = [...tiedGroups, ...closestGaps].slice(0, 3);

  if (rows.length === 0) {
    container.innerHTML = snapshotEmptyHtml("Closest Battles", "No close point gaps found yet.");
    return;
  }

  container.innerHTML = snapshotCardHtml("Closest Battles", "Smallest leaderboard gaps", rows);
}

function renderPodiumWatch(leaderboard) {
  const container = document.querySelector("#podium-watch");
  if (!container) return;

  const players = [...(leaderboard || [])].sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0));
  const thirdPlace = players[2];
  const chasing = players.slice(3);

  if (!thirdPlace || chasing.length === 0) {
    container.innerHTML = snapshotEmptyHtml("Podium Watch", "Podium race will appear once there are enough players.");
    return;
  }

  const rows = chasing
    .map(player => {
      const gap = Math.max(0, Number(thirdPlace.points || 0) - Number(player.points || 0));
      return {
        gap,
        rank: player.rank,
        title: `${player.name} is ${gap} pt${gap === 1 ? "" : "s"} off 3rd`,
        detail: `3rd: ${thirdPlace.name} on ${thirdPlace.points || 0} pts`
      };
    })
    .sort((a, b) => {
      if (a.gap !== b.gap) return a.gap - b.gap;
      return Number(a.rank || 99) - Number(b.rank || 99);
    })
    .slice(0, 3);

  container.innerHTML = snapshotCardHtml("Podium Watch", "Closest to the money places", rows);
}

function renderPrizeRaceMini(leaderboard, playerDetails, bonusData) {
  const container = document.querySelector("#prize-race-mini");
  if (!container) return;

  const projectedPayouts = calculateProjectedPayouts(leaderboard, playerDetails, bonusData);

  if (projectedPayouts.length === 0) {
    container.innerHTML = snapshotEmptyHtml("Prize Race", "Projected prizes unavailable.");
    return;
  }

  const rows = projectedPayouts.slice(0, 5).map(player => {
    const labels = player.prizes.map(prize => `${prize.icon} ${prize.label}`).join(" + ");
    return {
      title: `£${player.total} ${player.name}`,
      detail: labels
    };
  });

  container.innerHTML = snapshotCardHtml("Prize Race", `Current projection from the £${PRIZE_POOL.total} pot`, rows);
}

function snapshotEmptyHtml(title, message) {
  return `
    <div class="snapshot-card-heading">
      <span>${escapeHtml(title)}</span>
    </div>
    <p class="snapshot-empty">${escapeHtml(message)}</p>
  `;
}

function snapshotCardHtml(title, subtitle, rows) {
  const rowHtml = (rows || []).map(row => `
    <div class="snapshot-row">
      <strong>${escapeHtml(row.title)}</strong>
      <span>${escapeHtml(row.detail)}</span>
    </div>
  `).join("");

  return `
    <div class="snapshot-card-heading">
      <span>${escapeHtml(title)}</span>
      <small>${escapeHtml(subtitle)}</small>
    </div>
    <div class="snapshot-row-list">
      ${rowHtml}
    </div>
  `;
}

function renderPrizePoolSection(leaderboard, playerDetails, bonusData) {
  const container = document.querySelector("#projected-prizes");

  if (!container) return;

  const projectedPayouts = calculateProjectedPayouts(leaderboard, playerDetails, bonusData);

  if (projectedPayouts.length === 0) {
    container.innerHTML = `
      <div class="prize-pool-topline">
        <span class="prize-pool-total">£${PRIZE_POOL.total}</span>
        <span class="prize-pool-subtitle">projected payouts unavailable</span>
      </div>
    `;
    return;
  }

  const payoutHtml = projectedPayouts.map(player => {
    const prizeTags = player.prizes.map(prize => `
      <span>${prize.icon} ${prize.label} £${prize.amount}</span>
    `).join("");

    return `
      <div class="prize-payout-item">
        <div class="prize-payout-topline">
          <strong>${player.name}</strong>
          <span>£${player.total}</span>
        </div>
        <div class="prize-payout-tags">
          ${prizeTags}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="prize-pool-topline">
      <span class="prize-pool-total">£${PRIZE_POOL.total}</span>
      <span class="prize-pool-subtitle">current projected payouts</span>
    </div>

    <div class="prize-payout-list">
      ${payoutHtml}
    </div>
  `;
}

function renderInsightStrip(leaderboard, latestResults) {
  const cards = document.querySelector(".cards");

  if (!cards || document.querySelector("#insight-strip")) return;

  const section = document.createElement("section");
  section.id = "insight-strip";
  section.className = "insight-strip";

  const latestMatch = latestResults && latestResults.length > 0
    ? latestResults[0]
    : null;

  const latestGains = latestMatch?.playerGains && latestMatch.playerGains.length > 0
    ? latestMatch.playerGains.map(gain => `
        <span>${gain.name} +${gain.points}</span>
      `).join("")
    : `<span>No player gained points</span>`;

  const upwardMovers = (leaderboard || [])
    .filter(player => (player.movement || 0) > 0)
    .sort((a, b) => (b.movement || 0) - (a.movement || 0))
    .slice(0, 3);

  const downwardMovers = (leaderboard || [])
    .filter(player => (player.movement || 0) < 0)
    .sort((a, b) => (a.movement || 0) - (b.movement || 0))
    .slice(0, 2);

  const moverHtml = upwardMovers.length > 0 || downwardMovers.length > 0
    ? `
      ${upwardMovers.map(player => `
        <span class="insight-chip positive">${player.name} ▲ ${player.movement}</span>
      `).join("")}
      ${downwardMovers.map(player => `
        <span class="insight-chip negative">${player.name} ▼ ${Math.abs(player.movement)}</span>
      `).join("")}
    `
    : `<span class="insight-chip">No ranking movement yet</span>`;

  section.innerHTML = `
    <div class="insight-card latest-swing-card">
      <div class="insight-label">Latest Points Swing</div>
      ${
        latestMatch
          ? `
            <h3>${teamLabelHtml(latestMatch.team1)} ${latestMatch.score1}–${latestMatch.score2} ${teamLabelHtml(latestMatch.team2)}</h3>
            <p>${formatDateTime(latestMatch.date)}</p>
            <div class="insight-chip-row">${latestGains}</div>
          `
          : `
            <h3>No completed result yet</h3>
            <p>Latest points swing will appear after the next completed match.</p>
          `
      }
    </div>

    <div class="insight-card biggest-mover-card">
      <div class="insight-label">Biggest Movers</div>
      <h3>Leaderboard movement</h3>
      <p>Movement since the previous scoring update.</p>
      <div class="insight-chip-row">${moverHtml}</div>
    </div>
  `;

  cards.insertAdjacentElement("afterend", section);
}

function renderLeaderboard(data, spoonTeam, badgesByPlayer, mostGoalsTeams) {
  const tbody = document.querySelector("#board tbody");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">No leaderboard data found.</td>
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

    const teams = (player.teams || []).map(team => {
      const classes = teamHighlightClasses(team, player.name, spoonTeam, mostGoalsTeams);
      return teamNameHtml(team, classes);
    }).join(", ");

    tr.innerHTML = `
      <td>${medal(player.rank)} ${player.rank}</td>
      <td>${movementIcon(player.movement || 0)}</td>
      <td class="badge-cell">${badgeHtml(badgesByPlayer[player.name])}</td>
      <td>${player.name}</td>
      <td>${teams}</td>
      <td>${player.gamesPlayed ?? 0}</td>
      <td class="goal-difference-cell">${formatGoalDifference(player.goalDifference ?? 0)}</td>
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
          ${item.label} — ${teamPlainText(item.team)}
          <br />
          <span>${item.reason}</span>
        </li>
      `).join("")
    : `<li>No bonus points awarded yet.</li>`;

  const goldenBootHtml = (bonusData.goldenBootRace || []).slice(0, 5).map((item, index) => {
    const owners = (leaderboard || [])
      .filter(player => playerOwnsTeam(player, item.team))
      .map(player => player.name)
      .join(", ");

    return `
      <li class="${index === 0 ? "race-leader" : ""}">
        <strong>${item.player}</strong>
        <span>${teamPlainText(item.team)} · ${item.goals} goals</span>
        ${owners ? `<em>Owner: ${owners}</em>` : ""}
      </li>
    `;
  }).join("") || `<li>No goals tracked yet.</li>`;

  const nationGoalsHtml = (bonusData.nationGoalTable || []).slice(0, 5).map((item, index) => {
    const owners = (leaderboard || [])
      .filter(player => playerOwnsTeam(player, item.team))
      .map(player => player.name)
      .join(", ");

    return `
      <li class="${index === 0 ? "race-leader" : ""}">
        <strong>${teamPlainText(item.team)}</strong>
        <span>${item.goals} goals</span>
        ${owners ? `<em>Owner: ${owners}</em>` : ""}
      </li>
    `;
  }).join("") || `<li>No nation goal data yet.</li>`;

  const fastestGoal = bonusData.fastestGoal
    ? `
      <div class="fastest-goal-card">
        <strong>${bonusData.fastestGoal.player}</strong>
        <span>${teamPlainText(bonusData.fastestGoal.team)} · ${bonusData.fastestGoal.clockDisplay}</span>
        <em>${bonusData.fastestGoal.match}</em>
      </div>
    `
    : `<p>No fastest goal tracked yet.</p>`;

  container.innerHTML = `
    <div class="bonus-race-card">
      <h3>🥾 Golden Boot Race</h3>
      <ul>${goldenBootHtml}</ul>
      <p class="bonus-note">Current top scorer owner gets the badge. +5 points awarded at tournament end.</p>
    </div>

    <div class="bonus-race-card">
      <h3>⚽ Most Goals by Nation</h3>
      <ul>${nationGoalsHtml}</ul>
      <p class="bonus-note">Current top nation owner gets the badge. +5 points awarded at tournament end.</p>
    </div>

    <div class="bonus-race-card">
      <h3>⚡ Fastest Goal Prize</h3>
      ${fastestGoal}
      <p class="bonus-note">Prize only. No leaderboard points.</p>
    </div>

    <div class="bonus-race-card awarded-bonus-card">
      <h3>Awarded Bonus Points</h3>
      <ul>${awardedHtml}</ul>
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

    card.innerHTML = `
      <div class="spoon-race-header">
        <span class="spoon-race-position">${positionLabel}</span>
        <strong>${team.points} pts</strong>
      </div>

      <h3>${teamLabelHtml(team.team, index === 0 ? ["wooden-spoon-country"] : [])}</h3>

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

function renderPlayerDetails(details, spoonTeam, mostGoalsTeams) {
  const container = document.querySelector("#player-details");

  if (!container) return;

  container.innerHTML = "";

  if (!details || details.length === 0) {
    container.innerHTML = `<p>No player breakdown available yet.</p>`;
    return;
  }

  details.forEach(player => {
    const card = document.createElement("div");
    card.className = "player-card player-collapsible-card";

    if (spoonTeam && player.name === spoonTeam.playerName) {
      card.classList.add("wooden-spoon-card");
    }

    const teams = (player.teams || []).map(team => {
      const isSpoonTeam = spoonTeam
        && player.name === spoonTeam.playerName
        && team.team === spoonTeam.team;

      const teamClasses = teamHighlightClasses(team.team, player.name, spoonTeam, mostGoalsTeams);
      const teamName = teamNameHtml(team.team, teamClasses);

      const recentResults = team.recentResults && team.recentResults.length > 0
        ? team.recentResults.map(result => `
            <li>
              ${result.result}: ${teamPlainText(team.team)} ${result.scoreFor}–${result.scoreAgainst} ${teamPlainText(result.opponent)}
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

    const teamNames = (player.teams || [])
      .map(team => {
        const classes = teamHighlightClasses(team.team, player.name, spoonTeam, mostGoalsTeams);
        return teamNameHtml(team.team, classes);
      })
      .join(", ");

    card.innerHTML = `
      <button class="player-collapse-toggle" type="button" aria-expanded="false">
        <span class="player-collapse-main">
          <span class="player-collapse-name">
            ${medal(player.rank)} ${player.name}
          </span>
          <span class="player-collapse-teams">
            ${teamNames}
          </span>
        </span>

        <span class="player-collapse-meta">
          <span>Rank ${player.rank}</span>
          <span>${player.gamesPlayed} played</span>
          <strong>${player.points} pts</strong>
          <span class="player-collapse-chevron">+</span>
        </span>
      </button>

      <div class="player-collapse-body" hidden>
        <p class="player-card-subtitle">
          Rank ${player.rank} · ${player.gamesPlayed} games played
          · Match ${player.matchPoints ?? player.points} pts
          · Bonus ${player.bonusPoints ?? 0} pts
        </p>

        ${teams}
      </div>
    `;

    const toggle = card.querySelector(".player-collapse-toggle");
    const body = card.querySelector(".player-collapse-body");
    const chevron = card.querySelector(".player-collapse-chevron");

    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      const nextOpenState = !isOpen;

      toggle.setAttribute("aria-expanded", String(nextOpenState));
      body.hidden = !nextOpenState;
      card.classList.toggle("is-open", nextOpenState);
      chevron.textContent = nextOpenState ? "−" : "+";
    });

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

function potentialChips(row, match) {
  const chips = [];

  if (row.team1Win > 0) {
    chips.push(`<span>${teamLabelHtml(match.team1)} +${row.team1Win}</span>`);
  }

  if (row.draw > 0) {
    chips.push(`<span>Draw +${row.draw}</span>`);
  }

  if (row.team2Win > 0) {
    chips.push(`<span>${teamLabelHtml(match.team2)} +${row.team2Win}</span>`);
  }

  return chips.join("");
}


function rankProjectedPlayers(players) {
  return [...players].sort((a, b) => {
    if ((b.projectedPoints ?? 0) !== (a.projectedPoints ?? 0)) {
      return (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0);
    }

    if ((b.goalDifference ?? 0) !== (a.goalDifference ?? 0)) {
      return (b.goalDifference ?? 0) - (a.goalDifference ?? 0);
    }

    if ((b.goalsFor ?? 0) !== (a.goalsFor ?? 0)) {
      return (b.goalsFor ?? 0) - (a.goalsFor ?? 0);
    }

    if ((b.wins ?? 0) !== (a.wins ?? 0)) {
      return (b.wins ?? 0) - (a.wins ?? 0);
    }

    if ((b.bonusPoints ?? 0) !== (a.bonusPoints ?? 0)) {
      return (b.bonusPoints ?? 0) - (a.bonusPoints ?? 0);
    }

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function outcomeDefinitions(match) {
  return [
    {
      key: "team1Win",
      label: `${teamPlainText(match.team1)} win`
    },
    {
      key: "draw",
      label: "Draw"
    },
    {
      key: "team2Win",
      label: `${teamPlainText(match.team2)} win`
    }
  ];
}

function outcomeGains(match, outcomeKey) {
  const gains = {};

  calculatePotentialPoints(match).forEach(row => {
    const points = Number(row[outcomeKey] || 0);

    if (points > 0) {
      gains[row.name] = (gains[row.name] || 0) + points;
    }
  });

  return gains;
}

function getUpcomingImpactMatches(fixtures) {
  return (fixtures || []).filter(match => !match.completed);
}

function renderBiggestPossibleMove(leaderboard, fixtures) {
  const container = document.querySelector("#biggest-possible-move");

  if (!container) return;

  const impactMatches = getUpcomingImpactMatches(fixtures);

  if (!leaderboard || leaderboard.length === 0 || impactMatches.length === 0) {
    container.innerHTML = `
      <div class="biggest-move-copy">
        <span class="biggest-move-label">Biggest Possible Move Today</span>
        <strong>No remaining match impact yet</strong>
        <p>Once today’s remaining fixtures are listed, the biggest possible climb will appear here.</p>
      </div>
    `;
    return;
  }

  let best = null;

  impactMatches.forEach(match => {
    outcomeDefinitions(match).forEach(outcome => {
      const gains = outcomeGains(match, outcome.key);

      if (Object.keys(gains).length === 0) return;

      const projected = rankProjectedPlayers((leaderboard || []).map(player => ({
        ...player,
        projectedPoints: Number(player.points || 0) + Number(gains[player.name] || 0)
      })));

      projected.forEach((player, index) => {
        const currentIndex = (leaderboard || []).findIndex(item => item.name === player.name);
        const oldRank = Number(player.rank || currentIndex + 1);
        const newRank = index + 1;
        const places = oldRank - newRank;
        const gainedPoints = Number(gains[player.name] || 0);

        if (places <= 0 || gainedPoints <= 0) return;

        const candidate = {
          player: player.name,
          match,
          outcome,
          places,
          gainedPoints,
          oldRank,
          newRank
        };

        if (!best
          || candidate.places > best.places
          || (candidate.places === best.places && candidate.gainedPoints > best.gainedPoints)
          || (candidate.places === best.places && candidate.gainedPoints === best.gainedPoints && candidate.newRank < best.newRank)) {
          best = candidate;
        }
      });
    });
  });

  if (!best) {
    const firstImpact = impactMatches
      .map(match => ({ match, rows: calculatePotentialPoints(match) }))
      .find(item => item.rows.length > 0);

    container.innerHTML = `
      <div class="biggest-move-copy">
        <span class="biggest-move-label">Biggest Possible Move Today</span>
        <strong>No rank climb currently projected</strong>
        <p>
          ${firstImpact
            ? `${teamPlainText(firstImpact.match.team1)} v ${teamPlainText(firstImpact.match.team2)} can still add points, but may not change positions immediately.`
            : "No sweepstake players are involved in the remaining listed matches."}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="biggest-move-copy">
      <span class="biggest-move-label">Biggest Possible Move Today</span>
      <strong>${escapeHtml(best.player)} could climb ${best.places} place${best.places === 1 ? "" : "s"}</strong>
      <p>
        If <span>${escapeHtml(best.outcome.label)}</span> in
        ${teamPlainText(best.match.team1)} v ${teamPlainText(best.match.team2)},
        ${escapeHtml(best.player)} gains +${best.gainedPoints} and moves from ${best.oldRank} to ${best.newRank}.
      </p>
    </div>
    <div class="biggest-move-badge">+${best.gainedPoints}</div>
  `;
}

function renderUpcomingFixtures(fixtures) {
  const container = document.querySelector("#upcoming-fixtures");

  if (!container) return;

  container.innerHTML = "";

  if (!fixtures || fixtures.length === 0) {
    container.innerHTML = `<p>No matches found for the current football day.</p>`;
    return;
  }

  fixtures.forEach(match => {
    const card = document.createElement("div");
    card.className = "fixture-card";

    if (match.isToday) {
      card.classList.add("today-match");
    }

    if (match.completed) {
      card.classList.add("completed-match");
    }

    const statusClass = fixtureStatusClass(match);
    const statusLabel = fixtureStatusLabel(match);

    const players = match.players && match.players.length > 0
      ? match.players.map(player => {
          const teams = (player.teams || []).map(teamPlainText).join(", ");
          return `<li>${escapeHtml(player.name)}: ${escapeHtml(teams)}</li>`;
        }).join("")
      : `<li>No sweepstake players involved</li>`;

    const hasVisibleScore = match.displayScore1 !== null
      && match.displayScore1 !== undefined
      && match.displayScore2 !== null
      && match.displayScore2 !== undefined;

    const scoreHtml = hasVisibleScore
      ? `
        <div class="fixture-score">
          <span>${teamLabelHtml(match.team1)}</span>
          <strong>${match.displayScore1}–${match.displayScore2}</strong>
          <span>${teamLabelHtml(match.team2)}</span>
        </div>
      `
      : `<h3>${teamLabelHtml(match.team1)} v ${teamLabelHtml(match.team2)}</h3>`;

    const playerGains = match.playerGains && match.playerGains.length > 0
      ? match.playerGains.map(gain => `<li>${gain.name} +${gain.points}</li>`).join("")
      : `<li>No player gained points</li>`;

    const potentialRows = calculatePotentialPoints(match);

    const potentialHtml = potentialRows.length > 0
      ? potentialRows.map(row => `
          <div class="potential-row">
            <strong>${row.name}</strong>
            <div class="potential-chip-row">
              ${potentialChips(row, match)}
            </div>
          </div>
        `).join("")
      : `<p class="potential-empty">No sweepstake players involved.</p>`;

    const pointsSection = match.completed
      ? `
        <div class="fixture-section">
          <h4>Points awarded</h4>
          <ul>${playerGains}</ul>
        </div>
      `
      : `
        <div class="fixture-section">
          <h4>Potential points</h4>
          <div class="potential-points">
            ${potentialHtml}
          </div>
        </div>
      `;

    card.innerHTML = `
      <div class="fixture-topline">
        <span class="fixture-status ${statusClass}">${statusLabel}</span>
        <span class="fixture-time">${formatTimeOnly(match.date)}</span>
      </div>

      ${scoreHtml}

      <p>${formatDateTime(match.date)}</p>

      <div class="fixture-section">
        <h4>Players involved</h4>
        <ul>${players}</ul>
      </div>

      ${pointsSection}
    `;

    container.appendChild(card);
  });
}

function renderLatestResults(results) {
  const container = document.querySelector("#latest-results");

  if (!container) return;

  container.innerHTML = "";
  container.classList.add("results-ticker");

  if (!results || results.length === 0) {
    container.innerHTML = `<p>No completed results yet.</p>`;
    return;
  }

  results.forEach(match => {
    const row = document.createElement("div");
    row.className = "result-ticker-row";

    const gains = match.playerGains && match.playerGains.length > 0
      ? match.playerGains.map(gain => `
          <span>${gain.name} +${gain.points}</span>
        `).join("")
      : `<span>No player gained points</span>`;

    row.innerHTML = `
      <div class="result-ticker-score">
        <strong>${teamLabelHtml(match.team1)} ${match.score1}–${match.score2} ${teamLabelHtml(match.team2)}</strong>
        <small>${formatDateTime(match.date)}</small>
      </div>

      <div class="result-ticker-gains">
        ${gains}
      </div>
    `;

    container.appendChild(row);
  });
}

async function init() {
  updateStaticPageText();
  makeRulesCollapsible();

  let leaderboard = [];
  let playerDetails = [];
  let bonusData = null;
  let latestResults = [];
  let spoonTeam = null;
  let badgesByPlayer = {};
  let mostGoalsTeams = [];

  try {
    leaderboard = await loadJson("data/leaderboard.json");
  } catch (error) {
    console.error(error);

    const tbody = document.querySelector("#board tbody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10">Could not load leaderboard data.</td>
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

  try {
    latestResults = await loadJson("data/latest_results.json");
  } catch (error) {
    console.error(error);

    const latestEl = document.querySelector("#latest-results");

    if (latestEl) {
      latestEl.textContent = "Latest results not available yet.";
    }
  }

  const badgeData = findCurrentBadgeHolders(leaderboard, playerDetails, bonusData);
  spoonTeam = badgeData.spoonTeam;
  badgesByPlayer = badgeData.badgesByPlayer;
  mostGoalsTeams = badgeData.mostGoalsTeams || [];

  renderSummaryCards(leaderboard, playerDetails);
  renderInsightStrip(leaderboard, latestResults);
  renderLeaderboard(leaderboard, spoonTeam, badgesByPlayer, mostGoalsTeams);
  renderBonusTracker(bonusData, leaderboard);
  renderPrizePoolSection(leaderboard, playerDetails, bonusData);
  renderWoodenSpoonRace(playerDetails);
  renderPlayerDetails(playerDetails, spoonTeam, mostGoalsTeams);
  renderLatestResults(latestResults);

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
    renderBiggestPossibleMove(leaderboard, upcomingFixtures);
  } catch (error) {
    console.error(error);

    const upcomingEl = document.querySelector("#upcoming-fixtures");

    if (upcomingEl) {
      upcomingEl.textContent = "Upcoming fixtures not available yet.";
    }

    renderBiggestPossibleMove(leaderboard, []);
  }
}

init();
