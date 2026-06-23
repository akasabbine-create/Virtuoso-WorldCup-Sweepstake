(function () {
  const MAX_WAIT_MS = 10000;

  function safeText(value) {
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

  function teamHtml(team) {
    if (typeof teamLabelHtml === "function") {
      return teamLabelHtml(team);
    }

    return `<span class="team-name">${safeText(team)}</span>`;
  }

  function waitForMatchGrid() {
    return new Promise(resolve => {
      const started = Date.now();

      function check() {
        const grid = document.querySelector(".tv-match-grid");

        if (grid || Date.now() - started > MAX_WAIT_MS) {
          resolve(grid);
          return;
        }

        window.setTimeout(check, 150);
      }

      check();
    });
  }

  function visibleMatches(fixtures) {
    const futureMatches = [...(fixtures || [])]
      .filter(match => !match.completed)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    return (futureMatches.length ? futureMatches : fixtures || []).slice(0, 4);
  }

  function statusLabel(match) {
    if (typeof fixtureStatusLabel === "function") {
      return fixtureStatusLabel(match);
    }

    return match.status || "Upcoming";
  }

  function statusClass(match) {
    if (typeof fixtureStatusClass === "function") {
      return fixtureStatusClass(match);
    }

    return match.live ? "live" : match.completed ? "final" : "upcoming";
  }

  function timeOnly(value) {
    return typeof formatTimeOnly === "function" ? formatTimeOnly(value) : "TBC";
  }

  function dateTime(value) {
    return typeof formatDateTime === "function" ? formatDateTime(value) : safeText(value || "TBC");
  }

  function scoreText(match) {
    if (match.score1 === null || match.score2 === null) {
      return "Kick-off";
    }

    return `${safeText(match.score1)} - ${safeText(match.score2)}`;
  }

  function ownerTeamTags(player, match) {
    const ownedTeams = (player.teams || [])
      .filter(team => normalize(team) === normalize(match.team1) || normalize(team) === normalize(match.team2));

    return ownedTeams.map(team => teamHtml(team)).join("");
  }

  function playerRows(match) {
    if (!match.players || !match.players.length) {
      return `<span class="tv-match-owner-row">No sweepstake players involved</span>`;
    }

    return match.players.map(player => `
      <span class="tv-match-owner-row">
        <strong>${safeText(player.name)}</strong>
        ${ownerTeamTags(player, match)}
      </span>
    `).join("");
  }

  function renderMatch(match) {
    const fixtureClass = statusClass(match);

    return `
      <article class="tv-match-card tv-match-card-expanded">
        <div class="tv-match-meta">
          <span class="fixture-status ${fixtureClass}">${safeText(statusLabel(match))}</span>
          <strong>${timeOnly(match.date)}</strong>
        </div>

        <h3 class="tv-match-teams">
          <span>${teamHtml(match.team1)}</span>
          <em>${scoreText(match)}</em>
          <span>${teamHtml(match.team2)}</span>
        </h3>

        <div class="tv-match-detail-grid">
          <section>
            <span>Fixture</span>
            <strong>${dateTime(match.date)}</strong>
          </section>
          <section>
            <span>Points on offer</span>
            <strong>Win +3 · Draw +1</strong>
          </section>
        </div>

        <div class="tv-match-owner-list">
          <span>Sweepstake interest</span>
          ${playerRows(match)}
        </div>
      </article>
    `;
  }

  async function initExpandedMatches() {
    if (typeof loadJson !== "function") return;

    const grid = await waitForMatchGrid();
    if (!grid) return;

    const fixtures = await loadJson("data/upcoming_fixtures.json");
    const matches = visibleMatches(fixtures);

    if (!matches.length) return;

    grid.innerHTML = matches.map(renderMatch).join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initExpandedMatches);
  } else {
    initExpandedMatches();
  }
}());
