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
      return a.goalsFor - b.go
