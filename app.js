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

const TEAM_FLAG_CODES = {
  "algeria": "dz",
  "argentina": "ar",
  "australia": "au",
  "austria": "at",
  "belgium": "be",
  "bosnia": "ba",
  "bosnia and herzegovina": "ba",
  "brazil": "br",
  "canada": "ca",
  "cape verde": "cv",
  "colombia": "co",
  "croatia": "hr",
  "curacao": "cw",
  "curaçao": "cw",
  "czech republic": "cz",
  "czechia": "cz",
  "dr congo": "cd",
  "democratic republic of congo": "cd",
  "ecuador": "ec",
  "egypt": "eg",
  "england": "gb-eng",
  "france": "fr",
  "germany": "de",
  "ghana": "gh",
  "haiti": "ht",
  "iran": "ir",
  "iraq": "iq",
  "ivory coast": "ci",
  "cote d'ivoire": "ci",
  "côte d’ivoire": "ci",
  "japan": "jp",
  "jordan": "jo",
  "mexico": "mx",
  "morocco": "ma",
  "netherlands": "nl",
  "new zealand": "nz",
  "norway": "no",
  "panama": "pa",
  "paraguay": "py",
  "portugal": "pt",
  "qatar": "qa",
  "saudi arabia": "sa",
  "scotland": "gb-sct",
  "senegal": "sn",
  "south africa": "za",
  "south korea": "kr",
  "spain": "es",
  "sweden": "se",
  "switzerland": "ch",
  "tunisia": "tn",
  "turkey": "tr",
  "united states": "us",
  "usa": "us",
  "uruguay": "uy",
  "uzbekistan": "uz"
};

function flagCodeForTeam(team) {
  return TEAM_FLAG_CODES[normaliseText(team)] || "";
}

function flagImageHtml(team) {
  const code = flagCodeForTeam(team);
  if (!code) return "";

  const safeTeam = escapeHtml(String(team || "").trim());
  return `<img class="team-flag" src="https://flagcdn.com/24x18/${code}.png" srcset="https://flagcdn.com/48x36/${code}.png 2x" width="24" height="18" alt="" aria-hidden="true" loading="lazy" />`;
}

function teamLabelHtml(team, classes = []) {
  const safeTeam = escapeHtml(String(team || "").trim());
  const content = `${flagImageHtml(team)}<span class="team-name-text">${safeTeam}</span>`;

  if (!classes || classes.length === 0) {
    return `<span class="team-name">${content}</span>`;
  }

  return `<span class="team-name ${classes.join(" ")}">${content}</span>`;
}

function teamInlineHtml(team) {
  const safeTeam = escapeHtml(String(team || "").trim());
  return `${flagImageHtml(team)}${safeTeam}`;
}

function teamPlainText(team) {
  return String(team || "").trim();
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
    button.setAttribute("aria-expanded", "false");

    button.innerHTML = `
      <span>${title}</span>
      <span class="rules-collapse-chevron">+</span>
    `;

    const body = document.createElement("div");
    body.className = "rules-collapse-body";
    body.hidden = true;

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
    card.classList.toggle("is-open", false);
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

function playerGoalDifferenceFromDetails(playerName, playerDetails) {
  const details = (playerDetails || []).find(item => item.name === playerName);

  if (!details || !Array.isArray(details.teams)) {
    return 0;
  }

  return details.teams.reduce((total, team) => total + goalDifference(team), 0);
}

function playerGoalsForFromDetails(playerName, playerDetails) {
  const details = (playerDetails || []).find(item => item.name === playerName);

  if (!details || !Array.isArray(details.teams)) {
    return 0;
  }

  return details.teams.reduce((total, team) => total + Number(team.goalsFor || 0), 0);
}

function addGoalDifferenceToLeaderboard(leaderboard, playerDetails) {
  return (leaderboard || []).map(player => ({
    ...player,
    goalDifference: player.goalDifference
      ?? player.combinedGoalDifference
      ?? player.gd
      ?? playerGoalDifferenceFromDetails(player.name, playerDetails),
    goalsFor: player.goalsFor
      ?? player.goalsScored
      ?? playerGoalsForFromDetails(player.name, playerDetails)
  }));
}

function rankLeaderboardByTieBreakers(leaderboard) {
  const ranked = [...(leaderboard || [])].sort((a, b) => {
    if ((b.points ?? 0) !== (a.points ?? 0)) {
      return (b.points ?? 0) - (a.points ?? 0);
    }

    if ((b.goalDifference ?? 0) !== (a.goalDifference ?? 0)) {
      return (b.goalDifference ?? 0) - (a.goalDifference ?? 0);
    }

    if ((b.goalsFor ?? 0) !== (a.goalsFor ?? 0)) {
      return (b.goalsFor ?? 0) - (a.goalsFor ?? 0);
    }

    if ((a.gamesPlayed ?? 0) !== (b.gamesPlayed ?? 0)) {
      return (a.gamesPlayed ?? 0) - (b.gamesPlayed ?? 0);
    }

    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return ranked.map((player, index) => {
    const newRank = index + 1;
    const oldRank = Number(player.rank || newRank);
    const movement = Number(player.movement || 0) + (oldRank - newRank);

    return {
      ...player,
      rank: newRank,
      movement,
      movementDirection: movement > 0 ? "up" : movement < 0 ? "down" : "same"
    };
  });
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

function playerTeamsHtml(leaderboard, playerName, extraClasses = []) {
  const player = (leaderboard || []).find(item => item.name === playerName);
  const teams = player?.teams || [];

  if (teams.length === 0) return "";

  return teams.map(team => teamLabelHtml(team, extraClasses)).join(" ");
}

function playerTeamsCompactHtml(leaderboard, playerName) {
  const teams = playerTeamsHtml(leaderboard, playerName);
  return teams ? `<span class="player-team-flags">${teams}</span>` : "";
}

function playerTeamsCompactHighlightedHtml(leaderboard, playerName, highlights = []) {
  const player = (leaderboard || []).find(item => item.name === playerName);
  const teams = player?.teams || [];

  if (teams.length === 0) return "";

  const teamHtml = teams.map(team => {
    const classes = [];

    highlights.forEach(highlight => {
      if (highlight?.team && normaliseText(highlight.team) === normaliseText(team)) {
        classes.push(highlight.className);
      }
    });

    return teamLabelHtml(team, classes);
  }).join(" ");

  return `<span class="player-team-flags">${teamHtml}</span>`;
}

function ordinal(value) {
  const number = Number(value || 0);
  const suffix = number % 10 === 1 && number % 100 !== 11
    ? "st"
    : number % 10 === 2 && number % 100 !== 12
      ? "nd"
      : number % 10 === 3 && number % 100 !== 13
        ? "rd"
        : "th";

  return `${number}${suffix}`;
}

function renderStatus(status) {
  const statusEl = document.querySelector("#status");

  if (!statusEl) return;

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

  renderTournamentProgressMini(status);
}


function renderTournamentProgressMini(status) {
  const cards = document.querySelector(".cards");
  if (!cards) return;

  let progress = document.querySelector("#tournament-progress-mini");
  if (!progress) {
    progress = document.createElement("div");
    progress.id = "tournament-progress-mini";
    progress.className = "tournament-progress-mini";
    cards.insertAdjacentElement("beforebegin", progress);
  }

  const completed = status.completedMatches ?? 0;
  const total = status.totalTournamentMatches ?? 104;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  progress.innerHTML = `
    <span class="mini-progress-label">Tournament progress</span>
    <strong>${completed} of ${total}</strong>
    <span class="mini-progress-percent">${percent}% complete</span>
    <span class="progress-mini" aria-hidden="true"><span style="width: ${percent}%"></span></span>
  `;
}

function biggestMoversHtml(leaderboard) {
  const upwardMovers = (leaderboard || [])
    .filter(player => (player.movement || 0) > 0)
    .sort((a, b) => (b.movement || 0) - (a.movement || 0))
    .slice(0, 3);

  const downwardMovers = (leaderboard || [])
    .filter(player => (player.movement || 0) < 0)
    .sort((a, b) => (a.movement || 0) - (b.movement || 0))
    .slice(0, 2);

  if (upwardMovers.length === 0 && downwardMovers.length === 0) {
    return `<span class="insight-chip">No ranking movement yet</span>`;
  }

  return `
    ${upwardMovers.map(player => `
      <span class="insight-chip positive">${escapeHtml(player.name)} ▲ ${player.movement}</span>
    `).join("")}
    ${downwardMovers.map(player => `
      <span class="insight-chip negative">${escapeHtml(player.name)} ▼ ${Math.abs(player.movement)}</span>
    `).join("")}
  `;
}

function renderSummaryCards(leaderboard, playerDetails) {
  const leaderEl = document.querySelector("#current-leader");
  const spoonEl = document.querySelector("#wooden-spoon");
  const thirdCardEl = document.querySelector("#completed-matches");

  if (!leaderEl || !spoonEl) return;

  const leader = leaderboard[0];
  const spoonTeam = findWoodenSpoonTeam(playerDetails);

  leaderEl.innerHTML = leader
    ? `
      <span>${escapeHtml(leader.name)} — ${leader.points} pts</span>
      ${playerTeamsCompactHtml(leaderboard, leader.name)}
    `
    : "No data";

  if (!spoonTeam) {
    spoonEl.textContent = "No data";
  } else {
    spoonEl.innerHTML = `
      ${escapeHtml(spoonTeam.playerName)} — ${teamLabelHtml(spoonTeam.team, ["wooden-spoon-country"])}
      <br />
      <span class="small-card-text">
        ${spoonTeam.points} pts, ${spoonTeam.gamesPlayed} played, GD ${spoonTeam.goalDifference}
      </span>
    `;
  }

  if (thirdCardEl) {
    const card = thirdCardEl.closest(".card");
    const heading = card?.querySelector("h2");
    if (heading) heading.textContent = "📈 Biggest Movers";
    thirdCardEl.innerHTML = `
      <span class="small-card-text">Movement since the previous scoring update.</span>
      <span class="top-card-chip-row">${biggestMoversHtml(leaderboard)}</span>
    `;
  }
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

  const spoonTeam = findWoodenSpoonTeam(playerDetails);
  const fastestGoalTeam = bonusData?.fastestGoal?.team;
  const prizeHighlights = [
    spoonTeam ? { team: spoonTeam.team, className: "wooden-spoon-country" } : null,
    fastestGoalTeam ? { team: fastestGoalTeam, className: "wooden-spoon-country" } : null
  ].filter(Boolean);

  const payoutHtml = projectedPayouts.map(player => {
    const prizeTags = player.prizes.map(prize => `
      <span>${prize.icon} ${prize.label} £${prize.amount}</span>
    `).join("");
    const teamFlags = playerTeamsCompactHighlightedHtml(leaderboard, player.name, prizeHighlights);

    return `
      <div class="prize-payout-item">
        <div class="prize-payout-topline">
          <strong>${escapeHtml(player.name)}</strong>
          <span>£${player.total}</span>
        </div>
        ${teamFlags ? `<div class="prize-payout-teams">${teamFlags}</div>` : ""}
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


function injectDramaFeedStyles() {
  if (document.querySelector("#drama-feed-styles")) return;

  const style = document.createElement("style");
  style.id = "drama-feed-styles";
  style.textContent = `
    .prize-highlight-country,
    .prize-payout-teams .wooden-spoon-country {
      color: #ffd166;
      border-color: rgba(255, 209, 102, 0.48);
      background: rgba(255, 209, 102, 0.10);
      box-shadow: inset 0 0 0 1px rgba(255, 209, 102, 0.10);
    }

    .layered-hero-meta p,
    .generated-title-header > p,
    .page-header > p {
      display: none;
    }

    .mini-progress-percent {
      font-size: 0.78rem;
      font-weight: 800;
      color: var(--muted);
      white-space: nowrap;
    }

    .progress-mini {
      display: block;
      width: 100%;
      height: 8px;
      margin-top: 10px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(95, 169, 255, 0.14);
      border: 1px solid rgba(95, 169, 255, 0.18);
    }

    .progress-mini span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #5fb5ff, #ffd166);
    }

    .tournament-progress-mini {
      display: flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      max-width: 100%;
      margin: 0 auto 14px;
      padding: 7px 11px;
      border: 1px solid rgba(95, 169, 255, 0.18);
      border-radius: 999px;
      background: rgba(7, 30, 47, 0.72);
      color: var(--muted);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
    }

    .tournament-progress-mini .mini-progress-label {
      color: #9bd7ff;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 0.72rem;
    }

    .tournament-progress-mini strong {
      color: #fff;
    }

    .tournament-progress-mini .progress-mini {
      width: 100px;
      margin: 0;
      height: 6px;
    }

    .top-card-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 10px;
    }

    .drama-feed-section {
      margin-top: 26px;
    }

    .drama-feed-section h2 {
      margin-bottom: 8px;
    }

    .drama-feed-note {
      margin: 0 0 14px;
      color: var(--muted);
      font-size: 1rem;
    }

    .drama-feed-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
      align-items: stretch;
    }

    .drama-item {
      position: relative;
      overflow: hidden;
      min-height: 145px;
      padding: 18px;
      border: 1px solid rgba(95, 169, 255, 0.22);
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(13, 48, 74, 0.92), rgba(7, 30, 47, 0.92));
      box-shadow: var(--shadow);
    }

    .drama-item::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 5px;
      background: linear-gradient(180deg, #ffd166, #5fb5ff);
    }

    .drama-item::after {
      content: "";
      position: absolute;
      right: -36px;
      top: -42px;
      width: 130px;
      height: 130px;
      border-radius: 999px;
      background: rgba(95, 169, 255, 0.10);
      pointer-events: none;
    }

    .drama-item.spoon::before { background: linear-gradient(180deg, #ffd166, #ffad5a); }
    .drama-item.fastest::before { background: linear-gradient(180deg, #ffad5a, #ffd166); }
    .drama-item.goals::before { background: linear-gradient(180deg, #30e06f, #5fb5ff); }
    .drama-item.leader::before { background: linear-gradient(180deg, #ffd166, #30e06f); }
    .drama-item.mover::before { background: linear-gradient(180deg, #30e06f, #9bd7ff); }
    .drama-item.stinker::before { background: linear-gradient(180deg, #ff6b6b, #ffd166); }

    .drama-label {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 10px;
      padding: 5px 10px;
      border: 1px solid rgba(154, 215, 255, 0.18);
      border-radius: 999px;
      color: #dbeafe;
      font-size: 0.78rem;
      font-weight: 900;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      background: rgba(3, 18, 30, 0.28);
    }

    .drama-item h3 {
      margin: 0 0 8px;
      font-size: clamp(1.05rem, 2vw, 1.25rem);
      line-height: 1.12;
    }

    .drama-item p {
      margin: 0;
      color: var(--muted);
      font-size: 0.96rem;
      line-height: 1.38;
    }

    @media (max-width: 900px) {
      .tournament-progress-mini {
        width: auto;
        justify-content: center;
        flex-wrap: wrap;
        border-radius: 18px;
        font-size: 0.9rem;
      }

      .mini-progress-percent {
        font-size: 0.76rem;
      }

      .drama-feed-grid {
        grid-template-columns: 1fr;
      }

      .drama-feed-section {
        margin-top: 20px;
      }

      .drama-item {
        min-height: auto;
        padding: 16px;
      }

      .drama-item p {
        font-size: 0.92rem;
      }
    }
  `;

  document.head.appendChild(style);
}

function dramaItemHtml(item) {
  const type = escapeHtml(item.type || "general");
  const icon = escapeHtml(item.icon || "🔥");
  const label = escapeHtml(item.label || item.type || "Drama");
  const title = escapeHtml(item.title || "Sweepstake update");
  const text = escapeHtml(item.text || "Something has changed in the sweepstake.");

  return `
    <article class="drama-item ${type}">
      <div class="drama-label"><span>${icon}</span><span>${label}</span></div>
      <h3>${title}</h3>
      <p>${text}</p>
    </article>
  `;
}

function buildFallbackDramaItems() {
  return [];
}

function playerTotalWins(detail) {
  return (detail?.teams || []).reduce((total, team) => total + Number(team.wins || 0), 0);
}

function playerTotalGames(detail) {
  return (detail?.teams || []).reduce((total, team) => total + Number(team.gamesPlayed || 0), 0);
}

function buildClientDramaItems(items, leaderboard, playerDetails) {
  const result = [...(items || [])];
  const hasType = type => result.some(item => item.type === type);

  const spoonTeam = findWoodenSpoonTeam(playerDetails);
  if (spoonTeam && !hasType("spoon")) {
    result.push({
      type: "spoon",
      icon: "🥄",
      label: "Spoon drama",
      title: `${spoonTeam.playerName} has the spoon`,
      text: `${spoonTeam.team} are propping things up on ${spoonTeam.points} pts with GD ${formatGoalDifference(spoonTeam.goalDifference)}. Not the trophy anyone wants.`
    });
  }

  if (!hasType("stinker")) {
    const stinkers = (playerDetails || [])
      .map(detail => ({
        name: detail.name,
        points: Number(detail.matchPoints ?? detail.points ?? 0),
        rank: Number(detail.rank || 999),
        wins: playerTotalWins(detail),
        games: playerTotalGames(detail),
        teams: detail.teams || []
      }))
      .filter(player => player.games > 0 && player.wins === 0)
      .sort((a, b) => {
        if (a.points !== b.points) return a.points - b.points;
        if (b.games !== a.games) return b.games - a.games;
        return b.rank - a.rank;
      });

    const stinker = stinkers[0];

    if (stinker) {
      const teamNames = stinker.teams.map(team => team.team).filter(Boolean).join(", ");
      result.push({
        type: "stinker",
        icon: "😬",
        label: "Stinker watch",
        title: `${stinker.name} is having a stinker`,
        text: `${teamNames || "Their teams"} have played ${stinker.games} matches without a win. That is a long old watch.`
      });
    }
  }

  return result.slice(0, 5);
}


function renderDramaFeed(dramaData, leaderboard, playerDetails, bonusData, latestResults) {
  injectDramaFeedStyles();

  const existing = document.querySelector("#drama-feed-section");
  if (existing) existing.remove();

  const bonusTracker = document.querySelector("#bonus-tracker");
  const anchorSection = bonusTracker ? bonusTracker.closest("section") : null;
  if (!anchorSection) return;

  const sourceItems = Array.isArray(dramaData?.items) ? dramaData.items : [];
  const items = buildClientDramaItems(sourceItems, leaderboard, playerDetails);

  if (!items.length) return;

  const section = document.createElement("section");
  section.id = "drama-feed-section";
  section.className = "drama-feed-section";
  section.innerHTML = `
    <h2>🔥 Sweepstake Drama</h2>
    <p class="drama-feed-note">Only the good stuff: takeovers, disasters and genuine office-banter moments.</p>
    <div class="drama-feed-grid">
      ${items.slice(0, 5).map(dramaItemHtml).join("")}
    </div>
  `;

  anchorSection.insertAdjacentElement("beforebegin", section);
}

function renderInsightStrip(leaderboard, latestResults) {
  const existing = document.querySelector("#insight-strip");
  if (existing) existing.remove();
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

  const playerTotals = new Map();
  awarded.forEach(item => {
    const current = playerTotals.get(item.player) || { player: item.player, total: 0, count: 0, teams: new Set() };
    current.total += Number(item.points || 0);
    current.count += 1;
    if (item.team) current.teams.add(item.team);
    playerTotals.set(item.player, current);
  });

  const awardedSummary = [...playerTotals.values()]
    .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player))
    .slice(0, 8);

  const awardedHtml = awardedSummary.length > 0
    ? awardedSummary.map(item => `
        <li>
          <strong>${escapeHtml(item.player)}</strong>
          <span>${item.count} award${item.count === 1 ? "" : "s"} · ${[...item.teams].slice(0, 3).map(team => teamLabelHtml(team)).join(", ")}</span>
          <em>+${item.total} bonus pts</em>
        </li>
      `).join("")
    : `<li>No bonus points awarded yet.</li>`;

  const goldenBootTopGoals = Math.max(
    0,
    ...(bonusData.goldenBootRace || []).slice(0, 5).map(item => Number(item.goals || 0))
  );

  const goldenBootHtml = (bonusData.goldenBootRace || []).slice(0, 5).map(item => {
    const owners = (leaderboard || [])
      .filter(player => playerOwnsTeam(player, item.team))
      .map(player => player.name)
      .join(", ");
    const isJointLeader = Number(item.goals || 0) === goldenBootTopGoals && goldenBootTopGoals > 0;

    return `
      <li class="${isJointLeader ? "race-leader" : ""}">
        <strong>${item.player}</strong>
        <span>${teamLabelHtml(item.team)} · ${item.goals} goals</span>
        ${owners ? `<em>Owner: ${owners}</em>` : ""}
      </li>
    `;
  }).join("") || `<li>No goals tracked yet.</li>`;

  const nationTopGoals = Math.max(
    0,
    ...(bonusData.nationGoalTable || []).slice(0, 5).map(item => Number(item.goals || 0))
  );

  const nationGoalsHtml = (bonusData.nationGoalTable || []).slice(0, 5).map(item => {
    const owners = (leaderboard || [])
      .filter(player => playerOwnsTeam(player, item.team))
      .map(player => player.name)
      .join(", ");
    const isJointLeader = Number(item.goals || 0) === nationTopGoals && nationTopGoals > 0;

    return `
      <li class="${isJointLeader ? "race-leader" : ""}">
        <strong>${teamLabelHtml(item.team)}</strong>
        <span>${item.goals} goals</span>
        ${owners ? `<em>Owner: ${owners}</em>` : ""}
      </li>
    `;
  }).join("") || `<li>No nation goal data yet.</li>`;

  const fastestGoalRace = Array.isArray(bonusData.fastestGoalRace) && bonusData.fastestGoalRace.length > 0
    ? bonusData.fastestGoalRace
    : (bonusData.fastestGoal ? [bonusData.fastestGoal] : []);

  const fastestGoal = fastestGoalRace.length > 0
    ? `
      <ul>
        ${fastestGoalRace.slice(0, 5).map((item, index) => {
          const owners = (leaderboard || [])
            .filter(player => playerOwnsTeam(player, item.team))
            .map(player => player.name)
            .join(", ");

          return `
            <li class="${index === 0 ? "race-leader" : ""}">
              <strong>${item.player}</strong>
              <span>${teamLabelHtml(item.team)} · ${item.clockDisplay}</span>
              ${owners ? `<em>Owner: ${owners}</em>` : ""}
            </li>
          `;
        }).join("")}
      </ul>
    `
    : `<ul><li>No fastest goal tracked yet.</li></ul>`;

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
      <p class="bonus-note">Current fastest goal owner gets the badge. £5 prize awarded at tournament end.</p>
    </div>
  `;
}


function stageShortLabel(stage) {
  const map = {
    round_of_32: "R32",
    round_of_16: "R16",
    quarter_final: "QF",
    semi_final: "SF",
    final: "Final",
    winner: "Winner"
  };

  return map[stage] || stage;
}

function knockoutRowsFromData(knockoutData) {
  const tracker = knockoutData?.rows
    ? knockoutData
    : (knockoutData?.knockoutTracker || knockoutData || {});

  return tracker.rows || [];
}

function buildTeamBonusLookup(knockoutData) {
  const lookup = new Map();

  knockoutRowsFromData(knockoutData).forEach(row => {
    const owner = normaliseText(row.owner || "");
    const team = normaliseText(row.team || "");

    if (!owner || !team) return;

    lookup.set(`${owner}::${team}`, {
      points: Number(row.total || 0),
      stageBonuses: row.stageBonuses || [],
      cleanSheets: row.cleanSheets || []
    });
  });

  return lookup;
}

function teamBonusFor(lookup, playerName, teamName) {
  if (!lookup) return null;
  const item = lookup.get(`${normaliseText(playerName || "")}::${normaliseText(teamName || "")}`);
  return item && Number(item.points || 0) > 0 ? item : null;
}

function teamBonusPillHtml(bonus) {
  if (!bonus) return "";

  const bits = [
    ...(bonus.stageBonuses || []).map(item => `${stageShortLabel(item.stage)} +${item.points}`),
    ...(bonus.cleanSheets || []).map(item => `CS +${item.points}`)
  ];

  return `
    <span class="team-bonus-pill" title="${escapeHtml(bits.join(" · "))}">
      +${Number(bonus.points || 0)} bonus
    </span>
  `;
}

function renderKnockoutTracker(knockoutData, leaderboard) {
  const container = document.querySelector("#knockout-tracker");

  if (!container) return;

  const tracker = knockoutData?.rows
    ? knockoutData
    : (knockoutData?.knockoutTracker || knockoutData || {});

  const rows = tracker.rows || [];
  const awardedItems = tracker.awardedItems || [];

  if (!rows.length) {
    container.innerHTML = `
      <div class="knockout-empty-card">
        <h3>No knockout bonuses awarded yet</h3>
        <p>As soon as qualified teams appear in the knockout fixtures, this section will show exactly which player and team received each bonus.</p>
      </div>
    `;
    return;
  }

  const activeRows = rows
    .filter(row => Number(row.total || 0) > 0)
    .sort((a, b) => Number(b.total || 0) - Number(a.total || 0) || String(a.owner || "").localeCompare(String(b.owner || "")));

  const topRows = activeRows.slice(0, 8);
  const totalAwarded = activeRows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const teamsQualified = activeRows.length;
  const cleanSheets = rows.reduce((sum, row) => sum + (row.cleanSheets || []).length, 0);

  const stageOrder = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final", "winner"];

  const stageSummary = stageOrder.map(stage => {
    const count = rows.filter(row => (row.stageBonuses || []).some(item => item.stage === stage)).length;
    const stageMeta = (tracker.stages || []).find(item => item.key === stage);

    return `
      <div class="knockout-stage-chip ${count ? "stage-active" : ""}">
        <span>${stageShortLabel(stage)}</span>
        <strong>${count}</strong>
        <small>${stageMeta?.points ? `+${stageMeta.points}` : ""}</small>
      </div>
    `;
  }).join("");

  const leaderboardByPlayer = Object.fromEntries((leaderboard || []).map(player => [player.name, player]));

  const contendersHtml = topRows.length
    ? topRows.map((row, index) => {
        const player = leaderboardByPlayer[row.owner] || {};
        const stageBadges = (row.stageBonuses || []).map(item => `
          <span class="knockout-bonus-pill">${stageShortLabel(item.stage)} +${item.points}</span>
        `).join("");

        const cleanSheetBadges = (row.cleanSheets || []).map(item => `
          <span class="knockout-bonus-pill clean-sheet-pill">CS +${item.points}</span>
        `).join("");

        return `
          <article class="knockout-team-card ${index === 0 ? "top-knockout-card" : ""}">
            <div class="knockout-team-header">
              <span class="knockout-owner">${row.owner}</span>
              <strong>${row.total} bonus pts</strong>
            </div>
            <h3>${teamLabelHtml(row.team)}</h3>
            <p>Rank ${player.rank || "—"} · Total ${player.points ?? "—"} pts · Bonus ${player.bonusPoints ?? row.total}</p>
            <div class="knockout-bonus-pills">
              ${stageBadges || `<span class="knockout-bonus-pill muted">No progression yet</span>`}
              ${cleanSheetBadges}
            </div>
          </article>
        `;
      }).join("")
    : `
      <div class="knockout-empty-card">
        <h3>No teams have qualified for knockout bonuses yet</h3>
        <p>This will come alive as soon as the knockout fixtures start filling with real teams.</p>
      </div>
    `;

  container.innerHTML = `
    <div class="knockout-overview-card">
      <div>
        <span class="knockout-eyebrow">Knockout bonus points</span>
        <h3>${totalAwarded} pts awarded</h3>
        <p>${teamsQualified} teams have active knockout bonuses. ${cleanSheets} knockout clean sheets tracked.</p>
      </div>
      <div class="knockout-stage-grid">
        ${stageSummary}
      </div>
    </div>

    <div class="knockout-main-grid knockout-main-grid-single">
      <div class="knockout-qualified-panel knockout-qualified-panel-wide">
        <div class="knockout-panel-header">
          <h3>Qualified teams & bonus impact</h3>
          <span>Team-by-team transparency</span>
        </div>
        <div class="knockout-team-grid knockout-team-grid-wide">
          ${contendersHtml}
        </div>
      </div>
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


function matchStageKey(match) {
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

function matchStageLabel(match) {
  const key = matchStageKey(match);
  const map = {
    round_of_32: "Round of 32",
    round_of_16: "Round of 16",
    quarter_final: "Quarter-final",
    semi_final: "Semi-final",
    final: "Final",
    third_place: "Third place"
  };
  return map[key] || "Knockout";
}

function isKnockoutMatch(match) {
  return ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final", "third_place"].includes(matchStageKey(match));
}

function teamIsPlaceholder(name) {
  return !name || /TBD|Winner|Loser|Group .*Place|Group .*Winner|Group .*2nd Place|Third Place/i.test(String(name));
}

function bracketTeamHtml(name) {
  if (teamIsPlaceholder(name)) {
    return `<span class="bracket-team bracket-team-placeholder"><span class="bracket-shield">◆</span>${escapeHtml(name || "TBD")}</span>`;
  }
  return `<span class="bracket-team">${teamLabelHtml(name)}</span>`;
}

function renderKnockoutBracket(matches, leaderboard) {
  const container = document.querySelector("#knockout-bracket");
  if (!container) return;

  const knockoutMatches = [...(matches || [])]
    .filter(isKnockoutMatch)
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  if (!knockoutMatches.length) {
    container.innerHTML = `
      <div class="knockout-empty-card">
        <h3>No knockout fixtures yet</h3>
        <p>The bracket will populate as soon as knockout matches appear in the fixture feed.</p>
      </div>
    `;
    return;
  }

  const stageOrder = ["round_of_32", "round_of_16", "quarter_final", "semi_final", "final"];
  const stageTitles = {
    round_of_32: "Round of 32",
    round_of_16: "Round of 16",
    quarter_final: "Quarter-final",
    semi_final: "Semi-final",
    final: "Final"
  };

  const ownerByTeam = new Map();
  (leaderboard || []).forEach(player => {
    (player.teams || []).forEach(team => ownerByTeam.set(normaliseTeamName(team), player.name));
  });

  container.innerHTML = `
    <div class="knockout-bracket-scroll">
      <div class="knockout-bracket-grid">
        ${stageOrder.map(stage => {
          const stageMatches = knockoutMatches.filter(match => matchStageKey(match) === stage);
          return `
            <section class="bracket-stage bracket-stage-${stage}">
              <h3>${stageTitles[stage]}</h3>
              <div class="bracket-match-stack">
                ${stageMatches.length ? stageMatches.map(match => {
                  const owner1 = ownerByTeam.get(normaliseTeamName(match.team1));
                  const owner2 = ownerByTeam.get(normaliseTeamName(match.team2));
                  return `
                    <article class="bracket-match ${match.completed ? "is-complete" : ""}">
                      <span class="bracket-time">${formatDateTime(match.date)}</span>
                      <div class="bracket-teams">
                        <div class="bracket-team-row ${match.winner1 ? "winner" : ""}">
                          ${bracketTeamHtml(match.team1)}
                          ${match.completed ? `<strong>${escapeHtml(match.score1 ?? match.displayScore1 ?? "")}</strong>` : ""}
                        </div>
                        <div class="bracket-team-row ${match.winner2 ? "winner" : ""}">
                          ${bracketTeamHtml(match.team2)}
                          ${match.completed ? `<strong>${escapeHtml(match.score2 ?? match.displayScore2 ?? "")}</strong>` : ""}
                        </div>
                      </div>
                      ${(owner1 || owner2) ? `<p class="bracket-owners">${owner1 ? `${escapeHtml(owner1)} owns ${teamLabelHtml(match.team1)}` : ""}${owner1 && owner2 ? " · " : ""}${owner2 ? `${escapeHtml(owner2)} owns ${teamLabelHtml(match.team2)}` : ""}</p>` : ""}
                    </article>
                  `;
                }).join("") : `<article class="bracket-match bracket-placeholder"><span class="bracket-time">TBD</span><div class="bracket-teams"><div class="bracket-team-row">${bracketTeamHtml("TBD")}</div><div class="bracket-team-row">${bracketTeamHtml("TBD")}</div></div></article>`}
              </div>
            </section>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderPlayerDetails(details, spoonTeam, mostGoalsTeams, knockoutData) {
  const container = document.querySelector("#player-details");

  if (!container) return;

  container.innerHTML = "";

  if (!details || details.length === 0) {
    container.innerHTML = `<p>No player breakdown available yet.</p>`;
    return;
  }

  const bonusLookup = buildTeamBonusLookup(knockoutData);

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
      const teamBonus = teamBonusFor(bonusLookup, player.name, team.team);
      const teamName = teamNameHtml(team.team, teamClasses);
      const teamBonusPill = teamBonusPillHtml(teamBonus);

      const recentResults = team.recentResults && team.recentResults.length > 0
        ? team.recentResults.map(result => `
            <li>
              ${result.result}: ${teamLabelHtml(team.team)} ${result.scoreFor}–${result.scoreAgainst} ${teamLabelHtml(result.opponent)}
              (${result.points} pts)
            </li>
          `).join("")
        : `<li>No completed matches yet</li>`;

      return `
        <div class="team-breakdown ${isSpoonTeam ? "wooden-spoon-team" : ""}">
          <div class="team-breakdown-header">
            <strong>${teamName} ${teamBonusPill}</strong>
            <span>
              ${team.points} match pts
              ${teamBonus ? `<em>+${Number(teamBonus.points || 0)} bonus</em>` : ""}
            </span>
          </div>

          <div class="team-stats team-form-stats">
            <span>Played ${team.gamesPlayed}</span>
            <span>W${team.wins} D${team.draws} L${team.losses}</span>
            <span>GF ${team.goalsFor}</span>
            <span>GA ${team.goalsAgainst}</span>
            <span>GD ${formatGoalDifference(goalDifference(team))}</span>
          </div>

          <ul>${recentResults}</ul>
        </div>
      `;
    }).join("");

    const teamNames = (player.teams || [])
      .map(team => {
        const classes = teamHighlightClasses(team.team, player.name, spoonTeam, mostGoalsTeams);
        const teamBonus = teamBonusFor(bonusLookup, player.name, team.team);
        return `${teamNameHtml(team.team, classes)}${teamBonusPillHtml(teamBonus)}`;
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
    chips.push(`<span class="potential-chip potential-chip-win">${teamLabelHtml(match.team1)} +${row.team1Win}</span>`);
  }

  if (row.draw > 0) {
    chips.push(`<span class="potential-chip potential-chip-draw">Draw +${row.draw}</span>`);
  }

  if (row.team2Win > 0) {
    chips.push(`<span class="potential-chip potential-chip-win">${teamLabelHtml(match.team2)} +${row.team2Win}</span>`);
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

function calculateMoveCandidates(leaderboard, fixtures) {
  const impactMatches = getUpcomingImpactMatches(fixtures);
  const candidates = [];

  if (!leaderboard || leaderboard.length === 0 || impactMatches.length === 0) {
    return candidates;
  }

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

        candidates.push({
          player: player.name,
          match,
          outcome,
          places,
          gainedPoints,
          oldRank,
          newRank
        });
      });
    });
  });

  return candidates.sort((a, b) => {
    if (b.places !== a.places) return b.places - a.places;
    if (b.gainedPoints !== a.gainedPoints) return b.gainedPoints - a.gainedPoints;
    if (a.newRank !== b.newRank) return a.newRank - b.newRank;
    return a.player.localeCompare(b.player);
  });
}

function uniqueMoveCandidates(candidates, limit = 3) {
  const seenPlayers = new Set();
  const unique = [];

  (candidates || []).forEach(candidate => {
    if (seenPlayers.has(candidate.player)) return;

    seenPlayers.add(candidate.player);
    unique.push(candidate);
  });

  return unique.slice(0, limit);
}

function moveCandidateText(candidate) {
  return `If ${escapeHtml(candidate.outcome.label)} in ${teamLabelHtml(candidate.match.team1)} v ${teamLabelHtml(candidate.match.team2)}, ${escapeHtml(candidate.player)} gains +${candidate.gainedPoints} and moves from ${ordinal(candidate.oldRank)} to ${ordinal(candidate.newRank)}.`;
}

function renderBiggestPossibleMove(leaderboard, fixtures) {
  const container = document.querySelector("#biggest-possible-move");

  if (!container) return;

  const impactMatches = getUpcomingImpactMatches(fixtures);
  const candidates = uniqueMoveCandidates(calculateMoveCandidates(leaderboard, fixtures), 1);
  const best = candidates[0];

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
            ? `${teamLabelHtml(firstImpact.match.team1)} v ${teamLabelHtml(firstImpact.match.team2)} can still add points, but may not change positions immediately.`
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
      <p>${moveCandidateText(best)}</p>
    </div>
    <div class="biggest-move-badge">+${best.gainedPoints}</div>
  `;
}

function renderMatchdayStorylines(leaderboard, fixtures) {
  const container = document.querySelector("#matchday-storylines");

  if (!container) return;

  const allCandidates = uniqueMoveCandidates(calculateMoveCandidates(leaderboard, fixtures), 5);
  const candidates = allCandidates.slice(1, 5);

  if (candidates.length === 0) {
    container.innerHTML = `
      <div class="storyline-heading">
        <span>Matchday Storylines</span>
        <small>No other major rank moves projected yet</small>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="storyline-heading">
      <span>Matchday Storylines</span>
      <small>Other moves to watch</small>
    </div>
    <div class="storyline-list">
      ${candidates.map(candidate => `
        <div class="storyline-item">
          <strong>${escapeHtml(candidate.player)} could jump ${candidate.places} place${candidate.places === 1 ? "" : "s"}</strong>
          <span>${moveCandidateText(candidate)}</span>
        </div>
      `).join("")}
    </div>
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
  let matchesData = [];
  let dramaData = null;
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

  try {
    matchesData = await loadJson("data/matches.json");
  } catch (error) {
    console.warn("Match data not available for knockout bracket yet.");
  }

  try {
    dramaData = await loadJson("data/drama_feed.json");
  } catch (error) {
    console.warn("Drama feed not available yet; using current dashboard state instead.");
  }

  leaderboard = rankLeaderboardByTieBreakers(
    addGoalDifferenceToLeaderboard(leaderboard, playerDetails)
  );

  const badgeData = findCurrentBadgeHolders(leaderboard, playerDetails, bonusData);
  spoonTeam = badgeData.spoonTeam;
  badgesByPlayer = badgeData.badgesByPlayer;
  mostGoalsTeams = badgeData.mostGoalsTeams || [];

  renderSummaryCards(leaderboard, playerDetails);
  renderInsightStrip(leaderboard, latestResults);
  renderLeaderboard(leaderboard, spoonTeam, badgesByPlayer, mostGoalsTeams);
  renderBonusTracker(bonusData, leaderboard);
  renderKnockoutTracker(bonusData?.knockoutTracker || bonusData, leaderboard);
  renderKnockoutBracket(matchesData, leaderboard);
  renderPrizePoolSection(leaderboard, playerDetails, bonusData);
  renderWoodenSpoonRace(playerDetails);
  renderPlayerDetails(playerDetails, spoonTeam, mostGoalsTeams, bonusData?.knockoutTracker || bonusData);
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
    renderMatchdayStorylines(leaderboard, upcomingFixtures);
    renderDramaFeed(dramaData, leaderboard, playerDetails, bonusData, latestResults);
  } catch (error) {
    console.error(error);

    const upcomingEl = document.querySelector("#upcoming-fixtures");

    if (upcomingEl) {
      upcomingEl.textContent = "Upcoming fixtures not available yet.";
    }

    renderBiggestPossibleMove(leaderboard, []);
    renderMatchdayStorylines(leaderboard, []);
    renderDramaFeed(dramaData, leaderboard, playerDetails, bonusData, latestResults);
  }
}

init();
